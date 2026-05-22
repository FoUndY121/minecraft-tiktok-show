const { safeRconCommand } = require('../rcon')

function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}

function getNearBotBlockPos(bot, { dx = 3, dz = 0 } = {}) {
	const pos = bot?.entity?.position
	if (!pos) return null
	return {
		x: Math.floor(pos.x) + dx,
		y: Math.floor(pos.y),
		z: Math.floor(pos.z) + dz,
	}
}

async function spawnFlag({ rcon, bot, color = 'blue', label = 'FLAG' }) {
	const base = getNearBotBlockPos(bot, { dx: 3, dz: 0 })
	if (!base) return null

	// MVP "flag": 1x3 column + a top block as "banner".
	// Using wool because it's available and simple.
	const block = `${color}_wool`

	for (let i = 0; i < 3; i++) {
		const cmd = `setblock ${base.x} ${base.y + i} ${base.z} minecraft:${block}`
		if (rcon) await safeRconCommand(rcon, cmd)
		else if (bot) bot.chat(`/${cmd}`)
		await sleep(120) // don't spam commands too fast
	}

	const announce = `say [TikTokShow] Gift → ${label} flag spawned at ${base.x} ${base.y} ${base.z}`
	if (rcon) await safeRconCommand(rcon, announce)
	else if (bot) bot.chat(`/${announce}`)

	return base
}

module.exports = {
	spawnFlag,
}
