const { Vec3 } = require('vec3')
const ARENA = require('../../config/arena')
const { isInsideBounds } = require('./isInsideBounds')

function getOutsideBreakPositions({ bounds, groundY = ARENA.groundY } = {}) {
	if (!bounds) return []

	const height = bounds.maxY - bounds.minY + 1
	const yLayers =
		height >= 6
			? [bounds.minY + 1.0, bounds.centerY, bounds.maxY]
			: [bounds.centerY]
	const uniqueYLayers = [...new Set(yLayers.map(y => Math.max(groundY, y)))]

	const positions = []
	for (const y of uniqueYLayers) {
		positions.push(
			{
				side: 'front',
				position: new Vec3(bounds.centerX, y, bounds.minZ - 2.0),
			},
			{
				side: 'back',
				position: new Vec3(bounds.centerX, y, bounds.maxZ + 2.0),
			},
			{
				side: 'left',
				position: new Vec3(bounds.minX - 2.0, y, bounds.centerZ),
			},
			{
				side: 'right',
				position: new Vec3(bounds.maxX + 2.0, y, bounds.centerZ),
			}
		)
	}

	return positions.filter(({ position, side }) => {
		if (!isInsideBounds(position, bounds, 0.7)) return true
		console.log(`[BREAK] outside position rejected side=${side} reason=inside_bounds`)
		return false
	})
}

module.exports = {
	getOutsideBreakPositions,
}
