const SIDE_ORDER = ['front', 'right', 'back', 'left']

function nearestBySide(outsidePositions = {}) {
	if (Array.isArray(outsidePositions)) {
		return outsidePositions.reduce((map, item) => {
			if (!item?.side || !item.position) return map
			if (!map[item.side]) map[item.side] = item.position
			return map
		}, {})
	}
	return outsidePositions
}

function createOutsideRoute({ fromSide, toSide, outsidePositions } = {}) {
	const bySide = nearestBySide(outsidePositions)
	if (!toSide || !bySide[toSide]) return []
	if (!fromSide || fromSide === toSide) return [bySide[toSide]]

	const fromIndex = SIDE_ORDER.indexOf(fromSide)
	const toIndex = SIDE_ORDER.indexOf(toSide)
	if (fromIndex < 0 || toIndex < 0) return [bySide[toSide]]

	const clockwise = []
	for (let i = fromIndex; i !== toIndex; i = (i + 1) % SIDE_ORDER.length) {
		const nextSide = SIDE_ORDER[(i + 1) % SIDE_ORDER.length]
		if (bySide[nextSide]) clockwise.push(bySide[nextSide])
	}

	const counterClockwise = []
	for (
		let i = fromIndex;
		i !== toIndex;
		i = (i - 1 + SIDE_ORDER.length) % SIDE_ORDER.length
	) {
		const nextSide = SIDE_ORDER[(i - 1 + SIDE_ORDER.length) % SIDE_ORDER.length]
		if (bySide[nextSide]) counterClockwise.push(bySide[nextSide])
	}

	return clockwise.length <= counterClockwise.length ? clockwise : counterClockwise
}

module.exports = {
	createOutsideRoute,
	SIDE_ORDER,
}
