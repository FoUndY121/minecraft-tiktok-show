const { safeSend } = require('../rcon')

const COUNTRY_SOUND_MAP = {
	germany: 'flags.germany',
	ukraine: 'flags.ukraine',
	lithuania: 'flags.lithuania',
	russia: 'flags.russia',
	poland: 'flags.poland',
	france: 'flags.france',
	italy: 'flags.italy',
	spain: 'flags.spain',
	usa: 'flags.usa',
	austria: 'flags.austria',
	argentina: 'flags.argentina',
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeCountry(country) {
	return String(country || '')
		.trim()
		.toLowerCase()
}

async function playFlagMusic({ rcon, objectEvent } = {}) {
	if (!rcon || !objectEvent) return false

	const country = normalizeCountry(objectEvent.country)
	console.log(`[FLAG_MUSIC] received country=${country || 'unknown'}`)

	const soundId = COUNTRY_SOUND_MAP[country]
	console.log(`[FLAG_MUSIC] soundId=${soundId || 'not_found'}`)

	if (!soundId) {
		console.log(`[FLAG_MUSIC] skip country=${country || 'unknown'} sound=not_found`)
		return false
	}

	const cameraTarget = String(process.env.CAMERA_USERNAME || '').trim() || null
	const stopCommand = '/stopsound @a master'
	const cameraCommand = cameraTarget
		? `/playsound ${soundId} master ${cameraTarget} ~ ~ ~ 10 1`
		: null
	const fallbackCommand = `/playsound ${soundId} master @a ~ ~ ~ 10 1`

	console.log(`[FLAG_MUSIC] command=${stopCommand}`)
	await safeSend(rcon, stopCommand)
	await delay(100)

	if (cameraCommand) {
		console.log(`[FLAG_MUSIC] command=${cameraCommand}`)
		await safeSend(rcon, cameraCommand)
	}

	await delay(100)
	console.log(`[FLAG_MUSIC] command=${fallbackCommand}`)
	await safeSend(rcon, fallbackCommand)

	return true
}

module.exports = {
	COUNTRY_SOUND_MAP,
	FLAG_SOUNDS: COUNTRY_SOUND_MAP,
	playFlagMusic,
}
