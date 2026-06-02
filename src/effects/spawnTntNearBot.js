const { Vec3 } = require('vec3')
const { safeSend } = require('../rcon')
const { tntPanic } = require('../bot/reactions')
const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const { scanFlagBlocksInArena } = require('../core/scanFlagBlocksInArena')
const { calculateBounds } = require('../bot/movement/calculateBounds')
const {
	removeOnlyFlagBlocksInRadius,
} = require('./removeOnlyFlagBlocksInRadius')
const { spawnFallingTntAboveFlag } = require('./spawnFallingTntAboveFlag')

async function summonActivatedTnt(commandBus, { x, y, z, fuse, tag }) {
	await safeSend(
		commandBus,
		`/summon minecraft:tnt ${x} ${y} ${z} {Fuse:${Math.max(1, Math.floor(fuse))},Tags:["${tag}"]}`
	)
}

async function currentFlagTarget({ bot, arena = ARENA, objectEvent = null } = {}) {
	const blocks = await scanFlagBlocksInArena({
		bot,
		arena,
		objectEvent,
		mode: objectEvent ? 'event' : 'cleanup',
	})
	const bounds = calculateBounds(blocks)
	if (!bounds) {
		if (objectEvent?.origin) {
			return {
				x: Math.floor(objectEvent.origin.x + (objectEvent.width || arena.width) / 2),
				y: Math.floor(objectEvent.origin.y + (objectEvent.height || arena.height) / 2),
				z: Math.floor(objectEvent.origin.z + (objectEvent.depth || arena.depth) / 2),
				spawnY: Math.floor(objectEvent.origin.y + (objectEvent.height || arena.height) + 12),
				radius: behavior.tntFlagRadius ?? 2.5,
			}
		}

		return {
			x: Math.floor(arena.origin.x + arena.width / 2),
			y: Math.floor(arena.origin.y + arena.height / 2),
			z: Math.floor(arena.origin.z + arena.depth / 2),
			spawnY: Math.floor(arena.origin.y + 30),
			radius: behavior.tntFlagRadius ?? 2.5,
		}
	}

	return {
		x: Math.floor(bounds.centerX),
		y: Math.floor(bounds.centerY),
		z: Math.floor(bounds.centerZ),
		spawnY: Math.floor(bounds.maxY + 12),
		radius: behavior.tntFlagRadius ?? 2.5,
	}
}

async function spawnTntNearBot({
	bot,
	rcon,
	fuse = 60,
	source = null,
	label = null,
	objectEvent = null,
	maxBlocks = null,
} = {}) {
	if (!bot?.blockAt) return { ok: false, reason: 'bot cannot scan flag' }

	const target = await currentFlagTarget({ bot, arena: ARENA, objectEvent })
	const x = target.x
	const y = target.spawnY
	const z = target.z
	const maxBlocksToRemove =
		maxBlocks ??
		(objectEvent?.size === 'large'
			? behavior.tntLargeGiftMaxBlocksToRemove ?? 25
			: behavior.tntMaxBlocksToRemove ?? 18)
	const title = label ? `${label} = TNT!` : null

	if (title) {
		await safeSend(
			rcon || bot,
			`/title @a actionbar {"text":"${title}","color":"red","bold":true}`
		)
	}
	const commandBus = rcon || bot
	const tag = `TikTokShowActivatedTnt${Date.now()}`
	const activeFuse = Math.min(fuse, 40)
	await summonActivatedTnt(commandBus, { x, y, z, fuse: activeFuse, tag })
	await safeSend(rcon || bot, `/playsound minecraft:entity.creeper.primed master @a ${x} ${y} ${z} 0.9 0.7`)
	await safeSend(rcon || bot, `/particle minecraft:smoke ${x} ${y + 1} ${z} 0.8 0.8 0.8 0.04 30 force`)
	setTimeout(() => {
		Promise.resolve()
			.then(() =>
				safeSend(
					commandBus,
					`/kill @e[type=minecraft:tnt,tag=${tag}]`
				)
			)
			.then(() =>
				removeOnlyFlagBlocksInRadius({
					bot,
					rcon: commandBus,
					center: { x, y: target.y, z },
					radius: target.radius,
					maxBlocks: maxBlocksToRemove,
				})
			)
			.then(() =>
				safeSend(
					commandBus,
					`/particle minecraft:explosion ${x} ${target.y} ${z} 1.1 1.1 1.1 0.08 24 force`
				)
			)
			.then(() =>
				safeSend(
					commandBus,
					`/playsound minecraft:entity.generic.explode master @a ${x} ${target.y} ${z} 1.2 0.95`
				)
			)
			.catch(err =>
				console.log('[TNT] flag block cleanup failed:', err?.message || err)
			)
	}, Math.max(250, activeFuse * 50 - 100))

	try {
		await bot.lookAt(new Vec3(x + 0.5, target.y + 0.5, z + 0.5), true)
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
	return spawnFallingTntAboveFlag({
		bot,
		rcon,
		fuse: Math.min(fuse, 40),
		source,
		label,
		arena,
		maxBlocksToRemove: behavior.tntMaxBlocksToRemove ?? 18,
		radius: behavior.tntFlagRadius ?? 2.5,
	})
}

module.exports = {
	spawnTntNearBot,
	spawnFallingTntAboveFlag,
	spawnTntAboveArena,
	removeOnlyFlagBlocksInRadius,
}
