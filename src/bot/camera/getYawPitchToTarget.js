function radiansToDegrees(value) {
	return (value * 180) / Math.PI
}

function normalizeAngle(degrees) {
	let value = degrees % 360
	if (value > 180) value -= 360
	if (value < -180) value += 360
	return value
}

function getYawPitchToTarget(from, to) {
	const dx = to.x - from.x
	const dy = to.y - from.y
	const dz = to.z - from.z
	const horizontal = Math.sqrt(dx * dx + dz * dz)

	// Minecraft yaw: 0 = +Z, -90 = +X, 90 = -X. Change this offset if the POV is rotated.
	const yawOffset = 0
	const yaw = normalizeAngle(radiansToDegrees(-Math.atan2(dx, dz)) + yawOffset)
	const pitch = normalizeAngle(radiansToDegrees(-Math.atan2(dy, horizontal)))

	return { yaw, pitch }
}

module.exports = {
	getYawPitchToTarget,
}
