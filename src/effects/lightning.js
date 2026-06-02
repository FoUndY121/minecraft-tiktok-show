const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { markArenaDirty } = require('../core/arenaDirty')
const { scanFlagBlocksInArena } = require('../core/scanFlagBlocksInArena')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const { removeRandomFlagBlocksNear } = require('./removeRandomFlagBlocksNear')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function randAround(value, radius) {
	return value + randInt(-radius, radius)
}

async function getLightningTarget({ bot, objectEvent } = {}) {
	if (bot?.blockAt) {
		const blocks = await scanFlagBlocksInArena({
			bot,
			arena: ARENA,
			objectEvent,
			mode: objectEvent ? 'event' : 'cleanup',
		})
		const bounds = calculateBounds(blocks)
		if (bounds) {
			return {
				x: bounds.centerX,
				y: bounds.centerY,
				z: bounds.centerZ,
			}
		}
	}

	const origin = objectEvent?.origin || ARENA.origin
	return {
		x: origin.x + Math.floor((objectEvent?.width || ARENA.width) / 2),
		y: origin.y + Math.floor((objectEvent?.height || ARENA.height) / 2),
		z: origin.z + Math.floor((objectEvent?.depth || ARENA.depth) / 2),
	}
}

async function spawnLightningAroundObject({
	bot,
	rcon,
	objectEvent,
	count = 3,
	radius = 5,
	removeBlocks = false,
	removeCount = 5,
} = {}) {
	const commandBus = rcon || bot
	const lightningCount = Math.max(0, Math.min(4, Number(count) || 3))
	const target = await getLightningTarget({ bot, objectEvent })

	for (let i = 0; i < lightningCount; i++) {
		const x = randAround(Math.floor(target.x), radius)
		const z = randAround(Math.floor(target.z), radius)
		const y = Math.floor(target.y)
		await safeSend(commandBus, `/particle minecraft:electric_spark ${x} ${y} ${z} 0.4 1.8 0.4 0.08 80 force`)
		await safeSend(commandBus, `/particle minecraft:flash ${x} ${y + 1} ${z} 0 0 0 0 1 force`)
		await safeSend(commandBus, `/playsound minecraft:entity.lightning_bolt.thunder master @a ${x} ${y} ${z} 0.7 0.9`)
		if (removeBlocks) {
			await removeRandomFlagBlocksNear({
				bot,
				rcon: commandBus,
				center: { x, y, z },
				radius: 4,
				count: removeCount,
			})
		}
		await delay(randInt(70, 160))
	}
	markArenaDirty(removeBlocks ? 'lightning_flag_cleanup' : 'visual_lightning')
}

async function lightningBurst({ bot, rcon, objectEvent, min, max, radius = 5 } = {}) {
	const count = randInt(
		min ?? behavior.lightningPerSpawn.min,
		max ?? behavior.lightningPerSpawn.max
	)
	await spawnLightningAroundObject({
		bot,
		rcon,
		objectEvent,
		count,
		radius,
		removeBlocks: Boolean(bot?.blockAt),
		removeCount: 5,
	})
}

async function thunderSounds({ rcon, objectEvent } = {}) {
	const origin = objectEvent?.origin || ARENA.origin
	const x = origin.x + Math.floor((objectEvent?.width || ARENA.width) / 2)
	const y = ARENA.groundY + 3
	const z = origin.z + Math.floor((objectEvent?.depth || ARENA.depth) / 2)

	await safeSend(rcon, `/playsound minecraft:entity.lightning_bolt.thunder master @a ${x} ${y} ${z} 0.7 0.8`)
	await safeSend(rcon, `/playsound minecraft:entity.generic.explode master @a ${x} ${y} ${z} 0.45 0.75`)
	await safeSend(rcon, `/playsound minecraft:block.beacon.activate master @a ${x} ${y} ${z} 0.55 1.25`)
}

module.exports = {
	spawnLightningAroundObject,
	lightningBurst,
	thunderSounds,
}
