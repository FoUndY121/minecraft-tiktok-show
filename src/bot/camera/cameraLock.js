const { Vec3 } = require('vec3')
const behavior = require('../../config/botBehavior')

let cameraTarget = null
let timer = null
let activeBot = null
let runningLook = false

function asVec3(pos) {
	if (!pos) return null
	return pos instanceof Vec3 ? pos : new Vec3(pos.x, pos.y, pos.z)
}

function setCameraTarget(targetVec) {
	cameraTarget = asVec3(targetVec)
}

function clearCameraTarget() {
	cameraTarget = null
}

function startCameraLock({ bot } = {}) {
	activeBot = bot
	if (!behavior.cameraLockEnabled || timer) return

	const intervalMs = behavior.cameraLockIntervalMs || 40
	timer = setInterval(() => {
		if (!activeBot?.entity?.position || !cameraTarget || runningLook) return

		runningLook = true
		activeBot
			.lookAt(cameraTarget, true)
			.catch(() => {})
			.finally(() => {
				runningLook = false
			})
	}, intervalMs)
}

function stopCameraLock() {
	if (timer) clearInterval(timer)
	timer = null
	activeBot = null
	runningLook = false
}

function getCameraTarget() {
	return cameraTarget
}

module.exports = {
	setCameraTarget,
	clearCameraTarget,
	startCameraLock,
	stopCameraLock,
	getCameraTarget,
}
