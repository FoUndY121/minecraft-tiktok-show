const { Vec3 } = require('vec3')
const ARENA = require('../../config/arena')

function getApproachPosition(blockPosition, objectEvent) {
	const arenaOrigin = ARENA.origin
	const origin = objectEvent?.arena?.origin || arenaOrigin

	return new Vec3(
		blockPosition.x + 0.5,
		blockPosition.y + 0.5,
		origin.z - 3.0
	)
}

module.exports = {
	getApproachPosition,
}
