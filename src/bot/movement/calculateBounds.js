function calculateBounds(blocks = []) {
	if (!blocks.length) return null

	const bounds = {
		minX: Infinity,
		minY: Infinity,
		minZ: Infinity,
		maxX: -Infinity,
		maxY: -Infinity,
		maxZ: -Infinity,
	}

	for (const block of blocks) {
		if (!block) continue
		bounds.minX = Math.min(bounds.minX, block.x)
		bounds.minY = Math.min(bounds.minY, block.y)
		bounds.minZ = Math.min(bounds.minZ, block.z)
		bounds.maxX = Math.max(bounds.maxX, block.x)
		bounds.maxY = Math.max(bounds.maxY, block.y)
		bounds.maxZ = Math.max(bounds.maxZ, block.z)
	}

	if (!Number.isFinite(bounds.minX)) return null

	bounds.centerX = (bounds.minX + bounds.maxX + 1) / 2
	bounds.centerY = (bounds.minY + bounds.maxY + 1) / 2
	bounds.centerZ = (bounds.minZ + bounds.maxZ + 1) / 2

	return bounds
}

module.exports = {
	calculateBounds,
}
