const { Vec3 } = require('vec3')
const { teleportLookingAt } = require('./teleportLookingAt')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function toVec3(pos) {
	return new Vec3(pos.x, pos.y, pos.z)
}

function distance(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function isInsideBounds(pos, bounds, expand = 0) {
	return (
		pos.x >= bounds.minX - expand &&
		pos.x <= bounds.maxX + 1 + expand &&
		pos.y >= bounds.minY - expand &&
		pos.y <= bounds.maxY + 1 + expand &&
		pos.z >= bounds.minZ - expand &&
		pos.z <= bounds.maxZ + 1 + expand
	)
}

function segmentIntersectsBounds(from, to, bounds, expand = 0.2) {
	const total = distance(from, to)
	const samples = Math.max(2, Math.ceil(total / 0.25))

	for (let i = 0; i <= samples; i++) {
		const t = i / samples
		const pos = new Vec3(
			from.x + (to.x - from.x) * t,
			from.y + (to.y - from.y) * t,
			from.z + (to.z - from.z) * t
		)
		if (isInsideBounds(pos, bounds, expand)) return true
	}

	return false
}

function detectSide(pos, bounds) {
	if (pos.y > bounds.maxY + 1.2) return 'top'
	const distances = [
		{ side: 'front', value: bounds.minZ - pos.z },
		{ side: 'right', value: pos.x - bounds.maxX },
		{ side: 'back', value: pos.z - bounds.maxZ },
		{ side: 'left', value: bounds.minX - pos.x },
	]
		.filter(item => item.value > 0)
		.sort((a, b) => b.value - a.value)

	return distances[0]?.side || 'front'
}

function cornerForTransition(fromSide, toSide, bounds, outsideDistance, y) {
	const side = toSide === 'top' ? fromSide : toSide

	if (
		(fromSide === 'front' && side === 'right') ||
		(fromSide === 'right' && side === 'front')
	) {
		return new Vec3(bounds.maxX + outsideDistance, y, bounds.minZ - outsideDistance)
	}
	if (
		(fromSide === 'right' && side === 'back') ||
		(fromSide === 'back' && side === 'right')
	) {
		return new Vec3(bounds.maxX + outsideDistance, y, bounds.maxZ + outsideDistance)
	}
	if (
		(fromSide === 'back' && side === 'left') ||
		(fromSide === 'left' && side === 'back')
	) {
		return new Vec3(bounds.minX - outsideDistance, y, bounds.maxZ + outsideDistance)
	}
	if (
		(fromSide === 'left' && side === 'front') ||
		(fromSide === 'front' && side === 'left')
	) {
		return new Vec3(bounds.minX - outsideDistance, y, bounds.minZ - outsideDistance)
	}

	const useRight = fromSide === 'right' || side === 'right'
	const useBack = fromSide === 'back' || side === 'back'
	return new Vec3(
		useRight ? bounds.maxX + outsideDistance : bounds.minX - outsideDistance,
		y,
		useBack ? bounds.maxZ + outsideDistance : bounds.minZ - outsideDistance
	)
}

async function moveSegment({
	bot,
	rcon,
	from,
	to,
	lookTarget,
	bounds,
	options,
}) {
	const stepSize = options.flyStepSize ?? 0.55
	const intervalMs = options.flyStepIntervalMs ?? 25
	const steps = Math.max(1, Math.ceil(distance(from, to) / stepSize))
	let current = from

	for (let i = 1; i <= steps; i++) {
		const t = i / steps
		const next = new Vec3(
			from.x + (to.x - from.x) * t,
			from.y + (to.y - from.y) * t,
			from.z + (to.z - from.z) * t
		)

		if (isInsideBounds(next, bounds, 0.15)) {
			console.log('[MOVE] avoided bounds')
			return current
		}

		await teleportLookingAt({
			rcon,
			botName: bot?.username,
			position: next,
			lookTarget,
		})
		current = next
		await delay(intervalMs)
	}

	return current
}

async function cinematicMoveOutside({
	bot,
	rcon,
	fromPosition,
	toPosition,
	lookTarget,
	bounds,
	options = {},
}) {
	if (!bot || !rcon || !fromPosition || !toPosition || !lookTarget || !bounds) {
		return toPosition
	}

	const from = toVec3(fromPosition)
	const to = toVec3(toPosition)
	const outsideDistance = options.outsideDistance ?? 2.2
	const waypoints = []

	if (segmentIntersectsBounds(from, to, bounds, 0.2)) {
		console.log('[MOVE] avoided bounds')
		const fromSide = detectSide(from, bounds)
		const toSide = detectSide(to, bounds)
		const y = Math.max(from.y, to.y)
		waypoints.push(cornerForTransition(fromSide, toSide, bounds, outsideDistance, y))
	}
	waypoints.push(to)

	let current = from
	for (const waypoint of waypoints) {
		current = await moveSegment({
			bot,
			rcon,
			from: current,
			to: waypoint,
			lookTarget,
			bounds,
			options,
		})
	}

	return current
}

module.exports = {
	cinematicMoveOutside,
}
