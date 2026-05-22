function createFlagStack({ stepY = 8 } = {}) {
	let baseOrigin = null
	let nextY = 0
	let spawning = 0
	const entries = []

	const reset = () => {
		baseOrigin = null
		nextY = 0
		spawning = 0
		entries.length = 0
	}

	const setBaseIfNeeded = origin => {
		if (!baseOrigin) baseOrigin = { ...origin }
	}

	const nextOrigin = (originNearBot, { height = stepY } = {}) => {
		setBaseIfNeeded(originNearBot)
		const origin = {
			x: baseOrigin.x,
			y: baseOrigin.y + nextY,
			z: baseOrigin.z,
		}
		nextY += height
		entries.push({ origin, height })
		return origin
	}

	const beginSpawn = () => {
		spawning += 1
	}

	const endSpawn = () => {
		spawning = Math.max(0, spawning - 1)
	}

	return {
		reset,
		nextOrigin,
		beginSpawn,
		endSpawn,
		getState: () => ({
			baseOrigin,
			nextY,
			stepY,
			spawning,
			entries: entries.map(entry => ({ ...entry, origin: { ...entry.origin } })),
		}),
	}
}

module.exports = {
	createFlagStack,
}
