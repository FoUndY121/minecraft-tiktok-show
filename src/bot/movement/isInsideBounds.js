function isInsideBounds(position, bounds, expand = 0) {
	if (!position || !bounds) return false

	return (
		position.x >= bounds.minX - expand &&
		position.x <= bounds.maxX + 1 + expand &&
		position.y >= bounds.minY - expand &&
		position.y <= bounds.maxY + 1 + expand &&
		position.z >= bounds.minZ - expand &&
		position.z <= bounds.maxZ + 1 + expand
	)
}

function segmentIntersectsBounds(from, to, bounds, expand = 0) {
	if (!from || !to || !bounds) return false

	const dx = to.x - from.x
	const dy = to.y - from.y
	const dz = to.z - from.z
	const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
	const samples = Math.max(2, Math.ceil(distance / 0.25))

	for (let i = 0; i <= samples; i++) {
		const t = i / samples
		if (
			isInsideBounds(
				{
					x: from.x + dx * t,
					y: from.y + dy * t,
					z: from.z + dz * t,
				},
				bounds,
				expand
			)
		) {
			return true
		}
	}

	return false
}

module.exports = {
	isInsideBounds,
	segmentIntersectsBounds,
}
