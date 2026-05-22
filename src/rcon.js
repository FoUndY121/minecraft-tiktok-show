const { Rcon } = require('rcon-client')

const IGNORED_COMMAND_RESPONSES = [
	'',
	'No blocks were filled',
	'commands.fill.failed',
	'Teleported',
	'No entity was found',
	'Found no elements matching',
	'Unable to summon entity',
	'Applied effect',
	'Changed the weather',
	'Set the time',
	'Summoned new Falling',
	'Summoned new TNT',
	'Summoned new Firework',
	'Summoned new Creeper',
	'Summoned new Zombie',
	'Killed Falling Block',
]

function isIgnoredCommandResponse(response) {
	const text = String(response || '').trim()
	if (!text) return true
	return IGNORED_COMMAND_RESPONSES.some(pattern => text.includes(pattern))
}

function getRconConfigFromEnv(env = process.env) {
	return {
		host: env.RCON_HOST,
		port: env.RCON_PORT ? Number(env.RCON_PORT) : 25575,
		password: env.RCON_PASSWORD,
	}
}

async function createRconClient(env = process.env) {
	const cfg = getRconConfigFromEnv(env)

	// RCON is optional for MVP: if config is missing, we run without it.
	if (!cfg.host || !cfg.password) {
		return null
	}

	try {
		return await Rcon.connect({
			host: cfg.host,
			port: cfg.port,
			password: cfg.password,
		})
	} catch (err) {
		console.log('⚠️ RCON unavailable:', err?.message || err)
		return null
	}
}

async function safeSend(commandBus, command) {
	if (!commandBus) return null
	const normalizedCommand = String(command || '').replace(/^\/+/, '')
	try {
		// 1) Real RCON client
		if (typeof commandBus.send === 'function') {
			const response = await commandBus.send(normalizedCommand)
			return isIgnoredCommandResponse(response) ? null : response
		}

		// 2) LAN fallback: allow passing Mineflayer bot instead of RCON
		if (typeof commandBus.chat === 'function') {
			commandBus.chat(`/${normalizedCommand}`)
			return null
		}

		return null
	} catch (err) {
		const message = err?.message || String(err)
		if (!isIgnoredCommandResponse(message)) {
			console.log('❌ RCON command failed:', message)
		}
		return null
	}
}

async function safeRconCommand(commandBus, command) {
	return await safeSend(commandBus, command)
}

module.exports = {
	createRconClient,
	safeSend,
	safeRconCommand,
	isIgnoredCommandResponse,
}
