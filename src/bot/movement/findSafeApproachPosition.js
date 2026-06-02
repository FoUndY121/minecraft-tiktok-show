const { Vec3 } = require('vec3')
const ARENA = require('../../config/arena')
const { FLAG_BLOCKS } = require('../../config/flagBlocks')

function blockAtFeet(bot, position, yOffset = 0) {
	return bot?.blockAt?.(
		new Vec3(
			Math.floor(position.x),
			Math.floor(position.y + yOffset),
			Math.floor(position.z)
		)
	)
}

function isUnsafeBlock(block) {
	if (!block || block.name === 'air') return false
	if (FLAG_BLOCKS.has(block.name)) return true
	return block.boundingBox === 'block'
}

function findSafeApproachPosition({ bot, desiredPosition, arena = ARENA } = {}) {
	const origin = arena.origin || ARENA.origin
	let position = new Vec3(
		desiredPosition.x,
		desiredPosition.y,
		Math.min(desiredPosition.z, origin.z - 3.0)
	)

	for (let attempt = 0; attempt < 5; attempt++) {
		const feetBlock = blockAtFeet(bot, position, 0)
		const headBlock = blockAtFeet(bot, position, 1)
		if (!isUnsafeBlock(feetBlock) && !isUnsafeBlock(headBlock)) {
			console.log(
				`[MOVE] safe approach ${position.x.toFixed(2)} ${position.y.toFixed(
					2
				)} ${position.z.toFixed(2)}`
			)
			return position
		}

		position = position.offset(0, 0, -1)
	}

	console.log(
		`[MOVE] safe approach ${position.x.toFixed(2)} ${position.y.toFixed(
			2
		)} ${position.z.toFixed(2)}`
	)
	return position
}

module.exports = {
	findSafeApproachPosition,
}
