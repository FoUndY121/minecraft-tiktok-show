const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { smoothLookAt } = require('../bot/camera/smoothLookAt')
const { teleportLookingAt } = require('../bot/movement/teleportLookingAt')
const { applyFastMiningSetup } = require('../bot/setup/applyFastMiningSetup')
const { FLAG_BLOCKS, getCountryBlock } = require('../objects/objectBuilder')
const { findObjectBlocks } = require('../objects/findObjectBlocks')
const { scanArenaForFlagBlocks } = require('../core/arenaScanner')

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function vecCenter(pos) {
	return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
}

function dist2(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return dx * dx + dy * dy + dz * dz
}

function withTimeout(promise, timeoutMs, label = 'timeout') {
	let timer
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(label)), timeoutMs)
		}),
	]).finally(() => {
		if (timer) clearTimeout(timer)
	})
}

async function digBlockFast({ bot, rcon, block, cfg }) {
	const lookTarget = vecCenter(block.position)

	// Visual: lock camera before dig.
	if (cfg.cameraLockEnabled) setCameraTarget(lookTarget)
	try {
		await bot.lookAt(lookTarget, true)
	} catch {}

	try {
		bot.swingArm('right')
	} catch {}

	if (cfg.swingPauseMs > 0) await sleep(cfg.swingPauseMs)

	try {
		await withTimeout(
			bot.dig(block, true),
			cfg.maxDigTimeMs,
			`dig timeout ${cfg.maxDigTimeMs}ms`
		)
		return { ok: true, fallback: false }
	} catch (_err) {
		if (!cfg.useDigFallback) return { ok: false, fallback: false }
		if (!rcon) return { ok: false, fallback: false }

		try {
			await bot.lookAt(lookTarget, true)
		} catch {}
		try {
			bot.swingArm('right')
		} catch {}
		if (cfg.swingPauseMs > 0) await sleep(cfg.swingPauseMs)

		await safeSend(
			rcon,
			`/setblock ${block.position.x} ${block.position.y} ${block.position.z} minecraft:air`
		)
		return { ok: true, fallback: true }
	}
}

function pickViewPosition(_bot, centerBlockPos, objectEvent) {
	const center = vecCenter(centerBlockPos)
	const origin = objectEvent?.origin || centerBlockPos
	return new Vec3(center.x, center.y + 0.35, origin.z - 2.2)
}

async function teleportInSteps({
	bot,
	rcon,
	botName,
	targetPos,
	lookTarget,
	cfg,
}) {
	if (!rcon || !botName || !bot?.entity?.position) return false

	const from = bot.entity.position
	const to = new Vec3(targetPos.x, targetPos.y, targetPos.z)
	const distance = from.distanceTo(to)
	const step = Math.max(0.15, cfg.teleportStepSize || 0.75)
	const steps = Math.max(1, Math.ceil(distance / step))

	for (let i = 1; i <= steps; i++) {
		const t = i / steps
		const pos = new Vec3(
			from.x + (to.x - from.x) * t,
			from.y + (to.y - from.y) * t,
			from.z + (to.z - from.z) * t
		)

		await teleportLookingAt({
			rcon,
			botName,
			position: pos,
			lookTarget,
		})
		await sleep(cfg.teleportStepIntervalMs || 12)
	}

	return true
}

function groupBlocks(blocks, { min = 3, max = 6 } = {}) {
	const groups = []
	let i = 0
	while (i < blocks.length) {
		const size = randInt(min, max)
		groups.push(blocks.slice(i, i + size))
		i += size
	}
	return groups
}

function normalizeArenaForScan() {
	return {
		origin: ARENA.origin,
		maxWidth: ARENA.width,
		maxDepth: ARENA.depth,
		maxHeight: ARENA.height,
		maxStack: 6,
	}
}

async function resolvePositionsToBlocks(bot, positions) {
	const blocks = []
	for (const pos of positions) {
		const b = bot.blockAt(pos)
		if (!b) continue
		if (b.name === 'air') continue
		if (!FLAG_BLOCKS.has(b.name)) continue
		blocks.push(b)
	}
	return blocks
}

function sortBlocksForFastBreak(bot, blocks) {
	const p = bot?.entity?.position

	return blocks.sort((a, b) => {
		if (a.position.y !== b.position.y) return b.position.y - a.position.y
		if (!p) return Math.random() - 0.5
		return dist2(p, a.position) - dist2(p, b.position)
	})
}

/**
 * Fast break mode:
 * - stands near the object
 * - locks camera
 * - breaks 3-6 blocks in a burst ("holding LMB" look)
 * - dig() with short timeout + /setblock air fallback
 */
async function fastBreakVisibleFlagBlocks({
	bot,
	rcon,
	objectEvent,
	onProgress = null,
}) {
	const cfg = behavior
	const commandBus = rcon || bot

	await applyFastMiningSetup({ bot, rcon: commandBus })
	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}

	const targetBlock = objectEvent?.scanExisting
		? null
		: getCountryBlock(objectEvent?.country)
	let broken = 0
	let fallbackBroken = 0
	let loops = 0

	while (loops < 250) {
		if (objectEvent?.cancelled) {
			return { ok: false, cancelled: true, broken, fallbackBroken, loops }
		}
		loops += 1

		let positions = []
		try {
			positions = await findObjectBlocks({
				bot,
				objectEvent,
				arena: normalizeArenaForScan(),
			})
		} catch {
			positions = []
		}

		if (!positions.length) {
			// Expand to entire arena stack area.
			positions = await scanArenaForFlagBlocks({
				bot,
				arena: normalizeArenaForScan(),
			})
			positions.fallback = true
		}

		const blocks = await resolvePositionsToBlocks(bot, positions)
		if (!blocks.length) break

		const useStrictTarget =
			positions.fallback !== true &&
			targetBlock &&
			blocks.some(block => block.name === targetBlock)
		const ordered = sortBlocksForFastBreak(bot, blocks)
		const groups = groupBlocks(ordered, { min: 3, max: 6 })

		for (const group of groups) {
			if (objectEvent?.cancelled) {
				return { ok: false, cancelled: true, broken, fallbackBroken, loops }
			}

			// Group might become invalid while we dig (gravity). Filter at runtime.
			const live = group
				.map(b => bot.blockAt(b.position))
				.filter(b => b && b.name !== 'air' && FLAG_BLOCKS.has(b.name))

			if (!live.length) continue

			// Center block for camera lock + approach.
			const center = live[Math.floor(live.length / 2)]
			const centerTarget = vecCenter(center.position)

			if (cfg.cameraLockEnabled) setCameraTarget(centerTarget)

			// Move/teleport near once per burst.
			const viewPos = pickViewPosition(bot, center.position, objectEvent)
			await teleportInSteps({
				bot,
				rcon: rcon,
				botName: bot?.username,
				targetPos: viewPos,
				lookTarget: centerTarget,
				cfg,
			}).catch(() => {})

			await smoothLookAt(bot, centerTarget, {
				durationMs: cfg.lookAtBlockDurationMs,
				jitter: 0,
			})

			for (const block of live) {
				if (objectEvent?.cancelled) {
					return { ok: false, cancelled: true, broken, fallbackBroken, loops }
				}

				const current = bot.blockAt(block.position)
				if (!current || current.name === 'air') continue
				if (!FLAG_BLOCKS.has(current.name)) continue
				if (
					useStrictTarget &&
					targetBlock &&
					current.name !== targetBlock &&
					objectEvent?.scanExisting !== true
				) {
					continue
				}

				if (cfg.cameraLockEnabled) {
					setCameraTarget(vecCenter(current.position))
				}

				if (cfg.preBreakPauseMs > 0) await sleep(cfg.preBreakPauseMs)
				const result = await digBlockFast({
					bot,
					rcon,
					block: current,
					cfg,
				})
				if (result.ok) {
					broken += 1
					if (result.fallback) fallbackBroken += 1
					onProgress?.({
						broken,
						fallbackBroken,
						block: current,
						fallback: result.fallback,
					})
				}

				await sleep(randInt(5, 15))
				if (cfg.breakDelayMs > 0) await sleep(cfg.breakDelayMs)
				if (cfg.afterBreakPauseMs > 0) await sleep(cfg.afterBreakPauseMs)
			}

			await sleep(randInt(20, 40))
			if (cfg.burstPauseMs > 0) await sleep(cfg.burstPauseMs)
		}
	}

	return {
		ok: true,
		broken,
		fallbackBroken,
		loops,
	}
}

module.exports = {
	fastBreakVisibleFlagBlocks,
}
