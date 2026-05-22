const { Vec3 } = require('vec3')
const { safeSend } = require('../rcon')
const { tntPanic } = require('../bot/reactions')
const { FLAG_BLOCKS } = require('../objects/objectBuilder')

async function removeOnlyFlagBlocksInRadius(commandBus, { x, y, z, radius = 4 } = {}) {
	const x1 = Math.floor(x - radius)
	const y1 = Math.floor(y - radius)
	const z1 = Math.floor(z - radius)
	const x2 = Math.floor(x + radius)
	const y2 = Math.floor(y + radius)
	const z2 = Math.floor(z + radius)

	for (const block of FLAG_BLOCKS) {
		await safeSend(
			commandBus,
			`/fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} minecraft:air replace minecraft:${block}`
		)
	}
}

async function spawnTntNearBot({ bot, rcon, fuse = 60, source = null, label = null } = {}) {
	const p = bot?.entity?.position
	if (!p) return { ok: false, reason: 'bot has no position' }

	const x = Math.floor(p.x + 2)
	const y = Math.floor(p.y)
	const z = Math.floor(p.z + 2)
	const title = label ? `${label} = TNT!` : null

	if (title) {
		await safeSend(
			rcon || bot,
			`/title @a actionbar {"text":"${title}","color":"red","bold":true}`
		)
	}
	await safeSend(rcon || bot, `/summon tnt ${x} ${y} ${z} {Fuse:${fuse}}`)
	await safeSend(rcon || bot, `/playsound minecraft:entity.creeper.primed master @a ${x} ${y} ${z} 0.9 0.7`)
	await safeSend(rcon || bot, `/particle minecraft:smoke ${x} ${y + 1} ${z} 0.8 0.8 0.8 0.04 30 force`)
	setTimeout(() => {
		removeOnlyFlagBlocksInRadius(rcon || bot, { x, y, z, radius: 5 }).catch(err =>
			console.log('[TNT] flag block cleanup failed:', err?.message || err)
		)
	}, Math.max(250, fuse * 50 + 150))

	try {
		await bot.lookAt(new Vec3(x + 0.5, y + 0.5, z + 0.5), true)
	} catch {}

	tntPanic(bot, 1000).catch(err =>
		console.log('[TNT] panic camera failed:', err?.message || err)
	)

	return { ok: true, x, y, z, source }
}

module.exports = {
	spawnTntNearBot,
	removeOnlyFlagBlocksInRadius,
}
