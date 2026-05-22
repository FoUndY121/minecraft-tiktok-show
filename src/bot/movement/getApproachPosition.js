const { Vec3 } = require('vec3')

function getApproachPosition(blockPosition, objectEvent) {
	const origin = objectEvent.origin
	const xMin = origin.x
	const xMax = origin.x + objectEvent.width - 1
	const zMin = origin.z
	const zMax = origin.z + objectEvent.depth - 1

	const distances = [
		{ side: 'front', value: Math.abs(blockPosition.z - zMin) },
		{ side: 'back', value: Math.abs(zMax - blockPosition.z) },
		{ side: 'left', value: Math.abs(blockPosition.x - xMin) },
		{ side: 'right', value: Math.abs(xMax - blockPosition.x) },
	].sort((a, b) => a.value - b.value)

	const side = distances[0]?.side || 'front'
	const x = blockPosition.x + 0.5
	const y = blockPosition.y + 0.5
	const z = blockPosition.z + 0.5

	if (side === 'left') return new Vec3(origin.x - 1.8, y, z)
	if (side === 'right') return new Vec3(origin.x + objectEvent.width + 1.8, y, z)
	if (side === 'back') return new Vec3(x, y, origin.z + objectEvent.depth + 1.8)

	return new Vec3(x, y, origin.z - 1.8)
}

module.exports = {
	getApproachPosition,
}
