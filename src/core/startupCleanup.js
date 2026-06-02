const { safeSend } = require('../rcon')
const { scanFlagBlocksInArena } = require('./scanFlagBlocksInArena')

async function runStartupCleanup({ bot, rcon, arena } = {}) {
	const commandBus = rcon || bot
	if (!bot?.blockAt || !commandBus) return { removed: 0 }

	const blocks = await scanFlagBlocksInArena({
		bot,
		arena,
		mode: 'cleanup',
	})
	let removed = 0

	for (const pos of blocks) {
		const block = bot.blockAt(pos)
		if (!block || block.name === 'air') continue
		await safeSend(commandBus, `/setblock ${pos.x} ${pos.y} ${pos.z} minecraft:air`)
		removed += 1
	}

	console.log(`[STARTUP_CLEANUP] removed=${removed}`)
	return { removed }
}

module.exports = {
	runStartupCleanup,
}
