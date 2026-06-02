const { Vec3 } = require('vec3')
const ARENA = require('../../config/arena')

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value))
}

function getSafeOutsidePosition({
	bounds,
	arena = ARENA,
	side = 'front',
	outsideDistance = 2.2,
} = {}) {
	if (!bounds) return null

	const minY = bounds.minY + 1.5
	const maxY = bounds.maxY + 2
	const safeY = clamp(bounds.centerY, minY, maxY)

	if (side === 'back') {
		return new Vec3(bounds.centerX, safeY, bounds.maxZ + outsideDistance)
	}
	if (side === 'right') {
		return new Vec3(bounds.maxX + outsideDistance, safeY, bounds.centerZ)
	}
	if (side === 'left') {
		return new Vec3(bounds.minX - outsideDistance, safeY, bounds.centerZ)
	}
	if (side === 'top') {
		return new Vec3(bounds.centerX, bounds.maxY + outsideDistance, bounds.centerZ - 1.5)
	}

	return new Vec3(bounds.centerX, safeY, bounds.minZ - outsideDistance)
}

module.exports = {
	getSafeOutsidePosition,
}
