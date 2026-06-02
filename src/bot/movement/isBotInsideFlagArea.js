const { Vec3 } = require('vec3')
const { FLAG_BLOCKS } = require('../../config/flagBlocks')

function insideBoundsWithPadding(position, bounds, padding = 0.8) {
	if (!position || !bounds) return false

	return (
		position.x >= bounds.minX - padding &&
		position.x <= bounds.maxX + 1 + padding &&
		position.y >= bounds.minY - padding &&
		position.y <= bounds.maxY + 1 + padding &&
		position.z >= bounds.minZ - padding &&
		position.z <= bounds.maxZ + 1 + padding
	)
}

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

function isFlagBlockAt(bot, position) {
	const block = blockAtFloored(bot, position)
	return Boolean(block && FLAG_BLOCKS.has(block.name))
}

function isBotInsideFlagArea({ bot, bounds, padding = 0.8 } = {}) {
	const position = bot?.entity?.position
	if (!position) return false

	if (bounds && insideBoundsWithPadding(position, bounds, padding)) return true

	const footPosition = position
	const headPosition = new Vec3(position.x, position.y + 1, position.z)

	return isFlagBlockAt(bot, footPosition) || isFlagBlockAt(bot, headPosition)
}

module.exports = {
	isBotInsideFlagArea,
}
