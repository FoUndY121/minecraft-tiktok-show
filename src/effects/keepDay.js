const { safeSend } = require('../rcon')

function startKeepDay(commandBus, intervalMs = 60000) {
	let stopped = false

	const apply = async () => {
		if (stopped) return
		await safeSend(commandBus, '/time set day')
		await safeSend(commandBus, '/weather clear')
		await safeSend(commandBus, '/gamerule doDaylightCycle false')
		await safeSend(commandBus, '/gamerule mobGriefing false')
	}

	apply().catch(err => console.log('[KEEP_DAY] failed:', err?.message || err))
	const timer = setInterval(() => {
		apply().catch(err => console.log('[KEEP_DAY] failed:', err?.message || err))
	}, intervalMs)

	return () => {
		stopped = true
		clearInterval(timer)
	}
}

module.exports = {
	startKeepDay,
}
