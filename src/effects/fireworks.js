const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')

const COLORS = [
	11743532,
	15435844,
	14602026,
	4312372,
	6719955,
	15790320,
	12801229,
	8073150,
	14188339,
]

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function randomColor() {
	return COLORS[randInt(0, COLORS.length - 1)]
}

function fireworkNbt() {
	const color = randomColor()
	const fade = randomColor()

	return `{LifeTime:${randInt(14, 24)},FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:1b,Explosions:[{Type:${randInt(0, 4)}b,Flicker:1b,Trail:1b,Colors:[I;${color}],FadeColors:[I;${fade}]}]}}}}`
}

async function launchFirework({ rcon, x, y, z }) {
	await safeSend(rcon, `/summon firework_rocket ${x} ${y} ${z} ${fireworkNbt()}`)
}

async function spawnFireworksAroundObject({ rcon, objectEvent, count = 3, delayMs = 120 } = {}) {
	const fireworkCount = Math.max(0, Math.min(4, Number(count) || 3))
	const origin = objectEvent?.origin || ARENA.origin
	const width = objectEvent?.width || ARENA.width
	const depth = objectEvent?.depth || ARENA.depth
	const baseY = (objectEvent?.spawnHeight || ARENA.spawnHeight) + (objectEvent?.height || ARENA.height)

	for (let i = 0; i < fireworkCount; i++) {
		const x = origin.x + randInt(-2, width + 1)
		const y = baseY + randInt(0, 4)
		const z = origin.z + randInt(-2, depth + 1)
		await launchFirework({ rcon, x, y, z })
		await delay(randInt(50, delayMs))
	}
}

async function fireworksBurst({ rcon, objectEvent, min, max, delayMs = 120 } = {}) {
	const count = randInt(
		min ?? behavior.fireworksPerSpawn.min,
		max ?? behavior.fireworksPerSpawn.max
	)
	await spawnFireworksAroundObject({ rcon, objectEvent, count, delayMs })
}

module.exports = {
	spawnFireworksAroundObject,
	fireworksBurst,
	launchFirework,
}
