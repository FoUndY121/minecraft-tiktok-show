const { Vec3 } = require('vec3')
const ARENA = require('../../config/arena')
const { teleportLookingAt } = require('./teleportLookingAt')
const { findSafeApproachPosition } = require('./findSafeApproachPosition')

function normalizeArena(arena = ARENA) {
	return {
		origin: arena.origin || ARENA.origin,
		width: arena.maxWidth ?? arena.width ?? ARENA.width,
		depth: arena.maxDepth ?? arena.depth ?? ARENA.depth,
		height: arena.maxHeight ?? arena.height ?? ARENA.height,
		maxStack: arena.maxStack ?? 6,
	}
}

function isInsideFlagArea(position, arena = ARENA) {
	if (!position) return false
	const a = normalizeArena(arena)
	const xMin = a.origin.x - 0.5
	const xMax = a.origin.x + a.width + 0.5
	const zMin = a.origin.z - 0.5
	const zMax = a.origin.z + a.depth + 0.5
	const yMin = a.origin.y - 5
	const yMax = a.origin.y + a.maxStack * a.height + 40

	return (
		position.x >= xMin &&
		position.x <= xMax &&
		position.z >= zMin &&
		position.z <= zMax &&
		position.y >= yMin &&
		position.y <= yMax
	)
}

async function ensureBotOutsideFlag({ bot, rcon, arena = ARENA, lookTarget } = {}) {
	const current = bot?.entity?.position
	if (!bot?.username || !current || !isInsideFlagArea(current, arena)) return false

	const a = normalizeArena(arena)
	const desiredPosition = new Vec3(
		a.origin.x + a.width / 2,
		current.y || a.origin.y + 3,
		a.origin.z - 4
	)
	const safePosition = findSafeApproachPosition({
		bot,
		desiredPosition,
		arena: a,
	})
	const target =
		lookTarget ||
		new Vec3(a.origin.x + a.width / 2, a.origin.y + 2, a.origin.z + a.depth / 2)

	console.log('[MOVE] bot inside flag area, moving outside')
	await teleportLookingAt({
		rcon,
		botName: bot.username,
		position: safePosition,
		lookTarget: target,
	})
	return true
}

module.exports = {
	ensureBotOutsideFlag,
	isInsideFlagArea,
}
