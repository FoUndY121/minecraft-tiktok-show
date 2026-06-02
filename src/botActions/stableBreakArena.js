const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { smoothLookAt } = require('../bot/camera/smoothLookAt')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const { getSafeOutsidePosition } = require('../bot/movement/getSafeOutsidePosition')
const { cinematicMoveOutside } = require('../bot/movement/cinematicMoveOutside')
const { isBotInsideFlagArea } = require('../bot/movement/isBotInsideFlagArea')
const { escapeFlagArea } = require('../bot/movement/escapeFlagArea')
const { scanFlagBlocksInArena } = require('../core/scanFlagBlocksInArena')
const { applyFastMiningSetup } = require('../bot/setup/applyFastMiningSetup')
const { playBlockBreakVisuals } = require('../effects/blockBreakVisuals')
const { selectSurfaceBlocks } = require('./selectSurfaceBlocks')

const SIDE_ORDER = ['front', 'right', 'back', 'left']

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function vecCenter(pos) {
	return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
}

function isLiveFlagBlock(block) {
	return block && block.name !== 'air' && FLAG_BLOCKS.has(block.name)
}

function isInsideBounds(position, bounds) {
	return (
		position.x >= bounds.minX &&
		position.x <= bounds.maxX + 1 &&
		position.y >= bounds.minY &&
		position.y <= bounds.maxY + 1 &&
		position.z >= bounds.minZ &&
		position.z <= bounds.maxZ + 1
	)
}

function distance(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function distanceToCenter(pos, bounds) {
	return (
		Math.abs(pos.x + 0.5 - bounds.centerX) +
		Math.abs(pos.y + 0.5 - bounds.centerY) +
		Math.abs(pos.z + 0.5 - bounds.centerZ)
	)
}

function nextSide(side) {
	const index = SIDE_ORDER.indexOf(side)
	if (index < 0) return 'front'
	return SIDE_ORDER[(index + 1) % SIDE_ORDER.length]
}

function uniquePositions(positions) {
	const seen = new Set()
	const out = []
	for (const pos of positions) {
		const key = `${pos.x},${pos.y},${pos.z}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(pos)
	}
	return out
}

function chooseSurfaceBurst({ surfaceBlocks, bounds, botPosition, maxBlocks }) {
	const byCenter = [...surfaceBlocks].sort(
		(a, b) => distanceToCenter(a, bounds) - distanceToCenter(b, bounds)
	)
	const byTop = [...surfaceBlocks].sort(
		(a, b) => b.y - a.y || distanceToCenter(a, bounds) - distanceToCenter(b, bounds)
	)
	const byBottom = [...surfaceBlocks].sort(
		(a, b) => a.y - b.y || distanceToCenter(a, bounds) - distanceToCenter(b, bounds)
	)
	const byNearby = [...surfaceBlocks].sort(
		(a, b) =>
			distance(botPosition, vecCenter(a)) -
				distance(botPosition, vecCenter(b)) +
			(Math.random() - 0.5) * 0.3
	)

	return uniquePositions([
		...byCenter.slice(0, randInt(3, 4)),
		...byTop.slice(0, randInt(2, 3)),
		...byBottom.slice(0, randInt(2, 3)),
		...byNearby,
	]).slice(0, maxBlocks)
}

async function stableBreakArena({
	bot,
	rcon,
	objectEvent,
	onProgress = null,
	options = behavior,
	arena = ARENA,
} = {}) {
	const cfg = options
	const commandBus = rcon || bot
	const startedAt = Date.now()
	const maxPasses = cfg.maxStableBreakPasses ?? cfg.maxPasses ?? 12
	const maxEventMs = cfg.maxStableBreakEventMs ?? cfg.maxEventMs ?? 90000
	const maxReachDistance = cfg.maxReachDistance ?? 5.0
	const burstMin = cfg.blocksPerBurstMin ?? 5
	const burstMax = cfg.blocksPerBurstMax ?? 8
	const burstsBeforeSideChange = cfg.burstsBeforeSideChange ?? 4
	const useTopSideOnlyAfterPass = cfg.useTopSideOnlyAfterPass ?? 4
	const outsideDistance = cfg.outsideDistance ?? 2.1
	const preBreakLookMs = cfg.preBreakLookMs ?? 60
	const swingPauseMs = cfg.swingPauseMs ?? 80
	const blockBreakDelayMs = cfg.blockBreakDelayMs ?? 55
	const burstPauseMs = cfg.burstPauseMs ?? 300
	const sideChangePauseMs = cfg.sideChangePauseMs ?? 500
	const gravitySettleDelayMs = cfg.gravitySettleDelayMs ?? 250
	const maxBurstsPerPass = burstsBeforeSideChange * SIDE_ORDER.length
	const scanMode = 'event'

	let activeSide = 'front'
	let burstsOnCurrentSide = 0
	let noProgressBurstsOnSide = 0
	let normalSidesWithoutProgress = 0
	let currentOutsidePosition = bot?.entity?.position
		? new Vec3(bot.entity.position.x, bot.entity.position.y, bot.entity.position.z)
		: null
	let currentOutsideSide = null

	let broken = 0
	let skipped = 0
	let tooFarSkipped = 0
	let rescans = 0
	let leftovers = 0
	let passes = 0
	let brokenCount = 0
	let lastProgressAt = Date.now()
	let stopReason = null

	console.log(`[BREAK] start id=${objectEvent?.id || 'unknown'}`)

	await applyFastMiningSetup({ bot, rcon: commandBus })
	try {
		if (bot?.creative?.startFlying) bot.creative.startFlying()
	} catch {}

	function timedOut() {
		if (Date.now() - startedAt <= maxEventMs) return false
		stopReason = 'max_event_ms'
		return true
	}

	function selectNextSide({ allowTop = false } = {}) {
		if (allowTop && activeSide !== 'top') return 'top'
		if (activeSide === 'top') return 'front'
		return nextSide(activeSide)
	}

	async function scanLiveBlocks() {
		const blocks = await scanFlagBlocksInArena({
			bot,
			arena,
			objectEvent,
			mode: scanMode,
		})
		rescans += 1
		leftovers = blocks.length
		return blocks
	}

	function changeSide(next, reason) {
		if (next === activeSide) return
		console.log(`[BREAK] changing side ${activeSide} -> ${next}`)
		if (reason === 'empty') {
			console.log('[BREAK] side surface empty, changing side')
		}
		activeSide = next
		burstsOnCurrentSide = 0
		noProgressBurstsOnSide = 0
	}

	async function escapeFlagAreaIfNeeded({ blocks = null, bounds = null } = {}) {
		const liveBlocks = blocks || (await scanLiveBlocks())
		const liveBounds = bounds || calculateBounds(liveBlocks)
		if (!liveBounds) return { escaped: false, blocks: liveBlocks, bounds: null }

		if (
			!isBotInsideFlagArea({
				bot,
				bounds: liveBounds,
			})
		) {
			return { escaped: false, blocks: liveBlocks, bounds: liveBounds }
		}

		const lookTarget = new Vec3(
			liveBounds.centerX,
			liveBounds.centerY,
			liveBounds.centerZ
		)
		const escaped = await escapeFlagArea({
			bot,
			rcon: commandBus,
			bounds: liveBounds,
			lookTarget,
		})

		if (escaped?.position) {
			currentOutsidePosition = escaped.position
			currentOutsideSide = escaped.side
		}

		return { escaped: true, blocks: liveBlocks, bounds: liveBounds }
	}

	async function recoverNoProgressIfNeeded() {
		if (Date.now() - lastProgressAt <= 8000) return { finish: false }

		console.log('[BREAK] no progress for 8s, rescan current event')
		const blocks = await scanLiveBlocks()
		if (!blocks.length) {
			stopReason = stopReason || 'no_blocks_after_no_progress'
			return { finish: true, blocks }
		}

		const bounds = calculateBounds(blocks)
		await escapeFlagAreaIfNeeded({ blocks, bounds })
		changeSide(selectNextSide(), 'no_progress')
		lastProgressAt = Date.now()
		return { finish: false, blocks, bounds }
	}

	async function retryFirstPassZeroBlocks(blocks) {
		if (blocks.length > 0) return blocks

		for (let attempt = 1; attempt <= 10; attempt++) {
			console.log(`[BREAK] pass=1 found 0 blocks, retrying scan ${attempt}/10`)
			await delay(300)
			const retryBlocks = await scanLiveBlocks()
			if (retryBlocks.length > 0) {
				console.log(`[BREAK] retry found ${retryBlocks.length} blocks`)
				return retryBlocks
			}
		}

		console.log('[BREAK] retry found 0 blocks')
		return []
	}

	try {
		const initialBlocks = await scanLiveBlocks()
		await escapeFlagAreaIfNeeded({ blocks: initialBlocks })

		for (let pass = 1; pass <= maxPasses; pass++) {
			passes = pass
			if (objectEvent?.cancelled) {
				stopReason = 'cancelled'
				break
			}
			if (timedOut()) break
			if ((await recoverNoProgressIfNeeded()).finish) break

			let blocks = await scanLiveBlocks()
			if (pass === 1) blocks = await retryFirstPassZeroBlocks(blocks)
			await escapeFlagAreaIfNeeded({ blocks })
			console.log(`[BREAK] pass=${pass} blocks=${blocks.length}`)
			if (!blocks.length) break

			for (let burstLoop = 0; burstLoop < maxBurstsPerPass; burstLoop++) {
				if (objectEvent?.cancelled) {
					stopReason = 'cancelled'
					break
				}
				if (timedOut()) break
				if ((await recoverNoProgressIfNeeded()).finish) break

				blocks = await scanLiveBlocks()
				await escapeFlagAreaIfNeeded({ blocks })
				if (!blocks.length) break

				const bounds = calculateBounds(blocks)
				if (!bounds) break

				const lookTarget = new Vec3(bounds.centerX, bounds.centerY, bounds.centerZ)
				await escapeFlagAreaIfNeeded({ blocks, bounds })
				const safePosition = getSafeOutsidePosition({
					bounds,
					arena,
					side: activeSide,
					outsideDistance,
				})
				if (!safePosition || isInsideBounds(safePosition, bounds)) {
					changeSide(selectNextSide(), 'empty')
					continue
				}

				const surfaceBlocks = selectSurfaceBlocks({ blocks, side: activeSide })
				if (!surfaceBlocks.length) {
					normalSidesWithoutProgress += activeSide === 'top' ? 0 : 1
					const shouldTryTop =
						pass >= useTopSideOnlyAfterPass &&
						normalSidesWithoutProgress >= SIDE_ORDER.length
					changeSide(selectNextSide({ allowTop: shouldTryTop }), 'empty')
					continue
				}

				if (
					currentOutsideSide !== activeSide ||
					!currentOutsidePosition ||
					distance(currentOutsidePosition, safePosition) > 0.65
				) {
					currentOutsidePosition = await cinematicMoveOutside({
						bot,
						rcon: commandBus,
						fromPosition: currentOutsidePosition || bot.entity.position,
						toPosition: safePosition,
						lookTarget,
						bounds,
						options: cfg,
					}).catch(() => currentOutsidePosition || safePosition)
					currentOutsideSide = activeSide
					await escapeFlagAreaIfNeeded({ blocks, bounds })
					await delay(sideChangePauseMs)
				}

				await escapeFlagAreaIfNeeded({ blocks, bounds })
				const burstSize = randInt(burstMin, burstMax)
				const burst = chooseSurfaceBurst({
					surfaceBlocks,
					bounds,
					botPosition: currentOutsidePosition || safePosition,
					maxBlocks: burstSize,
				})
				let burstBroken = 0
				let burstTooFar = 0

				for (const pos of burst) {
					if (objectEvent?.cancelled) {
						stopReason = 'cancelled'
						break
					}
					if (timedOut()) break
					if ((await recoverNoProgressIfNeeded()).finish) break

					let liveBlock = bot.blockAt(pos)
					if (!isLiveFlagBlock(liveBlock)) {
						skipped += 1
						continue
					}

					const blockCenter = vecCenter(liveBlock.position)
					if (bot.entity.position.distanceTo(blockCenter) > maxReachDistance) {
						tooFarSkipped += 1
						burstTooFar += 1
						continue
					}

					if (cfg.cameraLockEnabled) setCameraTarget(blockCenter)
					await smoothLookAt(bot, blockCenter, {
						durationMs: cfg.lookSmoothDurationMs ?? 120,
						steps: cfg.lookSmoothSteps ?? 5,
					})
					await delay(preBreakLookMs)

					liveBlock = bot.blockAt(pos)
					if (!isLiveFlagBlock(liveBlock)) {
						skipped += 1
						continue
					}
					if (bot.entity.position.distanceTo(blockCenter) > maxReachDistance) {
						tooFarSkipped += 1
						burstTooFar += 1
						continue
					}

					try {
						bot.swingArm('right')
					} catch {}
					await delay(swingPauseMs)

					liveBlock = bot.blockAt(pos)
					if (!isLiveFlagBlock(liveBlock)) {
						skipped += 1
						continue
					}

					await safeSend(
						commandBus,
						`/setblock ${liveBlock.position.x} ${liveBlock.position.y} ${liveBlock.position.z} minecraft:air`
					)
					await playBlockBreakVisuals({
						rcon: commandBus,
						blockName: liveBlock.name,
						position: blockCenter,
					})
					broken += 1
					brokenCount += 1
					burstBroken += 1
					lastProgressAt = Date.now()
					onProgress?.({
						broken,
						block: liveBlock,
						fallback: true,
					})
					await delay(blockBreakDelayMs)
				}

				await escapeFlagAreaIfNeeded({ blocks, bounds })
				console.log(
					`[BREAK] side=${activeSide} burst=${burstsOnCurrentSide + 1} selected=${burst.length} broken=${burstBroken}`
				)

				await delay(burstPauseMs)
				await delay(gravitySettleDelayMs)
				console.log('[BREAK] rescan after gravity')

				blocks = await scanLiveBlocks()
				await escapeFlagAreaIfNeeded({ blocks })
				if (!blocks.length) break

				if (burstBroken > 0) {
					normalSidesWithoutProgress = 0
					burstsOnCurrentSide += 1
					noProgressBurstsOnSide = 0
				} else if (activeSide !== 'top') {
					normalSidesWithoutProgress += 1
					noProgressBurstsOnSide += 1
				}

				if (activeSide === 'top') {
					changeSide('front')
					continue
				}

				if (noProgressBurstsOnSide >= 2) {
					const shouldTryTop =
						pass >= useTopSideOnlyAfterPass &&
						normalSidesWithoutProgress >= SIDE_ORDER.length
					changeSide(selectNextSide({ allowTop: shouldTryTop }))
				} else if (burstsOnCurrentSide >= burstsBeforeSideChange) {
					const shouldTryTop =
						pass >= useTopSideOnlyAfterPass &&
						normalSidesWithoutProgress >= SIDE_ORDER.length
					changeSide(selectNextSide({ allowTop: shouldTryTop }))
				}

			}
		}
	} catch (err) {
		stopReason = 'error'
		console.error('[BREAK] error:', err?.message || err)
	} finally {
		if (Date.now() - startedAt > maxEventMs && !stopReason) {
			stopReason = 'max_event_ms'
		}
	}

	const remaining = await scanLiveBlocks()
	leftovers = remaining.length
	if (leftovers > 0) {
		console.log(`[BREAK] event leftovers remain=${leftovers}, finishing event safely`)
	}

	if (tooFarSkipped > 0) console.log(`[BREAK] skippedTooFar=${tooFarSkipped}`)
	console.log(`[BREAK] finish broken=${broken} leftovers=${leftovers}`)
	return {
		ok: stopReason !== 'cancelled',
		cancelled: stopReason === 'cancelled',
		broken,
		fallbackBroken: broken,
		skippedAir: skipped,
		tooFarSkipped,
		rescans,
		leftovers: Math.max(0, leftovers),
		passes,
		loops: passes,
		stopReason,
	}
}

module.exports = {
	stableBreakArena,
}
