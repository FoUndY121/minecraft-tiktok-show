const { Vec3 } = require('vec3')

function getApproachPosition(blockPosition, objectEvent) {
	const origin = objectEvent?.origin || blockPosition

	return new Vec3(
		blockPosition.x + 0.5,
		blockPosition.y + 0.5,
		origin.z - 2.2
	)
}

module.exports = {
	getApproachPosition,
}
