const { safeSend } = require('../rcon')
const behavior = require('../config/botBehavior')
const { flyToPosition } = require('../bot/movement/flyToPosition')
const { getApproachPosition } = require('../bot/movement/getApproachPosition')
const { smoothLookAt } = require('../bot/camera/smoothLookAt')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { applyFastMiningSetup } = require('../bot/setup/applyFastMiningSetup')
const { getCountryBlock } = require('../objects/objectBuilder')
const { findObjectBlocks } = require('../objects/findObjectBlocks')
const reactions = require('../bot/reactions')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function prepareBot(bot, commandBus) {
	if (!bot?.username) return

	await applyFastMiningSetup({ bot, rcon: commandBus })

	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}
}

function digWithTimeout(bot, block, timeoutMs) {
	return Promise.race([
		bot.dig(block, true),
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(`dig timeout ${timeoutMs}ms`)), timeoutMs)
		),
	])
}

async function fallbackClear(commandBus, blockPosition) {
	await safeSend(
		commandBus,
		`/setblock ${blockPosition.x} ${blockPosition.y} ${blockPosition.z} minecraft:air`
	)
}

async function breakEffects(commandBus, block) {
	const p = block.position.offset(0.5, 0.5, 0.5)
	const blockName = block.name || 'sand'

	await safeSend(
		commandBus,
		`/particle minecraft:block minecraft:${blockName} ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} 0.35 0.35 0.35 0.08 18 force`
	)
	await safeSend(
		commandBus,
		`/particle minecraft:dust 0.9 0.9 0.9 0.9 ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} 0.22 0.22 0.22 0.02 8 force`
	)
	await safeSend(
		commandBus,
		`/playsound minecraft:block.sand.break block @a ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} 0.4 ${(
			0.85 + Math.random() * 0.25
		).toFixed(2)}`
	)
}

async function cameraMicroShake(bot, lookTarget, intensity) {
	const microTarget = lookTarget.offset(
		(Math.random() - 0.5) * intensity,
		(Math.random() - 0.5) * intensity,
		(Math.random() - 0.5) * intensity
	)

	try {
		await bot.lookAt(microTarget, false)
		await delay(20)
		await bot.lookAt(lookTarget, true)
	} catch {}
}

function shouldLogBlock(index) {
	return index < 8 || index % 25 === 0
}

async function breakObjectBlockByBlock({ bot, rcon, objectEvent, options = {} }) {
	const cfg = { ...behavior, ...options }
	const commandBus = rcon || bot
	const targetBlock = getCountryBlock(objectEvent.country)
	const blockPositions = await findObjectBlocks({ bot, objectEvent })
	let broken = 0
	let fallbackBroken = 0

	console.log(`[BOT] Breaking object ${objectEvent.country} id=${objectEvent.id}`)

	if (blockPositions.length === 0) {
		console.log(`[BREAK] No object blocks found for country=${objectEvent.country}`)
		return { ok: true, broken, fallbackBroken }
	}

	await prepareBot(bot, commandBus)
	await reactions.lookAtFallingObject(bot, objectEvent).catch(err =>
		console.log('[BOT] Initial look failed:', err?.message || err)
	)

	for (let i = 0; i < blockPositions.length; i++) {
		const position = blockPositions[i]
		const block = bot?.blockAt ? bot.blockAt(position) : null
		if (!block || block.name === 'air') continue
		if (block.name !== targetBlock) continue

		const lookTarget = block.position.offset(0.5, 0.5, 0.5)
		const approachPos = getApproachPosition(block.position, objectEvent)
		setCameraTarget(lookTarget)

		if (shouldLogBlock(i)) {
			console.log(`[BOT] Looking at block ${position.x} ${position.y} ${position.z}`)
		}

		await smoothLookAt(bot, lookTarget, {
			durationMs: cfg.finalLookDurationMs || 120,
			jitter: 0,
		})

		await flyToPosition(bot, approachPos, {
			rcon: commandBus,
			speed: cfg.flightSpeed,
			intervalMs: cfg.flightIntervalMs,
			stopDistance: cfg.stopDistance,
			lookAt: lookTarget,
			timeoutMs: 2800,
			livingMotion: false,
		})

		await smoothLookAt(bot, lookTarget, {
			durationMs: cfg.lookAtBlockDurationMs,
			jitter: 0,
		})
		await delay(cfg.preBreakPauseMs)

		try {
			await bot.lookAt(lookTarget, true)
		} catch {}

		try {
			bot.swingArm('right')
		} catch {}
		await delay(cfg.swingDelayMs)

		try {
			await smoothLookAt(bot, lookTarget, {
				durationMs: cfg.finalLookDurationMs || 120,
				jitter: 0,
			})
			await bot.lookAt(lookTarget, true)
			await digWithTimeout(bot, block, cfg.maxDigTimeMs)
			broken += 1
			if (shouldLogBlock(i)) console.log('[BOT] Dig success')
		} catch (err) {
			const canFallback = cfg.useDigFallback ?? cfg.fallbackSetBlock
			if (canFallback) {
				await fallbackClear(commandBus, block.position)
				fallbackBroken += 1
				console.log('[BOT] Dig fallback setblock')
			} else {
				console.log('[BOT] Dig failed:', err?.message || err)
			}
		}

		await breakEffects(commandBus, block).catch(err =>
			console.log('[BOT] Break effects failed:', err?.message || err)
		)

		if (cfg.cameraMicroShake) {
			await cameraMicroShake(bot, lookTarget, cfg.cameraShakeIntensity)
		}

		await delay(cfg.afterBreakPauseMs)
		await delay(cfg.breakDelayMs)
	}

	await reactions.celebrate(bot, cfg.reactionShortMs).catch(err =>
		console.log('[BOT] Finish reaction failed:', err?.message || err)
	)

	console.log(
		`[BOT] Finished object ${objectEvent.country} id=${objectEvent.id} broken=${broken} fallback=${fallbackBroken}`
	)

	return { ok: true, broken, fallbackBroken }
}

module.exports = {
	breakObjectBlockByBlock,
	digWithTimeout,
}
