const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { smoothLookAt } = require('../bot/camera/smoothLookAt')
const { cinematicFlyTo } = require('../bot/movement/cinematicFlyTo')
const {
	createOutsideRoute,
	SIDE_ORDER,
} = require('../bot/movement/createOutsideRoute')
const { getOutsideBreakPositions } = require('../bot/movement/getOutsideBreakPositions')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const { applyFastMiningSetup } = require('../bot/setup/applyFastMiningSetup')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { findObjectBlocks } = require('../objects/findObjectBlocks')

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function vecCenter(pos) {
	return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
}

function boundsCenter(bounds) {
	return new Vec3(bounds.centerX, bounds.centerY, bounds.centerZ)
}

function isLiveFlagBlock(block) {
	return block && block.name !== 'air' && FLAG_BLOCKS.has(block.name)
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

function formatPos(pos) {
	return `${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`
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

function canSeeBlock(bot, block) {
	if (!block) return false
	if (typeof bot.canSeeBlock !== 'function') return true
	try {
		return bot.canSeeBlock(block)
	} catch {
		return true
	}
}

async function digWithFallback({ bot, rcon, liveBlock, cfg }) {
	const position = liveBlock.position

	const beforeDig = bot.blockAt(position)
	if (!isLiveFlagBlock(beforeDig)) return { ok: false, skippedAir: true }

	try {
		await withTimeout(
			bot.dig(beforeDig, true),
			cfg.maxDigTimeMs,
			`dig timeout ${cfg.maxDigTimeMs}ms`
		)
		return { ok: true, fallback: false }
	} catch {}

	if (!cfg.useDigFallback || !rcon) return { ok: false, fallback: false }

	const beforeFallback = bot.blockAt(position)
	if (!isLiveFlagBlock(beforeFallback)) return { ok: false, skippedAir: true }

	await safeSend(
		rcon,
		`/setblock ${position.x} ${position.y} ${position.z} minecraft:air`
	)
	return { ok: true, fallback: true }
}

function orderedOutsidePositions(outsidePositions) {
	return [...outsidePositions].sort((a, b) => {
		if (a.position.y !== b.position.y) return a.position.y - b.position.y
		return SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side)
	})
}

function sameLayerOutsidePositions(outsidePositions, y) {
	return outsidePositions.filter(item => Math.abs(item.position.y - y) < 0.01)
}

async function breakReachableFromSide({
	bot,
	rcon,
	side,
	cfg,
	onProgress,
	state,
}) {
	const freshPositions = await state.loadPositions()
	state.rescans += 1
	const reachable = []
	const maxReachDistance = cfg.maxReachDistance ?? 4.2

	for (const blockPosition of freshPositions) {
		const liveBlock = bot.blockAt(blockPosition)
		if (!isLiveFlagBlock(liveBlock)) continue

		const blockCenter = vecCenter(liveBlock.position)
		const distance = bot.entity.position.distanceTo(blockCenter)
		if (distance > maxReachDistance) continue
		if (!canSeeBlock(bot, liveBlock)) continue

		reachable.push({
			position: liveBlock.position,
			distance,
		})
	}

	reachable.sort((a, b) => a.distance - b.distance)

	let sideBroken = 0
	const limit = Math.max(1, cfg.blocksPerBurst ?? 2)

	for (const target of reachable) {
		if (state.objectEvent?.cancelled) {
			state.stopReason = 'cancelled'
			break
		}
		if (state.timedOut()) break
		if (sideBroken >= limit) break
		if (state.passBroken >= state.maxBlocksPerPass) break

		const liveBlock = bot.blockAt(target.position)
		if (!isLiveFlagBlock(liveBlock)) {
			state.skippedAir += 1
			continue
		}

		const blockCenter = vecCenter(liveBlock.position)
		const distance = bot.entity.position.distanceTo(blockCenter)
		if (distance > maxReachDistance) continue
		if (!canSeeBlock(bot, liveBlock)) continue

		if (cfg.cameraLockEnabled) setCameraTarget(blockCenter)
		await smoothLookAt(bot, blockCenter, {
			durationMs: cfg.lookAtBlockDurationMs,
			jitter: 0,
		})
		if (cfg.preBreakPauseMs > 0) await sleep(cfg.preBreakPauseMs)

		const beforeSwing = bot.blockAt(liveBlock.position)
		if (!isLiveFlagBlock(beforeSwing)) {
			state.skippedAir += 1
			continue
		}

		const distanceBeforeSwing = bot.entity.position.distanceTo(blockCenter)
		if (distanceBeforeSwing > maxReachDistance) continue

		try {
			bot.swingArm('right')
		} catch {}
		if (cfg.swingPauseMs > 0) await sleep(cfg.swingPauseMs)

		const result = await digWithFallback({
			bot,
			rcon,
			liveBlock,
			cfg,
		})

		if (cfg.afterBreakPauseMs > 0) await sleep(cfg.afterBreakPauseMs)

		if (result.skippedAir) {
			state.skippedAir += 1
			continue
		}
		if (!result.ok) continue

		state.broken += 1
		state.passBroken += 1
		sideBroken += 1
		state.lastProgressAt = Date.now()
		if (result.fallback) state.fallbackBroken += 1
		onProgress?.({
			broken: state.broken,
			fallbackBroken: state.fallbackBroken,
			block: liveBlock,
			fallback: result.fallback,
		})

		if (cfg.breakDelayMs > 0) await sleep(cfg.breakDelayMs)
	}

	console.log(`[BREAK] side=${side} reachable=${reachable.length} broken=${sideBroken}`)
	if (cfg.burstPauseMs > 0 && sideBroken > 0) await sleep(cfg.burstPauseMs)
}

async function fallbackCleanup({ bot, rcon, positions }) {
	let cleaned = 0
	if (!rcon) return cleaned

	for (const position of positions) {
		const liveBlock = bot.blockAt(position)
		if (!isLiveFlagBlock(liveBlock)) continue
		await safeSend(
			rcon,
			`/setblock ${liveBlock.position.x} ${liveBlock.position.y} ${liveBlock.position.z} minecraft:air`
		)
		cleaned += 1
	}

	return cleaned
}

async function fastBreakVisibleFlagBlocks({
	bot,
	rcon,
	objectEvent,
	onProgress = null,
}) {
	const cfg = behavior
	const commandBus = rcon || bot
	const startedAt = Date.now()
	let lastProgressAt = startedAt
	let broken = 0
	let fallbackBroken = 0
	let skippedAir = 0
	let rescans = 0
	let leftovers = 0
	let loops = 0
	let stopReason = null
	let currentSide = null
	let currentPosition = bot?.entity?.position
		? new Vec3(
				bot.entity.position.x,
				bot.entity.position.y,
				bot.entity.position.z
		  )
		: null

	await applyFastMiningSetup({ bot, rcon: commandBus })
	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}

	async function loadPositions() {
		return await findObjectBlocks({
			bot,
			objectEvent: {
				...objectEvent,
				scanExisting: true,
			},
			arena: normalizeArenaForScan(),
		})
	}

	function timedOut() {
		const now = Date.now()
		if (now - startedAt > (cfg.maxEventMs ?? 60000)) {
			stopReason = 'max_event_ms'
			return true
		}
		if (now - lastProgressAt > (cfg.noProgressTimeoutMs ?? 10000)) {
			stopReason = 'no_progress_timeout'
			return true
		}
		return false
	}

	const maxPasses = cfg.maxPasses ?? cfg.maxBreakPasses ?? 8
	const maxBlocksPerPass = cfg.maxBlocksPerPass ?? 1000

	for (let pass = 1; pass <= maxPasses; pass++) {
		if (objectEvent?.cancelled) {
			stopReason = 'cancelled'
			break
		}
		if (timedOut()) break

		loops = pass
		let passBroken = 0
		const positions = await loadPositions()
		console.log(`[BREAK] pass=${pass} found=${positions.length}`)

		if (!positions.length) {
			leftovers = 0
			return {
				ok: true,
				broken,
				fallbackBroken,
				skippedAir,
				rescans,
				leftovers,
				passes: pass,
				loops,
				stopReason,
			}
		}

		const bounds = calculateBounds(positions)
		if (!bounds) break

		console.log(
			`[BREAK] bounds min=${bounds.minX},${bounds.minY},${bounds.minZ} max=${bounds.maxX},${bounds.maxY},${bounds.maxZ}`
		)

		const centerTarget = boundsCenter(bounds)
		const outsidePositions = orderedOutsidePositions(
			getOutsideBreakPositions({ bounds })
		)

		for (const targetOutside of outsidePositions) {
			const { side, position } = targetOutside
			if (objectEvent?.cancelled) {
				stopReason = 'cancelled'
				break
			}
			if (timedOut()) break
			if (passBroken >= maxBlocksPerPass) break

			console.log(`[MOVE] cinematic fly start side=${side}`)

			const layerOutsidePositions = sameLayerOutsidePositions(
				outsidePositions,
				position.y
			)
			const route = createOutsideRoute({
				fromSide: currentSide,
				toSide: side,
				outsidePositions: layerOutsidePositions,
			})
			const waypoints = route.length ? route : [position]

			for (const waypoint of waypoints) {
				currentPosition = await cinematicFlyTo({
					bot,
					rcon: commandBus,
					from: currentPosition || bot.entity.position,
					to: waypoint,
					lookTarget: centerTarget,
					bounds,
					options: cfg,
				}).catch(() => currentPosition || waypoint)
			}
			currentSide = side

			if (cfg.cameraLockEnabled) setCameraTarget(centerTarget)
			try {
				await bot.lookAt(centerTarget, true)
			} catch {}

			const state = {
				objectEvent,
				loadPositions,
				timedOut,
				maxBlocksPerPass,
				get broken() {
					return broken
				},
				set broken(value) {
					broken = value
				},
				get fallbackBroken() {
					return fallbackBroken
				},
				set fallbackBroken(value) {
					fallbackBroken = value
				},
				get skippedAir() {
					return skippedAir
				},
				set skippedAir(value) {
					skippedAir = value
				},
				get rescans() {
					return rescans
				},
				set rescans(value) {
					rescans = value
				},
				get passBroken() {
					return passBroken
				},
				set passBroken(value) {
					passBroken = value
				},
				get lastProgressAt() {
					return lastProgressAt
				},
				set lastProgressAt(value) {
					lastProgressAt = value
				},
				get stopReason() {
					return stopReason
				},
				set stopReason(value) {
					stopReason = value
				},
			}

			await breakReachableFromSide({
				bot,
				rcon: commandBus,
				side,
				cfg,
				onProgress,
				state,
			})
		}

		const afterPass = await loadPositions()
		leftovers = afterPass.length
		if (!leftovers) break

		if (passBroken === 0) console.log('[BREAK] no progress this pass')
	}

	const finalPositions = await loadPositions()
	leftovers = finalPositions.length

	if (leftovers > 0) {
		console.log(`[BREAK] fallback cleanup leftovers=${leftovers}`)
		fallbackBroken += await fallbackCleanup({
			bot,
			rcon: commandBus,
			positions: finalPositions,
		})
		leftovers = (await loadPositions()).length
	}

	return {
		ok: stopReason !== 'cancelled',
		cancelled: stopReason === 'cancelled',
		broken,
		fallbackBroken,
		skippedAir,
		rescans,
		leftovers,
		passes: loops,
		loops,
		stopReason,
	}
}

module.exports = {
	fastBreakVisibleFlagBlocks,
}
