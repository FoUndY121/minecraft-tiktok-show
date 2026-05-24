const { Vec3 } = require('vec3')
const { safeRconCommand } = require('../rcon')
const { breakFlagHumanLike: breakFlagHumanLikeAction } = require('./breakFlagHumanLike')
const { teleportLookingAt } = require('../bot/movement/teleportLookingAt')
const botBehavior = require('../config/botBehavior')

const BREAKABLE_FLAG_BLOCKS = new Set([
	'sand',
	'red_sand',
	'white_concrete_powder',
	'blue_concrete_powder',
	'green_concrete_powder',
	'yellow_concrete_powder',
	'black_concrete_powder',
	'gravel',
	'orange_concrete_powder',
	'light_blue_concrete_powder',
	'gray_concrete_powder',
])

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}

function speedDelay(ms, speed = 1, minMs = 0) {
	return Math.max(minMs, Math.floor(ms / Math.max(1, speed)))
}

async function withTimeout(promise, timeoutMs) {
	let timeout
	try {
		return await Promise.race([
			promise,
			new Promise(resolve => {
				timeout = setTimeout(() => resolve(false), timeoutMs)
			}),
		])
	} finally {
		if (timeout) clearTimeout(timeout)
	}
}

async function moveNear(bot, target, { maxMs = 6000, dist = 1.4 } = {}) {
	const started = Date.now()

	while (Date.now() - started < maxMs) {
		if (!bot?.entity?.position) return false
		const p = bot.entity.position

		const dx = target.x - p.x
		const dz = target.z - p.z
		const d2 = dx * dx + dz * dz
		if (d2 <= dist * dist) {
			bot.clearControlStates()
			return true
		}

		// Look at target (keeps movement stable)
		try {
			await bot.lookAt(new Vec3(target.x, p.y, target.z), true)
		} catch {}

		// Simple movement without pathfinder:
		// - move forward if we're not close enough
		bot.setControlState('forward', true)
		// - gently strafe towards X alignment
		bot.setControlState('left', dx < -0.3)
		bot.setControlState('right', dx > 0.3)

		await sleep(80)
	}

	bot.clearControlStates()
	return false
}

async function waitForPickaxe(bot, timeoutMs = 4000) {
	const started = Date.now()
	while (Date.now() - started < timeoutMs) {
		const item = bot.inventory.items().find(i => i.name === 'diamond_pickaxe')
		if (item) return item
		await sleep(100)
	}
	return null
}

async function giveAndEquipPickaxe(bot) {
	bot.chat(`/give ${bot.username} minecraft:diamond_pickaxe 1`)
	await sleep(200)
	const pickaxe = await waitForPickaxe(bot)
	if (!pickaxe) return false
	try {
		await bot.equip(pickaxe, 'hand')
		return true
	} catch {
		return false
	}
}

async function prepareFastFlyingBot(bot, commandBus, origin, width, height, depth, speed = 1) {
	if (!bot?.username || !commandBus) return

	const speedLevel = Math.max(12, Math.min(60, Math.floor(12 * speed)))
	const hasteLevel = Math.max(20, Math.min(80, Math.floor(20 * speed)))

	await safeRconCommand(commandBus, `gamemode creative ${bot.username}`)
	await safeRconCommand(commandBus, `effect give ${bot.username} minecraft:speed 999999 ${speedLevel} true`)
	await safeRconCommand(commandBus, `effect give ${bot.username} minecraft:haste 999999 ${hasteLevel} true`)
	await safeRconCommand(commandBus, `effect give ${bot.username} minecraft:slow_falling 999999 0 true`)

	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}
}

function clearMovement(bot) {
	if (!bot) return
	bot.setControlState('forward', false)
	bot.setControlState('back', false)
	bot.setControlState('left', false)
	bot.setControlState('right', false)
	bot.setControlState('jump', false)
	bot.setControlState('sneak', false)
}

function distanceTo(bot, target) {
	const p = bot?.entity?.position
	if (!p) return Infinity
	const dx = target.x - p.x
	const dy = target.y - p.y
	const dz = target.z - p.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

async function flyNearBlock(bot, blockPos, { maxMs = 900, reach = 4.8 } = {}) {
	const started = Date.now()
	const target = {
		x: blockPos.x + 0.5 + (Math.random() - 0.5) * 0.6,
		y: blockPos.y + 0.45 + (Math.random() - 0.5) * 0.45,
		z: blockPos.z - 2.25 - Math.random() * 0.7,
	}

	while (Date.now() - started < maxMs) {
		if (!bot?.entity?.position) return false
		if (distanceTo(bot, target) <= reach) {
			clearMovement(bot)
			return true
		}

		const p = bot.entity.position
		const lookTarget = new Vec3(
			blockPos.x + 0.5 + (Math.random() - 0.5) * 0.2,
			blockPos.y + 0.5 + (Math.random() - 0.5) * 0.2,
			blockPos.z + 0.5
		)

		try {
			await bot.lookAt(lookTarget, true)
		} catch {}

		bot.setControlState('forward', true)
		bot.setControlState('left', Math.random() < 0.18)
		bot.setControlState('right', Math.random() < 0.18)
		bot.setControlState('jump', p.y < target.y - 0.35)
		bot.setControlState('sneak', p.y > target.y + 0.35)

		await sleep(90)
	}

	clearMovement(bot)
	return distanceTo(bot, target) <= reach + 0.8
}

async function lookHuman(bot, target, { steps = 3, jitter = 0.16, speed = 1 } = {}) {
	for (let i = 0; i < steps; i++) {
		const aim = new Vec3(
			target.x + (Math.random() - 0.5) * jitter,
			target.y + (Math.random() - 0.5) * jitter,
			target.z + (Math.random() - 0.5) * jitter
		)
		try {
			await bot.lookAt(aim, false)
		} catch {}
		await sleep(speedDelay(8 + Math.floor(Math.random() * 12), speed, 2))
	}
}

async function flyToRowView(bot, { origin, width, y, z }) {
	const sideDrift = (Math.random() - 0.5) * 0.55
	const heightDrift = (Math.random() - 0.5) * 0.35
	const view = new Vec3(
		origin.x + (width - 1) / 2 + 0.5 + sideDrift,
		y + 0.5 + heightDrift,
		z - 2.35 - Math.random() * 0.35
	)
	const rowCenter = new Vec3(origin.x + width / 2, y + 0.5, z + 0.5)

	if (bot.creative?.flyTo) {
		try {
			await withTimeout(bot.creative.flyTo(view), 900)
		} catch {}
	} else {
		await flyNearBlock(bot, { x: Math.floor(rowCenter.x), y, z })
	}

	await lookHuman(bot, rowCenter, { steps: 4, jitter: 0.35 })
}

async function flyToBlockView(bot, { x, y, z }) {
	const view = new Vec3(
		x + 0.5 + (Math.random() - 0.5) * 0.45,
		y + 0.5 + (Math.random() - 0.5) * 0.35,
		z - 2.05 - Math.random() * 0.45
	)
	const blockCenter = new Vec3(x + 0.5, y + 0.5, z + 0.5)

	if (bot.creative?.flyTo) {
		try {
			if (!bot.entity?.position || bot.entity.position.distanceTo(view) > 1.25) {
				await withTimeout(bot.creative.flyTo(view), 900)
			}
		} catch {}
	} else {
		await flyNearBlock(bot, { x, y, z })
	}

	await lookHuman(bot, blockCenter, { steps: 1 + Math.floor(Math.random() * 2), jitter: 0.24 })
}

function blockCenter(pos) {
	return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
}

function distanceToBlock(bot, pos) {
	const p = bot?.entity?.position
	if (!p) return Infinity
	return p.distanceTo(blockCenter(pos))
}

async function flyToReachableView(bot, target, { origin, width, depth, speed = 1 }) {
	const candidates = [
		new Vec3(
			target.x + 0.5 + (Math.random() - 0.5) * 0.55,
			target.y + 0.5 + (Math.random() - 0.5) * 0.35,
			target.z - 2.1 - Math.random() * 0.45
		),
		new Vec3(
			target.x + 0.5 + (Math.random() - 0.5) * 0.55,
			target.y + 0.5 + (Math.random() - 0.5) * 0.35,
			target.z + 3.1 + Math.random() * 0.45
		),
		new Vec3(
			target.x - 2.1 - Math.random() * 0.45,
			target.y + 0.5 + (Math.random() - 0.5) * 0.35,
			target.z + 0.5 + (Math.random() - 0.5) * 0.55
		),
		new Vec3(
			target.x + 3.1 + Math.random() * 0.45,
			target.y + 0.5 + (Math.random() - 0.5) * 0.35,
			target.z + 0.5 + (Math.random() - 0.5) * 0.55
		),
	]
	const p = bot?.entity?.position
	const byDistance = candidates.sort((a, b) => {
		if (!p) return Math.random() - 0.5
		return p.distanceTo(a) - p.distanceTo(b)
	})
	const preferred = byDistance.slice(0, 2)
	const view = preferred[Math.floor(Math.random() * preferred.length)]
	const aim = blockCenter(target)

	if (bot.creative?.flyTo) {
		try {
			if (bot?.username) {
				await teleportLookingAt({
					rcon: bot._commandBus || bot,
					botName: bot.username,
					position: view,
					lookTarget: aim,
				})
				await sleep(speedDelay(12, speed, 2))
			} else {
				await withTimeout(bot.creative.flyTo(view), speedDelay(900, speed, 160))
			}
		} catch {}
	} else {
		await flyNearBlock(bot, target)
	}

	await lookHuman(bot, aim, { steps: 2, jitter: 0.28, speed })
}

function shuffle(items) {
	for (let i = items.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const tmp = items[i]
		items[i] = items[j]
		items[j] = tmp
	}
	return items
}

function createBreakTargets(origin, width, height, minZ, maxZ) {
	const targets = []
	for (let y = origin.y; y < origin.y + height; y++) {
		for (let z = minZ; z <= maxZ; z++) {
			for (let x = origin.x; x < origin.x + width; x++) {
				targets.push({ x, y, z })
			}
		}
	}
	return shuffle(targets)
}

function createLayerTargets(origin, width, height, z) {
	const targets = []
	for (let y = origin.y; y < origin.y + height; y++) {
		for (let x = origin.x; x < origin.x + width; x++) {
			targets.push({ x, y, z })
		}
	}
	return shuffle(targets)
}

function createRowTargets(origin, height, minZ, maxZ) {
	const rows = []
	for (let z = minZ; z <= maxZ; z++) {
		const yValues = shuffle(
			Array.from({ length: height }, (_, i) => origin.y + i)
		)
		for (const y of yValues) rows.push({ y, z })
	}
	return rows
}

function createVolumeTargets(origin, width, height, minZ, maxZ) {
	const targets = []
	for (let y = origin.y; y < origin.y + height; y++) {
		for (let z = minZ; z <= maxZ; z++) {
			for (let x = origin.x; x < origin.x + width; x++) {
				targets.push({ x, y, z })
			}
		}
	}
	return shuffle(targets)
}

function isBreakableFlagBlock(block) {
	return block && BREAKABLE_FLAG_BLOCKS.has(block.name)
}

function neighborTargets(pos) {
	return [
		{ x: pos.x + 1, y: pos.y, z: pos.z },
		{ x: pos.x - 1, y: pos.y, z: pos.z },
		{ x: pos.x, y: pos.y + 1, z: pos.z },
		{ x: pos.x, y: pos.y - 1, z: pos.z },
		{ x: pos.x, y: pos.y, z: pos.z + 1 },
		{ x: pos.x, y: pos.y, z: pos.z - 1 },
	]
}

async function digBlockByHand(bot, pos, speed = 1) {
	const target = new Vec3(pos.x, pos.y, pos.z)
	let block = null
	const started = Date.now()
	while (Date.now() - started < speedDelay(160, speed, 45)) {
		block = bot.blockAt(target)
		if (block && block.name !== 'air') break
		await sleep(speedDelay(20, speed, 4))
	}
	if (!block || block.name === 'air') {
		return { ok: true, blockName: null, skipped: true }
	}

	try {
		const jitter = new Vec3(
			0.5 + (Math.random() - 0.5) * 0.35,
			0.5 + (Math.random() - 0.5) * 0.35,
			0.5 + (Math.random() - 0.5) * 0.35
		)
		await bot.lookAt(target.plus(jitter), true)
		bot.swingArm('right')
		await bot.dig(block, true)
		return { ok: true, blockName: block.name, skipped: false }
	} catch (err) {
		console.log(
			`⚠️ bot dig failed at ${pos.x} ${pos.y} ${pos.z}:`,
			err?.message || err
		)
		return { ok: false, blockName: block.name, skipped: false }
	}
}

async function breakExtraNeighborBlock({ bot, commandBus, target, origin, width, height, depth }) {
	if (!commandBus) return { ok: true, broken: false }

	for (const next of neighborTargets(target)) {
		if (
			next.x < origin.x ||
			next.x >= origin.x + width ||
			next.y < origin.y ||
			next.y >= origin.y + height ||
			next.z < origin.z ||
			next.z >= origin.z + depth
		) {
			continue
		}

		const block = bot.blockAt(new Vec3(next.x, next.y, next.z))
		if (!isBreakableFlagBlock(block)) continue

		try {
			bot.swingArm('right')
		} catch {}
		await safeRconCommand(commandBus, `setblock ${next.x} ${next.y} ${next.z} minecraft:air destroy`)
		return { ok: true, broken: true }
	}

	return { ok: true, broken: false }
}

async function breakExistingBlock(bot, target, delayMs) {
	const block = bot.blockAt(new Vec3(target.x, target.y, target.z))
	if (!isBreakableFlagBlock(block)) return { handled: false, ok: true }

	await flyToBlockView(bot, target)
	const result = await digBlockByHand(bot, target)
	if (result.ok && !result.skipped) {
		await sleep(delayMs + Math.floor(Math.random() * 25))
		return { handled: true, ok: true }
	}
	return { handled: false, ok: result.ok }
}

function createFlagBreaker({ bot, commandBus, flagStack, arena, botBrain = null }) {
	let running = false
	let wakeups = 0
	let speedMultiplier = arena.baseBreakerSpeed || 3
	let completedHeight = 0

	const currentSpeed = () => Math.max(1, speedMultiplier)

	const runOnce = async () => {
		const state = flagStack.getState()
		if (!state.baseOrigin || state.nextY <= 0) return 0
		if (state.spawning > 0) return 0
		if (state.nextY <= completedHeight) return 0

		const origin = {
			x: state.baseOrigin.x,
			y: state.baseOrigin.y + completedHeight,
			z: state.baseOrigin.z,
		}
		const height = state.nextY - completedHeight

		const flagEvent = {
			id: `stack_${Date.now()}`,
			country: 'stack',
			giftName: 'stack',
			giftTier: currentSpeed() >= 5 ? 'medium' : 'small',
			origin,
			width: arena.flagWidth,
			height,
			depth: arena.flagDepth,
		}

		const options = {
			...botBehavior,
			flightSpeed: botBehavior.flightSpeed * Math.min(3, currentSpeed() / 3),
			breakDelayMs: Math.max(5, Math.floor(botBehavior.breakDelayMs / currentSpeed())),
		}

		const result = botBrain
			? await botBrain.breakFlagHumanLike(flagEvent, options)
			: await breakFlagHumanLikeAction({
					bot,
					rcon: commandBus,
					flagEvent,
					options,
				})

		if (!result?.ok) {
			console.log('⚠️ human-like flag break failed:', result?.error || 'unknown error')
		}
		completedHeight = state.nextY

		return result?.brokenChunks || 0
	}

	const run = async () => {
		if (running) return
		running = true
		console.log('🪓 Flag breaker loop started')

		try {
			let idleRounds = 0
			while (idleRounds < 3 || wakeups > 0 || flagStack.getState().spawning > 0) {
				wakeups = 0
				const broken = await runOnce()
				if (broken > 0) {
					console.log(`🧨 Bot broke ${broken} flag blocks`)
					idleRounds = 0
				} else {
					idleRounds += 1
					await sleep(speedDelay(flagStack.getState().spawning > 0 ? 250 : 700, currentSpeed(), 60))
				}
			}
			flagStack.reset()
			completedHeight = 0
		} finally {
			clearMovement(bot)
			running = false
			console.log('✅ Flag breaker loop idle')
		}
	}

	const wake = () => {
		wakeups += 1
		run().catch(err => {
			running = false
			console.log('❌ Flag breaker failed:', err?.message || err)
		})
	}

	const setSpeedMultiplier = multiplier => {
		const next = Math.max(1, Math.min(12, Number(multiplier) || 1))
		if (Math.abs(next - speedMultiplier) < 0.05) return
		speedMultiplier = next
		console.log(`⚡ Bot breaker speed x${speedMultiplier.toFixed(1)}`)
	}

	return {
		wake,
		setSpeedMultiplier,
		isRunning: () => running,
	}
}

function computeTeleportPos(origin, { dx, dy, dz }) {
	return {
		x: origin.x + dx,
		y: origin.y + dy,
		z: origin.z + dz,
	}
}

async function breakFlag(bot, origin, width, height, opts = {}) {
	const {
		noTeleport = true,
		teleportOffset = { dx: -2, dy: 0, dz: 0 },
		delayMs = 140,
		cleanup = false,
		preBreakDelayMs = 1200,
		commandBus = null,
		commandBreak = false,
		personalBreak = true,
		depth = 1,
		breakDepthLayers = depth,
		maxBreakBlocks = Infinity,
		restoreAfterDig = false,
		restoreDelayMs = 220,
		rowFlight = true,
		randomBreak = true,
	} = opts

	console.log('🪓 Bot started breaking flag')

	// Teleport is disabled in "visual mode" (LAN friendly).
	if (!noTeleport) {
		const tp = computeTeleportPos(origin, teleportOffset)
		const position = new Vec3(tp.x, tp.y, tp.z)
		await teleportLookingAt({
			rcon: commandBus || bot._commandBus || bot,
			botName: bot.username,
			position,
			lookTarget: new Vec3(origin.x + width / 2, origin.y + height / 2, origin.z + depth / 2),
		})
		await sleep(250)
	}

	await prepareFastFlyingBot(bot, commandBus, origin, width, height, depth)

	// Let viewers see the flag before breaking starts.
	if (preBreakDelayMs > 0) await sleep(preBreakDelayMs)

	if (personalBreak && commandBus) {
		let failed = 0
		let handled = 0
		let skipped = 0
		const maxZ = Math.min(origin.z + depth - 1, origin.z + breakDepthLayers - 1)
		if (randomBreak) {
			const targets = createBreakTargets(origin, width, height, origin.z, maxZ)
			for (const target of targets) {
				if (handled >= maxBreakBlocks) break
				await flyToBlockView(bot, target)
				const result = await digBlockByHand(bot, target)
				if (!result.ok) failed += 1
				if (result.skipped) skipped += 1
				else handled += 1
				await sleep(delayMs + Math.floor(Math.random() * 45))
			}

			clearMovement(bot)
			if (skipped > 0) console.log(`⚠️ Bot skipped ${skipped} air/not-loaded blocks`)
			if (failed > 0) console.log(`⚠️ Bot finished with ${failed} dig failures`)
			else console.log('✅ Bot finished chaotic break pass')
			return
		}

		for (let y = origin.y + height - 1; y >= origin.y; y--) {
			for (let z = origin.z; z <= maxZ; z++) {
				if (rowFlight) {
					await flyToRowView(bot, { origin, width, y, z })
				}
				for (let x = origin.x; x < origin.x + width; x++) {
					if (handled >= maxBreakBlocks) {
						clearMovement(bot)
						if (skipped > 0) console.log(`⚠️ Bot skipped ${skipped} air/not-loaded blocks`)
						console.log('✅ Bot finished chaotic attack pass')
						return
					}
					if (!rowFlight) await flyNearBlock(bot, { x, y, z })
					const result = await digBlockByHand(bot, { x, y, z })
					if (!result.ok) failed += 1
					if (result.skipped) skipped += 1
					else handled += 1
					if (restoreAfterDig && result.blockName) {
						await sleep(restoreDelayMs)
						const current = bot.blockAt(new Vec3(x, y, z))
						if (!current || current.name === 'air') {
							await safeRconCommand(
								commandBus,
								`setblock ${x} ${y} ${z} minecraft:${result.blockName}`
							)
						}
					}
					await sleep(delayMs)
				}
			}
		}
		clearMovement(bot)

		if (skipped > 0) console.log(`⚠️ Bot skipped ${skipped} air/not-loaded blocks`)
		if (failed > 0) console.log(`⚠️ Bot finished with ${failed} dig failures`)
		else console.log('✅ Bot finished breaking flag by hand')
		return
	}

	if (commandBreak && commandBus) {
		for (let y = origin.y + height - 1; y >= origin.y; y--) {
			for (let z = origin.z; z < origin.z + depth; z++) {
				for (let x = origin.x; x < origin.x + width; x++) {
					try {
						bot.swingArm('right')
					} catch {}
					await safeRconCommand(commandBus, `setblock ${x} ${y} ${z} minecraft:air destroy`)
					await sleep(delayMs)
				}
			}
		}

		console.log('✅ Bot finished breaking flag')
		return
	}

	// Break blocks from top to bottom (looks nicer + avoids weird reach cases).
	for (let y = origin.y + height - 1; y >= origin.y; y--) {
		for (let x = origin.x; x < origin.x + width; x++) {
			// Move near each column so bot can reach blocks (no pathfinder).
			// Keep 2 blocks away from the wall (in front of it).
			await moveNear(bot, { x: x + 0.5, z: origin.z - 2 + 0.5 }, { maxMs: 5000 })

			const pos = new Vec3(x, y, origin.z)
			const block = bot.blockAt(pos)
			if (!block) continue
			if (block.name === 'air') continue

			try {
				await bot.dig(block)
			} catch (err) {
				// Common reasons: out of reach, protected spawn, no permission.
				console.log('⚠️ dig failed:', err?.message || err)
			}

			await sleep(delayMs)
		}
	}

	if (cleanup) {
		// Clean any leftovers via commands (fast + reliable).
		const x1 = origin.x
		const y1 = origin.y
		const z = origin.z
		const x2 = origin.x + width - 1
		const y2 = origin.y + height - 1
		bot.chat(`/fill ${x1} ${y1} ${z} ${x2} ${y2} ${z} minecraft:air`)
	}

	console.log('✅ Bot finished breaking flag')
}

module.exports = {
	breakFlag,
	createFlagBreaker,
}
