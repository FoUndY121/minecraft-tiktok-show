const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { scanFlagBlocksInArena } = require('../core/scanFlagBlocksInArena')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const { removeOnlyFlagBlocksInRadius } = require('./removeOnlyFlagBlocksInRadius')

async function getTntTarget({ bot, arena = ARENA } = {}) {
	const blocks = bot?.blockAt
		? await scanFlagBlocksInArena({ bot, arena, mode: 'cleanup' })
		: []
	const bounds = calculateBounds(blocks)

	if (!bounds) {
		return {
			x: Math.floor(arena.origin.x + arena.width / 2),
			y: Math.floor(arena.origin.y + arena.height / 2),
			z: Math.floor(arena.origin.z + arena.depth / 2),
			spawnY: Math.floor(arena.origin.y + 30),
		}
	}

	return {
		x: Math.floor(bounds.centerX),
		y: Math.floor(bounds.centerY),
		z: Math.floor(bounds.centerZ),
		spawnY: Math.floor(bounds.maxY + 12),
	}
}

async function spawnFallingTntAboveFlag({
	bot,
	rcon,
	arena = ARENA,
	fuse = 40,
	source = 'likes',
	label = '200 likes',
	maxBlocksToRemove = behavior.tntMaxBlocksToRemove ?? 18,
	radius = behavior.tntFlagRadius ?? 2.5,
} = {}) {
	const commandBus = rcon || bot
	if (!commandBus) return { ok: false, reason: 'no command bus' }

	const target = await getTntTarget({ bot, arena })
	const x = target.x
	const y = target.spawnY
	const z = target.z
	const targetY = target.y
	const activeFuse = Math.max(1, Math.min(Math.floor(fuse), 40))
	const tag = `TikTokShowFallingTnt${Date.now()}`

	if (label) {
		await safeSend(
			commandBus,
			`/title @a actionbar {"text":"${label} = TNT!","color":"red","bold":true}`
		)
	}

	await safeSend(
		commandBus,
		`/summon minecraft:tnt ${x} ${y} ${z} {Fuse:${activeFuse},Tags:["${tag}"]}`
	)
	console.log(`[TNT] falling TNT spawned x=${x} y=${y} z=${z}`)
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
			.then(() => safeSend(commandBus, `/kill @e[type=minecraft:tnt,tag=${tag}]`))
			.then(() =>
				removeOnlyFlagBlocksInRadius({
					bot,
					rcon: commandBus,
					center: { x, y: targetY, z },
					radius,
					maxBlocks: maxBlocksToRemove,
				})
			)
			.then(result => {
				console.log(
					`[TNT] custom cleanup removed=${result.removed} max=${maxBlocksToRemove}`
				)
				return safeSend(
					commandBus,
					`/particle minecraft:explosion ${x} ${targetY} ${z} 1.4 1.2 1.4 0.08 32 force`
				)
			})
			.then(() =>
				safeSend(
					commandBus,
					`/playsound minecraft:entity.generic.explode master @a ${x} ${targetY} ${z} 1.2 0.95`
				)
			)
			.catch(err =>
				console.log('[TNT] custom cleanup failed:', err?.message || err)
			)
	}, Math.max(250, activeFuse * 50 - 100))

	try {
		await bot?.lookAt?.(new Vec3(x + 0.5, targetY + 0.5, z + 0.5), true)
	} catch {}

	return { ok: true, x, y, z, source }
}

module.exports = {
	spawnFallingTntAboveFlag,
}
