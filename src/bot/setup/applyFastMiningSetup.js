const { safeSend } = require('../../rcon')

async function applyFastMiningSetup({ bot, rcon } = {}) {
	if (!bot?.username) return false
	if (bot._fastMiningSetupApplied) return true

	const commandBus = rcon || bot._commandBus || bot
	const commands = [
		`/gamemode creative ${bot.username}`,
		`/effect give ${bot.username} minecraft:haste 999999 20 true`,
		`/give ${bot.username} minecraft:netherite_pickaxe{Enchantments:[{id:"minecraft:efficiency",lvl:5s}]} 1`,
		`/give ${bot.username} minecraft:netherite_shovel{Enchantments:[{id:"minecraft:efficiency",lvl:5s}]} 1`,
	]

	for (const command of commands) {
		try {
			await safeSend(commandBus, command)
		} catch (err) {
			console.log('[BOT_SETUP] fast mining command warning:', err?.message || err)
		}
	}

	try {
		await new Promise(resolve => setTimeout(resolve, 100))
		const shovel = bot.inventory?.items?.().find(item => item.name === 'netherite_shovel')
		const pickaxe = bot.inventory?.items?.().find(item => item.name === 'netherite_pickaxe')
		if (shovel) await bot.equip(shovel, 'hand')
		else if (pickaxe) await bot.equip(pickaxe, 'hand')
	} catch (err) {
		console.log('[BOT_SETUP] equip warning:', err?.message || err)
	}

	bot._fastMiningSetupApplied = true
	return true
}

module.exports = {
	applyFastMiningSetup,
}
