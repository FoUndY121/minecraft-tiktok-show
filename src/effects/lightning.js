const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function randAround(value, radius) {
	return value + randInt(-radius, radius)
}

async function spawnLightningAroundObject({ rcon, objectEvent, count = 3, radius = 5 } = {}) {
	const lightningCount = Math.max(0, Math.min(3, Number(count) || 3))
	const origin = objectEvent?.origin || ARENA.origin

	for (let i = 0; i < lightningCount; i++) {
		const x = randAround(origin.x + Math.floor((objectEvent?.width || ARENA.width) / 2), radius)
		const z = randAround(origin.z + Math.floor((objectEvent?.depth || ARENA.depth) / 2), radius)
		await safeSend(rcon, `/summon lightning_bolt ${x} ${ARENA.groundY} ${z}`)
		await delay(randInt(70, 160))
	}
}

async function lightningBurst({ rcon, objectEvent, min, max, radius = 5 } = {}) {
	const count = randInt(
		min ?? behavior.lightningPerSpawn.min,
		max ?? behavior.lightningPerSpawn.max
	)
	await spawnLightningAroundObject({ rcon, objectEvent, count, radius })
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
