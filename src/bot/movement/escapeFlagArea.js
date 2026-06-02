const { Vec3 } = require('vec3')
const { teleportLookingAt } = require('./teleportLookingAt')

const EMPTY_BLOCKS = new Set(['air', 'cave_air', 'void_air'])

function blockAtFloored(bot, position) {
	if (!bot?.blockAt || !position) return null

	return bot.blockAt(
		new Vec3(
			Math.floor(position.x),
			Math.floor(position.y),
			Math.floor(position.z)
		)
	)
}

function isClearBlock(block) {
	if (!block) return false
	if (EMPTY_BLOCKS.has(block.name)) return true
	return block.boundingBox === 'empty'
}

function isSafePosition(bot, position) {
	const foot = blockAtFloored(bot, position)
	const head = blockAtFloored(bot, new Vec3(position.x, position.y + 1, position.z))

	return isClearBlock(foot) && isClearBlock(head)
}

function candidatePositions(bounds) {
	const centerX = bounds.centerX
	const centerY = Math.max(bounds.centerY, bounds.minY + 2)
	const centerZ = bounds.centerZ

	return [
		{
			side: 'front',
			position: new Vec3(centerX, centerY, bounds.minZ - 2.8),
		},
		{
			side: 'right',
			position: new Vec3(bounds.maxX + 2.8, centerY, centerZ),
		},
		{
			side: 'back',
			position: new Vec3(centerX, centerY, bounds.maxZ + 2.8),
		},
		{
			side: 'left',
			position: new Vec3(bounds.minX - 2.8, centerY, centerZ),
		},
	]
}

async function escapeFlagArea({ bot, rcon, bounds, lookTarget } = {}) {
	const commandBus = rcon || bot
	if (!bot?.username || !commandBus || !bounds) return null

	const target =
		lookTarget || new Vec3(bounds.centerX, bounds.centerY, bounds.centerZ)
	const candidates = candidatePositions(bounds)

	for (const candidate of candidates) {
		for (let yOffset = 0; yOffset <= 4; yOffset++) {
			const position = candidate.position.offset(0, yOffset, 0)
			if (!isSafePosition(bot, position)) continue

			await teleportLookingAt({
				rcon: commandBus,
				botName: bot.username,
				position,
				lookTarget: target,
			})
			console.log(
				`[MOVE] emergency escape from flag texture side=${candidate.side} pos=${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}`
			)
			return { side: candidate.side, position }
		}
	}

	const fallback = candidates[0].position.offset(0, 5, 0)
	await teleportLookingAt({
		rcon: commandBus,
		botName: bot.username,
		position: fallback,
		lookTarget: target,
	})
	console.log(
		`[MOVE] emergency escape from flag texture side=front pos=${fallback.x.toFixed(2)},${fallback.y.toFixed(2)},${fallback.z.toFixed(2)}`
	)
	return { side: 'front', position: fallback }
}

module.exports = {
	escapeFlagArea,
}
