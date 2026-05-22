const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { lightningBurst } = require('./lightning')
const { fireworksBurst } = require('./fireworks')
const { spawnTntNearBot } = require('./spawnTntNearBot')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function chance(probability) {
	return Math.random() < probability
}

function arenaCenter(objectEvent = null) {
	const origin = objectEvent?.origin || ARENA.origin
	return {
		x: origin.x + Math.floor((objectEvent?.width || ARENA.width) / 2),
		y: ARENA.groundY + 1,
		z: origin.z + Math.floor((objectEvent?.depth || ARENA.depth) / 2),
	}
}

async function weatherDrama({ rcon, durationMs = 9000 } = {}) {
	await safeSend(rcon, '/weather thunder 12')
	await safeSend(rcon, '/time set midnight')
	setTimeout(() => {
		safeSend(rcon, '/weather clear 12').catch(() => {})
	}, durationMs)
}

async function spawnMobNearArena({ rcon, objectEvent, mob = 'creeper' } = {}) {
	const c = arenaCenter(objectEvent)
	const x = c.x + randInt(-6, 6)
	const z = c.z + randInt(-6, 6)
	await safeSend(rcon, `/summon minecraft:${mob} ${x} ${c.y} ${z}`)
}

async function tntRain({ bot, rcon, objectEvent, count = 3 } = {}) {
	const c = arenaCenter(objectEvent)

	for (let i = 0; i < count; i++) {
		const x = c.x + randInt(-5, 5)
		const y = c.y + randInt(9, 15)
		const z = c.z + randInt(-5, 5)
		await safeSend(rcon, `/summon tnt ${x} ${y} ${z} {Fuse:${randInt(35, 70)}}`)
		await delay(randInt(120, 240))
	}

	if (bot?.entity?.position && chance(0.35)) {
		await spawnTntNearBot({ bot, rcon, fuse: 50 })
	}
}

async function weirdEffects({ bot, rcon, durationSeconds = 5 } = {}) {
	if (!bot?.username) return

	const effects = [
		`/effect give ${bot.username} minecraft:blindness ${durationSeconds} 0 true`,
		`/effect give ${bot.username} minecraft:slow_falling ${durationSeconds + 2} 0 true`,
		`/effect give ${bot.username} minecraft:levitation 2 0 true`,
	]
	await safeSend(rcon, effects[randInt(0, effects.length - 1)])
}

async function randomChaos({ bot, rcon, objectEvent, giftValue = 1, forced = false } = {}) {
	const probability = Math.min(0.35, behavior.chaosChance + Math.max(0, giftValue - 1) * 0.015)
	if (!forced && !chance(probability)) return { ok: true, skipped: true }

	const roll = randInt(0, 6)

	try {
		if (roll === 0) await lightningBurst({ rcon, objectEvent, min: 5, max: 8, radius: 8 })
		else if (roll === 1) await fireworksBurst({ rcon, objectEvent, min: 6, max: 10 })
		else if (roll === 2) await spawnMobNearArena({ rcon, objectEvent, mob: 'creeper' })
		else if (roll === 3) await spawnMobNearArena({ rcon, objectEvent, mob: 'zombie' })
		else if (roll === 4) await tntRain({ bot, rcon, objectEvent, count: giftValue >= 20 ? 5 : 3 })
		else if (roll === 5) await weirdEffects({ bot, rcon })
		else await weatherDrama({ rcon })
	} catch (err) {
		console.log('[CHAOS] event failed:', err?.message || err)
	}

	return { ok: true, skipped: false, roll }
}

async function expensiveGiftWeather({ rcon, giftValue = 1 } = {}) {
	if (giftValue < 20) return
	await weatherDrama({ rcon, durationMs: 12000 })
}

module.exports = {
	randomChaos,
	expensiveGiftWeather,
	weatherDrama,
	spawnMobNearArena,
	tntRain,
	weirdEffects,
}
