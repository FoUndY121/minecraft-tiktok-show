const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { cinematicFlyTo } = require('../bot/movement/cinematicFlyTo')
const {
	createOutsideRoute,
	SIDE_ORDER,
} = require('../bot/movement/createOutsideRoute')
const { getOutsideBreakPositions } = require('../bot/movement/getOutsideBreakPositions')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const { applyFastMiningSetup } = require('../bot/setup/applyFastMiningSetup')
const { findObjectBlocks } = require('../objects/findObjectBlocks')
const { selectHumanMiningBurst } = require('./selectHumanMiningBurst')
const { mineBurstHumanLike } = require('./mineBurstHumanLike')

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function boundsCenter(bounds) {
	return new Vec3(bounds.centerX, bounds.centerY, bounds.centerZ)
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

function isLiveFlagBlock(block) {
	return block && block.name !== 'air' && FLAG_BLOCKS.has(block.name)
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

function liveVisiblePositions(bot, positions) {
	const live = []
	for (const position of positions) {
		const block = bot.blockAt(position)
		if (!isLiveFlagBlock(block)) continue
		if (!canSeeBlock(bot, block)) continue
		live.push(block.position)
	}
	return live
}

function formatPos(pos) {
	return `${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`
}

function onePositionPerSide(outsidePositions) {
	const bySide = new Map()
	const sorted = [...outsidePositions].sort((a, b) => {
		const aSide = SIDE_ORDER.indexOf(a.side)
		const bSide = SIDE_ORDER.indexOf(b.side)
		if (aSide !== bSide) return aSide - bSide
		return a.position.y - b.position.y
	})

	for (const item of sorted) {
		if (!bySide.has(item.side)) bySide.set(item.side, item)
	}

	return SIDE_ORDER.map(side => bySide.get(side)).filter(Boolean)
}

function addHighFrontPosition(positions, bounds) {
	return positions.concat({
		side: 'top/front-high',
		position: new Vec3(bounds.centerX, bounds.maxY + 1.5, bounds.minZ - 2.5),
	})
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

async function humanLikeMineFlag({
	bot,
	rcon,
	objectEvent,
	onProgress = null,
	options = behavior,
} = {}) {
	const cfg = options
	const commandBus = rcon || bot
	const startedAt = Date.now()
	let currentSide = null
	let currentPosition = bot?.entity?.position
		? new Vec3(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z)
		: null
	let broken = 0
	let fallbackBroken = 0
	let skippedAir = 0
	let rescans = 0
	let leftovers = 0
	let stopReason = null
	let loops = 0

	await applyFastMiningSetup({ bot, rcon: commandBus })
	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}

	async function loadPositions() {
		rescans += 1
		return await findObjectBlocks({
			bot,
			objectEvent: {
				...objectEvent,
				mode: 'allFlagBlocks',
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
		return false
	}

	async function gravitySettle() {
		console.log('[HUMAN_MINING] gravity settle')
		await sleep(cfg.gravitySettleDelayMs ?? 180)
	}

	const maxPasses = cfg.maxPasses ?? 8
	const burstsPerSide = cfg.burstsPerSide ?? 2

	for (let pass = 1; pass <= maxPasses; pass++) {
		if (objectEvent?.cancelled) {
			stopReason = 'cancelled'
			break
		}
		if (timedOut()) break

		loops = pass
		let blocks = await loadPositions()
		console.log(`[HUMAN_MINING] pass=${pass} blocks=${blocks.length}`)

		if (!blocks.length) {
			leftovers = 0
			console.log(`[HUMAN_MINING] finished broken=${broken}`)
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

		const bounds = calculateBounds(blocks)
		if (!bounds) break

		const lookTarget = boundsCenter(bounds)
		if (cfg.cameraLockEnabled) setCameraTarget(lookTarget)

		const baseSides = onePositionPerSide(getOutsideBreakPositions({ bounds }))
		const outsidePositions = addHighFrontPosition(baseSides, bounds)

		for (const sideTarget of outsidePositions) {
			if (objectEvent?.cancelled) {
				stopReason = 'cancelled'
				break
			}
			if (timedOut()) break

			const { side, position } = sideTarget
			console.log(`[HUMAN_MINING] moving side=${side}`)

			const route =
				side === 'top/front-high'
					? [position]
					: createOutsideRoute({
							fromSide: currentSide,
							toSide: side,
							outsidePositions,
					  })
			const waypoints = route.length ? route : [position]

			for (const waypoint of waypoints) {
				console.log(`[MOVE] waypoint ${formatPos(waypoint)}`)
				currentPosition = await cinematicFlyTo({
					bot,
					rcon: commandBus,
					from: currentPosition || bot.entity.position,
					to: waypoint,
					lookTarget,
					bounds,
					options: cfg,
				}).catch(() => currentPosition || waypoint)
			}
			currentSide = SIDE_ORDER.includes(side) ? side : 'front'

			if (cfg.sidePauseMs > 0) await sleep(cfg.sidePauseMs)

			for (let burstIndex = 1; burstIndex <= burstsPerSide; burstIndex++) {
				if (objectEvent?.cancelled) {
					stopReason = 'cancelled'
					break
				}
				if (timedOut()) break

				blocks = await loadPositions()
				if (!blocks.length) {
					leftovers = 0
					console.log(`[HUMAN_MINING] finished broken=${broken}`)
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

				const freshBounds = calculateBounds(blocks) || bounds
				const maxBlocks = randInt(
					cfg.minBlocksPerBurst ?? 6,
					cfg.maxBlocksPerBurst ?? 10
				)
				const visibleBlocks = liveVisiblePositions(bot, blocks)
				const selected = selectHumanMiningBurst({
					blocks: visibleBlocks,
					botPosition: bot.entity.position,
					bounds: freshBounds,
					maxBlocks,
					maxReachDistance: cfg.maxReachDistance ?? 4.5,
				})

				console.log(
					`[HUMAN_MINING] side=${side} burst=${burstIndex} selected=${selected.length}`
				)

				if (!selected.length) break

				const result = await mineBurstHumanLike({
					bot,
					rcon: commandBus,
					blocks: selected,
					options: cfg,
					blocksLeft: blocks.length,
					onProgress: progress => {
						onProgress?.(progress)
					},
				})

				broken += result.broken
				fallbackBroken += result.fallbackBroken
				skippedAir += result.skippedAir

				console.log(
					`[HUMAN_MINING] broken=${result.broken} skippedAir=${result.skippedAir}`
				)

				await gravitySettle()
			}
		}

		if (cfg.passPauseMs > 0) await sleep(cfg.passPauseMs)
	}

	const finalPositions = await loadPositions()
	leftovers = finalPositions.length

	if (leftovers > 0) {
		console.log(`[HUMAN_MINING] fallback cleanup leftovers=${leftovers}`)
		fallbackBroken += await fallbackCleanup({
			bot,
			rcon: commandBus,
			positions: finalPositions,
		})
		leftovers = (await loadPositions()).length
	}

	console.log(`[HUMAN_MINING] finished broken=${broken}`)

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
	humanLikeMineFlag,
}
