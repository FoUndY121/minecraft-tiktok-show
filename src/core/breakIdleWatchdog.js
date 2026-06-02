const { scanFlagBlocksInArena } = require('./scanFlagBlocksInArena')

function startBreakIdleWatchdog({
	bot,
	arena,
	breakQueue,
	intervalMs = 5000,
	logger = console,
} = {}) {
	let timer = null
	let ticking = false

	async function tick() {
		if (!breakQueue || ticking) return
		ticking = true

		try {
			if (breakQueue.queue.length > 0 && breakQueue.isBreaking === false) {
				logger.log(
					'[IDLE_WATCHDOG] breakQueue has items but is idle, waking processNext'
				)
				breakQueue.ensureProcessing?.()
			}

			const currentEvent = breakQueue.currentEvent
			if (bot?.blockAt && currentEvent && breakQueue.isBreaking === false) {
				const blocks = await scanFlagBlocksInArena({
					bot,
					arena,
					objectEvent: currentEvent,
					mode: 'event',
				})
				if (blocks.length > 0) {
					logger.log(
						`[IDLE_WATCHDOG] current event area has flag blocks count=${blocks.length}, waking processNext`
					)
					breakQueue.ensureProcessing?.()
				}
			}
		} catch (err) {
			logger.log('[IDLE_WATCHDOG] tick error:', err?.message || err)
		} finally {
			ticking = false
		}
	}

	function start() {
		if (timer) return
		timer = setInterval(tick, intervalMs)
		timer.unref?.()
	}

	function stop() {
		if (!timer) return
		clearInterval(timer)
		timer = null
	}

	return { start, stop, tick }
}

module.exports = {
	startBreakIdleWatchdog,
}
