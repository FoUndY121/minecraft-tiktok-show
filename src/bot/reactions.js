const { Vec3 } = require('vec3')
const behavior = require('../config/botBehavior')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randomOffset(intensity) {
	return (Math.random() - 0.5) * intensity
}

function objectCenter(objectEvent, yOverride = null) {
	const origin = objectEvent.origin
	const y = yOverride ?? origin.y

	return new Vec3(
		origin.x + objectEvent.width / 2,
		y + objectEvent.height / 2,
		origin.z + objectEvent.depth / 2
	)
}

async function safeLookAt(bot, target, force = true) {
	try {
		if (bot?.entity?.position) await bot.lookAt(target, force)
	} catch (err) {
		console.log('[REACTION] look failed:', err?.message || err)
	}
}

async function safeSwing(bot) {
	try {
		bot?.swingArm?.('right')
	} catch {}
}

async function quickLookUp(bot, durationMs = 180) {
	const p = bot?.entity?.position
	if (!p) return

	await safeLookAt(bot, new Vec3(p.x + randomOffset(0.4), p.y + 18, p.z + randomOffset(0.4)), true)
	await delay(durationMs)
}

async function lookAtDonation(bot, objectEvent) {
	await quickLookUp(bot, 90)
	await safeLookAt(bot, objectCenter(objectEvent, objectEvent.spawnHeight), true)
	await delay(100)
}

async function lookAtFallingObject(bot, objectEvent) {
	await lookAtDonation(bot, objectEvent)
	await safeLookAt(
		bot,
		objectCenter(objectEvent, objectEvent.spawnHeight).offset(randomOffset(0.7), randomOffset(0.5), randomOffset(0.7)),
		false
	)
}

async function quickLookAtDonation(bot, objectEvent) {
	await lookAtDonation(bot, objectEvent)
	await panicShakeCamera(bot, behavior.reactionShortMs)
}

async function panicShakeCamera(bot, durationMs = behavior.reactionLongMs, intensity = behavior.cameraShakeIntensity) {
	const start = Date.now()

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		await safeLookAt(
			bot,
			new Vec3(
				p.x + randomOffset(intensity * 14),
				p.y + 1 + randomOffset(intensity * 7),
				p.z + randomOffset(intensity * 14)
			),
			false
		)
		await delay(behavior.cameraShakeIntervalMs)
	}
}

async function angryShakeCamera(bot, durationMs = behavior.reactionShortMs, intensity = behavior.cameraShakeIntensity) {
	const start = Date.now()

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		await safeLookAt(
			bot,
			new Vec3(
				p.x + randomOffset(intensity * 8),
				p.y + 0.9 + randomOffset(intensity * 3),
				p.z + 3 + randomOffset(intensity * 4)
			),
			false
		)
		await safeSwing(bot)
		await delay(behavior.cameraShakeIntervalMs)
	}
}

async function scaredLookAround(bot, durationMs = behavior.reactionShortMs) {
	const start = Date.now()
	let i = 0

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		const radius = 5 + Math.random() * 4
		const points = [
			new Vec3(p.x + radius, p.y + 1.4, p.z),
			new Vec3(p.x - radius, p.y + 1.4, p.z),
			new Vec3(p.x, p.y + 3.2, p.z + radius),
			new Vec3(p.x, p.y + 0.2, p.z - radius),
		]
		await safeLookAt(bot, points[i % points.length], false)
		i += 1
		await delay(115)
	}
}

async function exhaustedLookDown(bot, durationMs = behavior.reactionLongMs) {
	const start = Date.now()

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		await safeLookAt(bot, new Vec3(p.x + randomOffset(0.25), p.y - 2.7, p.z + 1), false)
		await delay(140)
	}
}

async function celebrate(bot, durationMs = behavior.reactionShortMs) {
	const start = Date.now()

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		await safeLookAt(bot, new Vec3(p.x + randomOffset(2), p.y + 3, p.z + 4), false)
		await safeSwing(bot)
		await delay(90)
	}
}

async function rageReaction(bot, durationMs = behavior.reactionLongMs) {
	const start = Date.now()

	while (Date.now() - start < durationMs) {
		const p = bot?.entity?.position
		if (!p) return

		await safeLookAt(
			bot,
			new Vec3(
				p.x + randomOffset(5.5),
				p.y + randomOffset(3.2),
				p.z + randomOffset(5.5)
			),
			false
		)
		await safeSwing(bot)
		await delay(55)
	}
}

async function tntPanic(bot, durationMs = 1000) {
	const p = bot?.entity?.position
	if (!p) return

	await safeLookAt(bot, new Vec3(p.x - 3, p.y + 1, p.z - 3), true)
	await panicShakeCamera(bot, durationMs, behavior.cameraShakeIntensity * 1.4)
}

const lookAroundConfused = scaredLookAround
const sadLookDown = exhaustedLookDown
const lookAtNewFlag = lookAtFallingObject
const nodYes = celebrate

module.exports = {
	quickLookUp,
	lookAtDonation,
	lookAtFallingObject,
	panicShakeCamera,
	angryShakeCamera,
	scaredLookAround,
	exhaustedLookDown,
	celebrate,
	rageReaction,
	tntPanic,
	quickLookAtDonation,
	objectCenter,
	lookAroundConfused,
	sadLookDown,
	lookAtNewFlag,
	nodYes,
}
