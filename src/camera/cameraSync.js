const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')

function enabledFromEnv(env = process.env) {
	return String(env.ENABLE_CAMERA_SYNC || '').toLowerCase() === 'true'
}

function radiansToDegrees(value) {
	return (value * 180) / Math.PI
}

function normalizeAngle(degrees) {
	let value = degrees % 360
	if (value > 180) value -= 360
	if (value < -180) value += 360
	return value
}

function angleLerp(from, to, amount) {
	return normalizeAngle(from + normalizeAngle(to - from) * amount)
}

function lerp(from, to, amount) {
	return from + (to - from) * amount
}

function getBotPose(bot) {
	const p = bot?.entity?.position
	if (!p) return null

	return {
		x: p.x,
		y: p.y + 0.05,
		z: p.z,
		yaw: normalizeAngle(radiansToDegrees(bot.entity.yaw || 0)),
		pitch: normalizeAngle(radiansToDegrees(bot.entity.pitch || 0)),
	}
}

class CameraSync {
	constructor({
		bot,
		rcon,
		enabled = enabledFromEnv(),
		cameraUsername = process.env.CAMERA_USERNAME,
		cameraMode = process.env.CAMERA_MODE || 'first_person',
		intervalMs = process.env.CAMERA_SYNC_INTERVAL_MS
			? Number(process.env.CAMERA_SYNC_INTERVAL_MS)
			: behavior.cameraSyncIntervalMs,
	} = {}) {
		this.bot = bot
		this.rcon = rcon
		this.enabled = Boolean(enabled)
		this.cameraUsername = cameraUsername
		this.cameraMode = cameraMode
		this.intervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60
		this.timer = null
		this.currentPose = null
		this.lastTargetPose = null
		this.lastWarningAt = 0
	}

	start() {
		if (!this.enabled) {
			console.log('[CAMERA_SYNC] disabled. Set ENABLE_CAMERA_SYNC=true to enable.')
			return
		}
		if (!this.cameraUsername) {
			console.log('[CAMERA_SYNC] disabled. CAMERA_USERNAME is empty.')
			return
		}
		if (this.timer) return

		this.timer = setInterval(() => {
			this.syncOnce().catch(err => this.warn(err?.message || err))
		}, this.intervalMs)

		console.log(
			`[CAMERA_SYNC] ${this.cameraUsername} follows bot every ${this.intervalMs}ms (${this.cameraMode})`
		)
	}

	stop() {
		if (!this.timer) return
		clearInterval(this.timer)
		this.timer = null
	}

	warn(message) {
		const now = Date.now()
		if (now - this.lastWarningAt < 10000) return
		this.lastWarningAt = now
		console.log('[CAMERA_SYNC] waiting:', message)
	}

	async syncOnce() {
		if (!this.enabled || !this.rcon || !this.cameraUsername) return

		const target = getBotPose(this.bot)
		if (!target) return

		if (!this.currentPose) this.currentPose = { ...target }

		const previousTarget = this.lastTargetPose || target
		const moveDistance = Math.sqrt(
			(target.x - previousTarget.x) ** 2 +
				(target.y - previousTarget.y) ** 2 +
				(target.z - previousTarget.z) ** 2
		)
		const sharpTurn =
			Math.abs(normalizeAngle(target.yaw - previousTarget.yaw)) > 30 ||
			Math.abs(normalizeAngle(target.pitch - previousTarget.pitch)) > 20

		const amount = moveDistance > 2 || sharpTurn ? 0.9 : 0.54
		this.currentPose = {
			x: lerp(this.currentPose.x, target.x, amount),
			y: lerp(this.currentPose.y, target.y, amount),
			z: lerp(this.currentPose.z, target.z, amount),
			yaw: angleLerp(this.currentPose.yaw, target.yaw, amount),
			pitch: angleLerp(this.currentPose.pitch, target.pitch, amount),
		}
		this.lastTargetPose = { ...target }

		await safeSend(
			this.rcon,
			`/tp ${this.cameraUsername} ${this.currentPose.x.toFixed(3)} ${this.currentPose.y.toFixed(3)} ${this.currentPose.z.toFixed(3)} ${this.currentPose.yaw.toFixed(2)} ${this.currentPose.pitch.toFixed(2)}`
		)
	}

	status() {
		return {
			enabled: this.enabled,
			running: Boolean(this.timer),
			cameraUsername: this.cameraUsername || null,
			cameraMode: this.cameraMode,
			intervalMs: this.intervalMs,
			currentPose: this.currentPose
				? {
						x: Number(this.currentPose.x.toFixed(3)),
						y: Number(this.currentPose.y.toFixed(3)),
						z: Number(this.currentPose.z.toFixed(3)),
						yaw: Number(this.currentPose.yaw.toFixed(2)),
						pitch: Number(this.currentPose.pitch.toFixed(2)),
					}
				: null,
		}
	}
}

module.exports = {
	CameraSync,
	getBotPose,
	enabledFromEnv,
}
