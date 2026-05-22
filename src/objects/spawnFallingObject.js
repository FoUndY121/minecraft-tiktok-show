const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const { safeSend } = require('../rcon')
const { buildObjectCommands } = require('./objectBuilder')
const { showDonationTitle } = require('../effects/donationTitle')
const { showFloatingDonationText } = require('../effects/floatingText')
const { spawnLightningAroundObject, thunderSounds } = require('../effects/lightning')
const { spawnFireworksAroundObject } = require('../effects/fireworks')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const behavior = require('../config/botBehavior')
const { getCountryBlock } = require('./objectBuilder')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function withY(origin, y) {
	return { x: origin.x, y, z: origin.z }
}

function objectCenter(objectEvent, y) {
	return new Vec3(
		objectEvent.origin.x + objectEvent.width / 2,
		y + objectEvent.height / 2,
		objectEvent.origin.z + objectEvent.depth / 2
	)
}

async function safeCommand(commandBus, command) {
	try {
		await safeSend(commandBus, command)
	} catch (err) {
		console.log('[FALLING_OBJECT] command failed:', err?.message || err)
	}
}

async function buildObjectAt(commandBus, objectEvent, y) {
	const commands = buildObjectCommands({
		country: objectEvent.country,
		origin: withY(objectEvent.origin, y),
		width: objectEvent.width,
		depth: objectEvent.depth,
		height: objectEvent.height,
	})

	for (const command of commands) {
		await safeCommand(commandBus, command)
	}
}

async function fallingParticles(commandBus, objectEvent, y) {
	const center = objectCenter(objectEvent, y)
	const block = getCountryBlock(objectEvent.country)

	await safeCommand(
		commandBus,
		`/particle minecraft:cloud ${center.x.toFixed(2)} ${center.y.toFixed(2)} ${center.z.toFixed(2)} 2.8 1.1 2.8 0.04 45 force`
	)
	await safeCommand(
		commandBus,
		`/particle minecraft:block minecraft:${block} ${center.x.toFixed(2)} ${center.y.toFixed(2)} ${center.z.toFixed(2)} 2.5 1.0 2.5 0.05 24 force`
	)
}

async function spawnFallingObject({ rcon, objectEvent }) {
	const commandBus = rcon
	const targetY = objectEvent.targetY ?? objectEvent.origin.y ?? ARENA.groundY
	const spawnY = objectEvent.spawnHeight

	setCameraTarget(objectCenter(objectEvent, spawnY))

	await Promise.allSettled([
		showDonationTitle({ rcon: commandBus, objectEvent }),
		showFloatingDonationText({ rcon: commandBus, objectEvent }),
		spawnFireworksAroundObject({ rcon: commandBus, objectEvent, count: 3 }),
		spawnLightningAroundObject({ rcon: commandBus, objectEvent, count: 2 }),
	])
	thunderSounds({ rcon: commandBus, objectEvent }).catch(err =>
		console.log('[FALLING_OBJECT] thunder failed:', err?.message || err)
	)

	await buildObjectAt(commandBus, objectEvent, spawnY)
	fallingParticles(commandBus, objectEvent, spawnY).catch(err =>
		console.log('[FALLING_OBJECT] particles failed:', err?.message || err)
	)

	await delay(behavior.gravitySettleDelayMs || 1800)
	setCameraTarget(objectCenter(objectEvent, targetY))

	await safeCommand(
		commandBus,
		`/playsound minecraft:block.sand.place master @a ${objectEvent.origin.x + 3} ${targetY + 2} ${objectEvent.origin.z + 3} 0.8 0.75`
	)

	return {
		...objectEvent,
		origin: { ...objectEvent.origin, y: targetY },
		targetY,
	}
}

module.exports = {
	spawnFallingObject,
}
