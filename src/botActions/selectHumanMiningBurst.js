const behavior = require('../config/botBehavior')

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function blockCenter(pos) {
	return {
		x: pos.x + 0.5,
		y: pos.y + 0.5,
		z: pos.z + 0.5,
	}
}

function distance(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function shuffleLight(items) {
	return [...items].sort((a, b) => a.score - b.score + (Math.random() - 0.5) * 0.6)
}

function uniqPositions(items) {
	const seen = new Set()
	const out = []
	for (const item of items) {
		const key = `${item.x},${item.y},${item.z}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(item)
	}
	return out
}

function nearestAxisToViewer(botPosition, bounds) {
	const dx = Math.abs(botPosition.x - bounds.centerX)
	const dz = Math.abs(botPosition.z - bounds.centerZ)
	return dx > dz ? 'z' : 'x'
}

function scoreBlock(pos, botPosition, bounds) {
	const center = blockCenter(pos)
	const fromView = distance(center, botPosition)
	const fromObjectCenter =
		Math.abs(center.x - bounds.centerX) +
		Math.abs(center.y - bounds.centerY) +
		Math.abs(center.z - bounds.centerZ)
	return fromView * 0.75 + fromObjectCenter * 0.25
}

function centerPunch(candidates, bounds) {
	return candidates
		.map(pos => ({
			...pos,
			score:
				Math.abs(pos.x + 0.5 - bounds.centerX) +
				Math.abs(pos.y + 0.5 - bounds.centerY) * 1.3 +
				Math.abs(pos.z + 0.5 - bounds.centerZ),
		}))
		.sort((a, b) => a.score - b.score)
		.slice(0, randInt(3, 4))
}

function topScrape(candidates, botPosition) {
	return candidates
		.map(pos => ({
			...pos,
			score: -pos.y + distance(blockCenter(pos), botPosition) * 0.2,
		}))
		.sort((a, b) => a.score - b.score)
		.slice(0, randInt(3, 5))
}

function bottomCut(candidates, botPosition) {
	return candidates
		.map(pos => ({
			...pos,
			score: pos.y + distance(blockCenter(pos), botPosition) * 0.25,
		}))
		.sort((a, b) => a.score - b.score)
		.slice(0, randInt(2, 3))
}

function randomVisible(candidates, botPosition, bounds) {
	return shuffleLight(
		candidates.map(pos => ({
			...pos,
			score: scoreBlock(pos, botPosition, bounds),
		}))
	).slice(0, randInt(4, 6))
}

function verticalLine(candidates, botPosition, bounds) {
	const base = centerPunch(candidates, bounds)[0] || candidates[0]
	if (!base) return []

	return candidates
		.filter(pos => Math.abs(pos.x - base.x) <= 1 && Math.abs(pos.z - base.z) <= 1)
		.map(pos => ({
			...pos,
			score: Math.abs(pos.x - base.x) + Math.abs(pos.z - base.z) + distance(blockCenter(pos), botPosition) * 0.1,
		}))
		.sort((a, b) => a.score - b.score || b.y - a.y)
		.slice(0, 3)
}

function horizontalLine(candidates, botPosition, bounds) {
	const axis = nearestAxisToViewer(botPosition, bounds)
	const base = centerPunch(candidates, bounds)[0] || candidates[0]
	if (!base) return []

	return candidates
		.filter(pos => Math.abs(pos.y - base.y) <= 1)
		.map(pos => ({
			...pos,
			score:
				Math.abs(pos[axis] - base[axis]) * 0.25 +
				Math.abs(pos[axis === 'x' ? 'z' : 'x'] - base[axis === 'x' ? 'z' : 'x']) +
				distance(blockCenter(pos), botPosition) * 0.12,
		}))
		.sort((a, b) => a.score - b.score)
		.slice(0, randInt(3, 5))
}

function selectHumanMiningBurst({
	blocks,
	botPosition,
	bounds,
	maxBlocks,
	maxReachDistance = behavior.maxReachDistance ?? 4.5,
} = {}) {
	if (!blocks?.length || !botPosition || !bounds) return []

	const candidates = blocks
		.filter(Boolean)
		.filter(pos => distance(blockCenter(pos), botPosition) <= maxReachDistance)
		.map(pos => ({
			x: pos.x,
			y: pos.y,
			z: pos.z,
		}))

	if (!candidates.length) return []

	const patterns = [
		centerPunch,
		topScrape,
		bottomCut,
		randomVisible,
		verticalLine,
		horizontalLine,
	]
	const start = randInt(0, patterns.length - 1)
	const orderedPatterns = patterns
		.slice(start)
		.concat(patterns.slice(0, start))

	let selected = []
	for (const pattern of orderedPatterns) {
		selected = selected.concat(pattern(candidates, botPosition, bounds))
		selected = uniqPositions(selected)
		if (selected.length >= maxBlocks) break
	}

	if (selected.length < maxBlocks) {
		selected = uniqPositions(
			selected.concat(randomVisible(candidates, botPosition, bounds))
		)
	}

	return selected.slice(0, maxBlocks).map(pos => ({
		x: pos.x,
		y: pos.y,
		z: pos.z,
	}))
}

module.exports = {
	selectHumanMiningBurst,
}
