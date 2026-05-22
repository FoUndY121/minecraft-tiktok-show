const { safeSend } = require('../../rcon')
const { getYawPitchToTarget } = require('../camera/getYawPitchToTarget')

async function teleportLookingAt({ rcon, botName, position, lookTarget }) {
	if (!rcon || !botName || !position || !lookTarget) return null

	const eyePosition = { x: position.x, y: position.y + 1.62, z: position.z }
	const { yaw, pitch } = getYawPitchToTarget(eyePosition, lookTarget)
	return safeSend(
		rcon,
		`/tp ${botName} ${position.x.toFixed(3)} ${position.y.toFixed(3)} ${position.z.toFixed(3)} ${yaw.toFixed(2)} ${pitch.toFixed(2)}`
	)
}

module.exports = {
	teleportLookingAt,
}
