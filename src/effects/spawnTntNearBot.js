const { Vec3 } = require('vec3')
const { safeSend } = require('../rcon')
const { tntPanic } = require('../bot/reactions')
const { FLAG_BLOCKS } = require('../objects/objectBuilder')
const ARENA = require('../config/arena')

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
	await safeSend(
		rcon || bot,
		`/summon tnt ${x} ${y} ${z} {Fuse:${fuse},Tags:["TikTokShowTnt"]}`
	)
	await safeSend(rcon || bot, `/playsound minecraft:entity.creeper.primed master @a ${x} ${y} ${z} 0.9 0.7`)
	await safeSend(rcon || bot, `/particle minecraft:smoke ${x} ${y + 1} ${z} 0.8 0.8 0.8 0.04 30 force`)
	setTimeout(() => {
		const commandBus = rcon || bot
		Promise.resolve()
			.then(() =>
				safeSend(
					commandBus,
					`/kill @e[type=minecraft:tnt,tag=TikTokShowTnt,x=${x - 8},y=${y - 8},z=${z - 8},dx=16,dy=16,dz=16]`
				)
			)
			.then(() => removeOnlyFlagBlocksInRadius(commandBus, { x, y, z, radius: 5 }))
			.then(() =>
				safeSend(
					commandBus,
					`/particle minecraft:explosion ${x} ${y} ${z} 1.1 1.1 1.1 0.08 24 force`
				)
			)
			.then(() =>
				safeSend(
					commandBus,
					`/playsound minecraft:entity.generic.explode master @a ${x} ${y} ${z} 1.2 0.95`
				)
			)
			.catch(err =>
				console.log('[TNT] flag block cleanup failed:', err?.message || err)
			)
	}, Math.max(250, fuse * 50 - 100))

	try {
		await bot.lookAt(new Vec3(x + 0.5, y + 0.5, z + 0.5), true)
	} catch {}

	tntPanic(bot, 1000).catch(err =>
		console.log('[TNT] panic camera failed:', err?.message || err)
	)

	return { ok: true, x, y, z, source }
}

async function spawnTntAboveArena({
	bot,
	rcon,
	fuse = 70,
	source = 'likes',
	label = '200 likes',
	arena = ARENA,
} = {}) {
	const commandBus = rcon || bot
	if (!commandBus) return { ok: false, reason: 'no command bus' }

	const x = Math.floor(arena.origin.x + arena.width / 2)
	const y = Math.floor(arena.origin.y + arena.height * 6 + 18)
	const z = Math.floor(arena.origin.z + arena.depth / 2)
	const targetY = Math.floor(arena.origin.y + arena.height / 2)
	const tag = 'TikTokShowLikesTnt'

	if (label) {
		await safeSend(
			commandBus,
			`/title @a actionbar {"text":"${label} = TNT!","color":"red","bold":true}`
		)
	}

	await safeSend(
		commandBus,
		`/summon minecraft:tnt ${x} ${y} ${z} {Fuse:${fuse},Tags:["${tag}"]}`
	)
	await safeSend(
		commandBus,
		`/playsound minecraft:entity.creeper.primed master @a ${x} ${y} ${z} 1 0.8`
	)
	await safeSend(
		commandBus,
		`/particle minecraft:smoke ${x} ${y} ${z} 1.2 1.2 1.2 0.04 40 force`
	)

	setTimeout(() => {
		Promise.resolve()
			.then(() =>
				safeSend(commandBus, `/kill @e[type=minecraft:tnt,tag=${tag}]`)
			)
			.then(() =>
				removeOnlyFlagBlocksInRadius(commandBus, {
					x,
					y: targetY,
					z,
					radius: Math.max(arena.width, arena.depth),
				})
			)
			.then(() =>
				safeSend(
					commandBus,
					`/particle minecraft:explosion ${x} ${targetY} ${z} 1.4 1.2 1.4 0.08 32 force`
				)
			)
			.then(() =>
				safeSend(
					commandBus,
					`/playsound minecraft:entity.generic.explode master @a ${x} ${targetY} ${z} 1.2 0.95`
				)
			)
			.catch(err =>
				console.log('[LIKES_TNT] flag block cleanup failed:', err?.message || err)
			)
	}, Math.max(250, fuse * 50 - 100))

	try {
		await bot?.lookAt?.(new Vec3(x + 0.5, targetY + 0.5, z + 0.5), true)
	} catch {}
	tntPanic(bot, 1000).catch(err =>
		console.log('[LIKES_TNT] panic camera failed:', err?.message || err)
	)

	return { ok: true, x, y, z, source }
}

module.exports = {
	spawnTntNearBot,
	spawnTntAboveArena,
	removeOnlyFlagBlocksInRadius,
}
