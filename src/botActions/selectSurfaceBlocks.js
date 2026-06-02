function keyForSide(pos, side) {
	if (side === 'front' || side === 'back') return `${pos.x},${pos.y}`
	if (side === 'left' || side === 'right') return `${pos.z},${pos.y}`
	if (side === 'top') return `${pos.x},${pos.z}`
	return `${pos.x},${pos.y},${pos.z}`
}

function isBetterSurfaceBlock(next, current, side) {
	if (!current) return true
	if (side === 'front') return next.z < current.z
	if (side === 'back') return next.z > current.z
	if (side === 'right') return next.x > current.x
	if (side === 'left') return next.x < current.x
	if (side === 'top') return next.y > current.y
	return false
}

function sortSurfaceBlocks(blocks, side) {
	const sorted = [...blocks]
	if (side === 'front') return sorted.sort((a, b) => a.z - b.z || b.y - a.y || a.x - b.x)
	if (side === 'back') return sorted.sort((a, b) => b.z - a.z || b.y - a.y || a.x - b.x)
	if (side === 'right') return sorted.sort((a, b) => b.x - a.x || b.y - a.y || a.z - b.z)
	if (side === 'left') return sorted.sort((a, b) => a.x - b.x || b.y - a.y || a.z - b.z)
	if (side === 'top') return sorted.sort((a, b) => b.y - a.y || a.z - b.z || a.x - b.x)
	return sorted
}

function selectSurfaceBlocks({ blocks, side = 'front', maxBlocks = null } = {}) {
	if (!Array.isArray(blocks) || !blocks.length) return []

	const surfaceByColumn = new Map()
	for (const pos of blocks) {
		if (!pos) continue
		const key = keyForSide(pos, side)
		const current = surfaceByColumn.get(key)
		if (isBetterSurfaceBlock(pos, current, side)) {
			surfaceByColumn.set(key, pos)
		}
	}

	const surface = sortSurfaceBlocks([...surfaceByColumn.values()], side)
	if (!maxBlocks) return surface
	return surface.slice(0, maxBlocks)
}

module.exports = {
	selectSurfaceBlocks,
}
