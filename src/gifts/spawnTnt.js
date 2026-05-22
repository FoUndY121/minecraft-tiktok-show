const { safeRconCommand } = require('../rcon')
const { Vec3 } = require('vec3')
const { FLAG_BLOCKS } = require('../objects/objectBuilder')

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}

function getNearBotPos(bot, { dx = 0, dz = 3 } = {}) {
	const pos = bot?.entity?.position
	if (!pos) return null
	return {
		x: Math.floor(pos.x) + dx + 0.5,
		y: Math.floor(pos.y) + 1,
		z: Math.floor(pos.z) + dz + 0.5,
	}
}

async function breakFlagBlocksNear(cmd, p, power) {
	const radius = Math.max(3, Math.min(10, Math.ceil(power) + 1))
	const center = {
		x: Math.floor(p.x),
		y: Math.floor(p.y),
		z: Math.floor(p.z),
	}
	const bounds = {
		x1: center.x - radius,
		y1: center.y - radius,
		z1: center.z - radius,
		x2: center.x + radius,
		y2: center.y + radius,
		z2: center.z + radius,
	}

	await safeRconCommand(
		cmd,
		`kill @e[type=minecraft:falling_block,tag=TikTokShowFallingFlag,x=${bounds.x1},y=${bounds.y1},z=${bounds.z1},dx=${radius * 2},dy=${radius * 2},dz=${radius * 2}]`
	)

	for (const block of FLAG_BLOCKS) {
		await safeRconCommand(
			cmd,
			`fill ${bounds.x1} ${bounds.y1} ${bounds.z1} ${bounds.x2} ${bounds.y2} ${bounds.z2} minecraft:air replace minecraft:${block}`
		)
		await sleep(20)
	}
}

async function spawnTnt({ rcon, bot, power = 4, botBrain = null }) {
	const p = getNearBotPos(bot)
	if (!p) return null

	const cmd = rcon || bot

	const summon = `summon minecraft:tnt ${p.x} ${p.y} ${p.z} {Fuse:20,Tags:["TikTokShowTnt"]}`
	await safeRconCommand(cmd, summon)
	try {
		await bot.lookAt(new Vec3(p.x, p.y, p.z), true)
	} catch {}
	if (botBrain?.panicShakeCamera) {
		botBrain.panicShakeCamera(power >= 8 ? 1800 : 1100).catch(err =>
			console.log('⚠️ TNT panic reaction failed:', err?.message || err)
		)
	}

	await sleep(700)

	await safeRconCommand(cmd, 'kill @e[type=minecraft:tnt,tag=TikTokShowTnt]')
	await breakFlagBlocksNear(cmd, p, power)
	await safeRconCommand(
		cmd,
		`particle minecraft:explosion ${p.x} ${p.y} ${p.z} 1.1 1.1 1.1 0.08 24 force`
	)
	await safeRconCommand(
		cmd,
		`particle minecraft:cloud ${p.x} ${p.y} ${p.z} 1.8 1.0 1.8 0.08 45 force`
	)
	await safeRconCommand(
		cmd,
		`playsound minecraft:entity.generic.explode master @a ${p.x} ${p.y} ${p.z} 1.2 0.95`
	)

	const announce = `say [TikTokShow] Gift → TNT broke flag blocks (power=${power})`
	await safeRconCommand(cmd, announce)

	return p
}

module.exports = {
	spawnTnt,
}
