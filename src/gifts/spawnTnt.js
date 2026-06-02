const { safeRconCommand } = require('../rcon')
const { Vec3 } = require('vec3')
const {
	removeOnlyFlagBlocksInRadius,
} = require('../effects/removeOnlyFlagBlocksInRadius')

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

async function breakFlagBlocksNear({ cmd, bot, p, power }) {
	const radius = 2.5
	const maxBlocks = power >= 8 ? 25 : 18

	await safeRconCommand(
		cmd,
		`kill @e[type=minecraft:falling_block,tag=TikTokShowVisualTnt]`
	)

	await removeOnlyFlagBlocksInRadius({
		bot,
		rcon: cmd,
		center: p,
		radius,
		maxBlocks,
	})
}

async function spawnTnt({ rcon, bot, power = 4, botBrain = null }) {
	const p = getNearBotPos(bot)
	if (!p) return null

	const cmd = rcon || bot

	const summon = `summon minecraft:falling_block ${p.x} ${p.y} ${p.z} {BlockState:{Name:"minecraft:tnt"},Time:1,NoGravity:0b,DropItem:0b,Tags:["TikTokShowVisualTnt"]}`
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

	await safeRconCommand(
		cmd,
		'kill @e[type=minecraft:falling_block,tag=TikTokShowVisualTnt]'
	)
	await breakFlagBlocksNear({ cmd, bot, p, power })
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
