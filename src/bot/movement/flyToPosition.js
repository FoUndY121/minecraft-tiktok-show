const { Vec3 } = require('vec3')
const { safeSend } = require('../../rcon')
const behavior = require('../../config/botBehavior')
const { teleportLookingAt } = require('./teleportLookingAt')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function asVec3(pos) {
	return pos instanceof Vec3 ? pos : new Vec3(pos.x, pos.y, pos.z)
}

function distance(a, b) {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

function clearMovement(bot) {
	if (!bot?.setControlState) return
	for (const control of ['forward', 'back', 'left', 'right', 'jump', 'sneak']) {
		bot.setControlState(control, false)
	}
}

function jitter(value) {
	return (Math.random() - 0.5) * value
}

function livingTarget(destination, tick, enabled) {
	if (!enabled) return destination

	const orbit = Math.sin(tick / 5) * 0.12
	const lift = Math.cos(tick / 7) * 0.08

	return new Vec3(destination.x + orbit + jitter(0.035), destination.y + lift, destination.z + jitter(0.035))
}

async function prepareFlight(bot, commandBus) {
	if (!bot?.username) return

	await safeSend(commandBus, `/gamemode creative ${bot.username}`)
	await safeSend(commandBus, `/effect give ${bot.username} minecraft:haste 999999 10 true`)

	try {
		if (bot.creative?.startFlying) bot.creative.startFlying()
	} catch {}
}

async function flyToPosition(bot, target, options = {}) {
	const commandBus = options.rcon || options.commandBus || bot?._commandBus || null
	const speed = options.flightSpeed || options.speed || behavior.flightSpeed
	const intervalMs = options.flightIntervalMs || options.intervalMs || behavior.flightIntervalMs
	const stopDistance = options.stopDistance || behavior.stopDistance
	const timeoutMs = options.timeoutMs || 8000
	const destination = asVec3(target)
	const lookAtTarget = options.lookAt ? asVec3(options.lookAt) : destination
	const startedAt = Date.now()
	const livingMotion = options.livingMotion !== false
	let tick = 0

	if (!bot?.entity?.position) return false

	await prepareFlight(bot, commandBus)

	while (Date.now() - startedAt < timeoutMs) {
		const current = bot.entity?.position
		if (!current) return false

		const dist = distance(current, destination)
		if (dist <= stopDistance) {
			clearMovement(bot)
			return true
		}

		const visualTarget = livingTarget(lookAtTarget, tick, livingMotion)
		try {
			await bot.lookAt(visualTarget, true)
		} catch {}

		const configuredStep = behavior.teleportStepSize
		const maxStep = configuredStep || speed * (intervalMs / 100)
		const t = Math.min(1, maxStep / Math.max(dist, 0.001))
		const next = new Vec3(
			current.x + (destination.x - current.x) * t,
			current.y + (destination.y - current.y) * t,
			current.z + (destination.z - current.z) * t
		)

		if (commandBus && bot.username) {
			await teleportLookingAt({
				rcon: commandBus,
				botName: bot.username,
				position: next,
				lookTarget: lookAtTarget,
			})
		} else {
			bot.setControlState('forward', true)
			bot.setControlState('jump', next.y > current.y + 0.15)
			bot.setControlState('sneak', next.y < current.y - 0.15)
		}

		try {
			await bot.lookAt(lookAtTarget, true)
		} catch {}

		tick += 1
		await delay(behavior.teleportStepIntervalMs || intervalMs)
	}

	clearMovement(bot)
	return false
}

module.exports = {
	flyToPosition,
	clearMovement,
}
