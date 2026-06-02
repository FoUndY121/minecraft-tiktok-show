const { safeSend } = require('../rcon')

function startKeepDay(commandBus, intervalMs = 60000) {
	let stopped = false

	const apply = async () => {
		if (stopped) return
		const commands = [
			'/time set day',
			'/weather clear',
			'/gamerule doDaylightCycle false',
			'/gamerule mobGriefing false',
			'/gamerule doFireTick false',
			'/gamerule tntExplodes false',
		]

		for (const command of commands) {
			try {
				await safeSend(commandBus, command)
			} catch (err) {
				console.log(
					`[KEEP_DAY] gamerule warning command="${command}":`,
					err?.message || err
				)
			}
		}
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
