const mineflayer = require('mineflayer')
const { isIgnoredCommandResponse } = require('./rcon')

function createMinecraftBot(env = process.env) {
	const bot = mineflayer.createBot({
		host: env.MC_HOST,
		port: env.MC_PORT ? Number(env.MC_PORT) : 25565,
		username: env.MC_USERNAME || 'TikTokBot',
		version: env.MC_VERSION, // optional; can be omitted to auto-detect in many setups
		auth: 'offline',
	})

	const connectTimeoutMs = env.MC_CONNECT_TIMEOUT_MS
		? Number(env.MC_CONNECT_TIMEOUT_MS)
		: 15000

	const connectTimeout = setTimeout(() => {
		console.log(
			`❌ Mineflayer connect timeout after ${connectTimeoutMs}ms (check MC_HOST/MC_PORT/firewall)`
		)
		try {
			bot.quit()
		} catch {}
	}, connectTimeoutMs)

	bot.once('spawn', () => {
		clearTimeout(connectTimeout)
		console.log('✅ Mineflayer bot spawned:', bot.username)
	})

	// Very useful for debugging: shows server responses to bot commands.
	bot.on('messagestr', msg => {
		const text = String(msg || '').trim()
		if (!text) return
		if (isIgnoredCommandResponse(text)) return
		console.log(`💬 [MC] ${text}`)
	})

	bot.on('kicked', reason => {
		console.log('⚠️ Bot kicked:', reason)
	})

	bot.on('error', err => {
		console.log('❌ Bot error:', err?.message || err)
	})

	bot.on('end', () => {
		clearTimeout(connectTimeout)
		console.log('⚠️ Bot disconnected')
	})

	return bot
}

module.exports = {
	createMinecraftBot,
}
