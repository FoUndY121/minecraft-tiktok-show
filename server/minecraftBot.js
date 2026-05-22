const mineflayer = require('mineflayer')

let bot
let canReact = true

function connectMinecraftBot() {
	bot = mineflayer.createBot({
		host: process.env.MC_HOST,
		port: Number(process.env.MC_PORT),
		username: process.env.MC_USERNAME,
		version: process.env.MC_VERSION,
		auth: 'offline',
	})

	bot.once('spawn', () => {
		console.log('✅ Minecraft bot spawned')
		console.log('👊 Hit or swing near the bot to trigger firework')

		bot.clearControlStates()

		bot.on('entitySwingArm', entity => {
			if (!bot.entity || !entity || entity.type !== 'player') return
			if (entity.username === bot.username) return

			const distance = bot.entity.position.distanceTo(entity.position)

			if (distance <= 4 && canReact) {
				canReact = false

				console.log(`💥 ${entity.username} hit/swing near bot`)
				reactToHit()

				setTimeout(() => {
					canReact = true
				}, 500)
			}
		})
	})

	bot.on('error', err => {
		console.log('❌ Minecraft bot error:', err.message)
	})

	bot.on('end', () => {
		console.log('⚠️ Bot disconnected')
	})

	return bot
}

function reactToHit() {
	if (!bot || !bot.entity) return

	bot.clearControlStates()

	bot.chat('/execute at TikTokBot run summon firework_rocket ~ ~1 ~')

	bot.setControlState('jump', true)

	setTimeout(() => {
		if (bot) bot.setControlState('jump', false)
	}, 200)

	const yaw = bot.entity.yaw + (Math.random() - 0.5) * 1.5
	const pitch = bot.entity.pitch

	bot.look(yaw, pitch, true)
}

module.exports = {
	connectMinecraftBot,
}
