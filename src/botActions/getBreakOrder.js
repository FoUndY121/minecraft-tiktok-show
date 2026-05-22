const { Vec3 } = require('vec3')

function shellDistance(position, objectEvent) {
	const origin = objectEvent.origin
	const xMax = origin.x + objectEvent.width - 1
	const yMax = origin.y + objectEvent.height - 1
	const zMax = origin.z + objectEvent.depth - 1

	return Math.min(
		position.x - origin.x,
		xMax - position.x,
		position.y - origin.y,
		yMax - position.y,
		position.z - origin.z,
		zMax - position.z
	)
}

function getBreakOrder(objectEvent) {
	const blocks = []
	const origin = objectEvent.origin

	for (let y = origin.y + objectEvent.height - 1; y >= origin.y; y--) {
		const layerFromTop = origin.y + objectEvent.height - 1 - y

		for (let zOffset = 0; zOffset < objectEvent.depth; zOffset++) {
			const z = origin.z + zOffset
			const reverseX = zOffset % 2 === 1

			for (let xOffset = 0; xOffset < objectEvent.width; xOffset++) {
				const localX = reverseX ? objectEvent.width - 1 - xOffset : xOffset
				const x = origin.x + localX
				const position = new Vec3(x, y, z)

				blocks.push({
					position,
					shell: shellDistance(position, objectEvent),
					layerFromTop,
					zOffset,
					xOffset,
				})
			}
		}
	}

	return blocks.sort((a, b) => {
		if (a.shell !== b.shell) return a.shell - b.shell
		if (a.position.y !== b.position.y) return b.position.y - a.position.y
		if (a.zOffset !== b.zOffset) return a.zOffset - b.zOffset
		return a.xOffset - b.xOffset
	})
}

module.exports = {
	getBreakOrder,
}
