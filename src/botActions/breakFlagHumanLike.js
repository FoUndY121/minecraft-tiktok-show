const { Vec3 } = require('vec3')
const { safeRconCommand } = require('../rcon')
const { flyToPosition } = require('../bot/movement/flyToPosition')
const reactions = require('../bot/reactions')
const defaultBehavior = require('../config/botBehavior')

const FLAG_BLOCKS = [
	'black_wool',
	'blue_wool',
	'gold_block',
	'green_wool',
	'red_wool',
	'sea_lantern',
	'white_wool',
	'yellow_wool',
]

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function rand(min, max) {
	return min + Math.random() * (max - min)
}

function centerOfBox(box) {
	return new Vec3(
		(box.x1 + box.x2 + 1) / 2,
		(box.y1 + box.y2 + 1) / 2,
		(box.z1 + box.z2 + 1) / 2
	)
}

function viewPositionForChunk(flagEvent, chunk, sideOffsetZ) {
	const center = centerOfBox(chunk)
	return new Vec3(
		center.x + rand(-0.6, 0.6),
		center.y + rand(-0.35, 0.55),
		flagEvent.origin.z + sideOffsetZ
	)
}

function createChunks(flagEvent, options) {
	const chunks = []
	const origin = flagEvent.origin
	const width = flagEvent.width
	const height = flagEvent.height
	const depth = flagEvent.depth || 1
	const chunkWidth = options.breakChunkWidth || 4
	const chunkHeight = options.breakChunkHeight || 3

	for (let y = origin.y + height - 1; y >= origin.y; y -= chunkHeight) {
		for (let z = origin.z; z < origin.z + depth; z++) {
			for (let x = origin.x; x < origin.x + width; x += chunkWidth) {
				chunks.push({
					x1: x,
					y1: Math.max(origin.y, y - chunkHeight + 1),
					z1: z,
					x2: Math.min(origin.x + width - 1, x + chunkWidth - 1),
					y2: y,
					z2: z,
				})
			}
		}
	}

	return chunks
}

async function givePickaxe(bot, rcon) {
	if (!bot?.username) return

	try {
		await safeRconCommand(rcon, `give ${bot.username} minecraft:diamond_pickaxe 1`)
		await sleep(120)
		const item = bot.inventory.items().find(i => i.name === 'diamond_pickaxe')
		if (item) await bot.equip(item, 'hand')
	} catch (err) {
		console.log('⚠️ give/equip pickaxe failed:', err?.message || err)
	}
}

async function prepareBot(bot, rcon) {
	if (!bot?.username) return

	try {
		await safeRconCommand(rcon, `gamemode creative ${bot.username}`)
		await safeRconCommand(rcon, `effect give ${bot.username} minecraft:haste 999999 40 true`)
		await safeRconCommand(rcon, `effect give ${bot.username} minecraft:speed 999999 18 true`)
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch (err) {
		console.log('⚠️ prepareBot failed:', err?.message || err)
	}
}

async function lookAtChunk(bot, chunk, intensity) {
	const target = centerOfBox(chunk).offset(rand(-intensity, intensity), rand(-intensity, intensity), rand(-intensity, intensity))
	try {
		await bot.lookAt(target, false)
		bot.swingArm('right')
	} catch {}
}

async function clearChunk(rcon, chunk) {
	for (const block of FLAG_BLOCKS) {
		await safeRconCommand(
			rcon,
			`fill ${chunk.x1} ${chunk.y1} ${chunk.z1} ${chunk.x2} ${chunk.y2} ${chunk.z2} minecraft:air replace minecraft:${block}`
		)
	}
}

async function playChunkEffects(rcon, chunk) {
	const center = centerOfBox(chunk)
	await safeRconCommand(
		rcon,
		`particle minecraft:block minecraft:white_wool ${center.x.toFixed(2)} ${center.y.toFixed(2)} ${center.z.toFixed(2)} 0.8 0.5 0.8 0.04 20 force`
	)
	await safeRconCommand(
		rcon,
		`playsound minecraft:block.wool.break block @a ${center.x.toFixed(2)} ${center.y.toFixed(2)} ${center.z.toFixed(2)} 0.45 ${rand(0.8, 1.25).toFixed(2)}`
	)
}

async function cleanupFlagArea(rcon, flagEvent) {
	const origin = flagEvent.origin
	const x2 = origin.x + flagEvent.width - 1
	const y2 = origin.y + flagEvent.height - 1
	const z2 = origin.z + (flagEvent.depth || 1) - 1

	for (const block of FLAG_BLOCKS) {
		await safeRconCommand(
			rcon,
			`fill ${origin.x} ${origin.y} ${origin.z} ${x2} ${y2} ${z2} minecraft:air replace minecraft:${block}`
		)
	}
}

async function shortReaction(bot, flagEvent, options) {
	const tier = flagEvent.giftTier || 'small'
	const bigFlag = flagEvent.width * flagEvent.height * (flagEvent.depth || 1) >= 450

	if (tier === 'large') {
		await reactions.sadLookDown(bot, options.reactionLongMs)
	} else if (tier === 'medium' || bigFlag) {
		await reactions.panicShakeCamera(bot, options.reactionShortMs, options.cameraShakeIntensity)
	} else {
		await reactions.angryShakeCamera(bot, options.reactionShortMs, options.cameraShakeIntensity)
	}
}

async function breakFlagHumanLike({ bot, rcon, flagEvent, botBrain = null, options = {} }) {
	const cfg = { ...defaultBehavior, ...options }
	const commandBus = rcon || bot
	const chunks = createChunks(flagEvent, cfg)
	let sideOffsetZ = cfg.breakSideOffsetZ || 4
	let brokenChunks = 0

	try {
		await prepareBot(bot, commandBus)
		await givePickaxe(bot, commandBus)

		const firstView = viewPositionForChunk(
			flagEvent,
			{
				x1: flagEvent.origin.x,
				y1: flagEvent.origin.y,
				z1: flagEvent.origin.z,
				x2: flagEvent.origin.x + flagEvent.width - 1,
				y2: flagEvent.origin.y + flagEvent.height - 1,
				z2: flagEvent.origin.z + (flagEvent.depth || 1) - 1,
			},
			sideOffsetZ
		)

		await flyToPosition(bot, firstView, {
			commandBus,
			speed: cfg.flightSpeed,
			intervalMs: cfg.flightIntervalMs,
			stopDistance: cfg.flightStopDistance,
			lookAtTarget: true,
		})
		await reactions.lookAtNewFlag(bot, flagEvent)
		await shortReaction(bot, flagEvent, cfg)

		for (let i = 0; i < chunks.length; i++) {
			const chunk = chunks[i]

			if (i > 0 && i % cfg.breakMoveEveryChunks === 0) {
				sideOffsetZ = cfg.breakSideOffsetZ || sideOffsetZ
				await flyToPosition(bot, viewPositionForChunk(flagEvent, chunk, sideOffsetZ), {
					commandBus,
					speed: cfg.flightSpeed * 1.2,
					intervalMs: cfg.flightIntervalMs,
					stopDistance: cfg.flightStopDistance,
					lookAtTarget: true,
					timeoutMs: 1800,
				})
			}

			await lookAtChunk(bot, chunk, cfg.cameraShakeIntensity)
			await clearChunk(commandBus, chunk)
			await playChunkEffects(commandBus, chunk)
			brokenChunks += 1
			await sleep(cfg.breakDelayMs + Math.floor(rand(0, 16)))
		}

		await cleanupFlagArea(commandBus, flagEvent)
		if (botBrain?.celebrate) await botBrain.celebrate(cfg.reactionShortMs)
		else await reactions.nodYes(bot, cfg.reactionShortMs)

		return { ok: true, brokenChunks }
	} catch (err) {
		console.log('❌ breakFlagHumanLike failed:', err?.message || err)
		try {
			await cleanupFlagArea(commandBus, flagEvent)
		} catch (cleanupErr) {
			console.log('⚠️ flag cleanup after failed break failed:', cleanupErr?.message || cleanupErr)
		}
		return { ok: false, brokenChunks, error: err?.message || String(err) }
	}
}

module.exports = {
	breakFlagHumanLike,
}
