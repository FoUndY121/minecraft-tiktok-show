const { Vec3 } = require('vec3')
const { teleportLookingAt } = require('./teleportLookingAt')
const { isInsideBounds, segmentIntersectsBounds } = require('./isInsideBounds')

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function toVec3(position) {
	return new Vec3(position.x, position.y, position.z)
}

function formatPos(pos) {
	return `${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`
}

function distance(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function detectSide(position, bounds) {
	const distances = [
		{ side: 'front', value: bounds.minZ - position.z },
		{ side: 'back', value: position.z - (bounds.maxZ + 1) },
		{ side: 'left', value: bounds.minX - position.x },
		{ side: 'right', value: position.x - (bounds.maxX + 1) },
	]
		.filter(item => item.value > 0)
		.sort((a, b) => b.value - a.value)

	return distances[0]?.side || 'front'
}

function sidePoint(side, source, bounds, clearance, y) {
	if (side === 'front') return new Vec3(source.x, y, bounds.minZ - clearance)
	if (side === 'back') return new Vec3(source.x, y, bounds.maxZ + 1 + clearance)
	if (side === 'left') return new Vec3(bounds.minX - clearance, y, source.z)
	return new Vec3(bounds.maxX + 1 + clearance, y, source.z)
}

function cornerPoint(fromSide, toSide, bounds, clearance, y) {
	const useLeft = fromSide === 'left' || toSide === 'left'
	const useFront = fromSide === 'front' || toSide === 'front'
	const x = useLeft ? bounds.minX - clearance : bounds.maxX + 1 + clearance
	const z = useFront ? bounds.minZ - clearance : bounds.maxZ + 1 + clearance
	return new Vec3(x, y, z)
}

function buildDetourWaypoints(from, to, bounds, clearance = 2.2) {
	const y = Math.max(from.y, to.y)
	const fromSide = detectSide(from, bounds)
	const toSide = detectSide(to, bounds)
	const waypoints = [
		sidePoint(fromSide, from, bounds, clearance, y),
		cornerPoint(fromSide, toSide, bounds, clearance, y),
		sidePoint(toSide, to, bounds, clearance, y),
		to,
	]

	return waypoints.filter((point, index) => {
		if (index === 0) return distance(from, point) > 0.05
		return distance(waypoints[index - 1], point) > 0.05
	})
}

async function flySegment({ bot, rcon, from, to, lookTarget, bounds, options }) {
	const stepSize = options.flyStepSize ?? 0.3
	const intervalMs = options.flyStepIntervalMs ?? 45
	const expand = options.boundsExpand ?? 0.7
	const totalDistance = distance(from, to)
	const steps = Math.max(1, Math.ceil(totalDistance / stepSize))
	let current = toVec3(from)

	for (let i = 1; i <= steps; i++) {
		const t = i / steps
		const next = new Vec3(
			from.x + (to.x - from.x) * t,
			from.y + (to.y - from.y) * t,
			from.z + (to.z - from.z) * t
		)

		if (isInsideBounds(next, bounds, expand)) {
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
		await sleep(intervalMs)
	}

	return current
}

async function cinematicFlyTo({
	bot,
	rcon,
	from,
	to,
	lookTarget,
	bounds,
	options = {},
}) {
	if (!bot || !rcon || !from || !to || !lookTarget) return to

	const start = toVec3(from)
	const target = toVec3(to)
	const expand = options.boundsExpand ?? 0.7
	const emergencyDistance = options.emergencyDistance ?? 50

	if (distance(start, target) > emergencyDistance) {
		console.log('[MOVE] emergency reset')
		await teleportLookingAt({
			rcon,
			botName: bot?.username,
			position: target,
			lookTarget,
		})
		await sleep(options.flyStepIntervalMs ?? 45)
		return target
	}

	const waypoints = []
	if (segmentIntersectsBounds(start, target, bounds, expand)) {
		console.log('[MOVE] avoided bounds')
		waypoints.push(...buildDetourWaypoints(start, target, bounds))
	} else {
		waypoints.push(target)
	}

	let current = start
	for (const waypoint of waypoints) {
		console.log(`[MOVE] waypoint ${formatPos(waypoint)}`)
		current = await flySegment({
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
	cinematicFlyTo,
}
