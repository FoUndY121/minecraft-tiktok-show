const { scanFlagBlocksInArena } = require('./scanFlagBlocksInArena')

function startBreakWatchdog({
	bot,
	arena,
	breakQueue,
	spawnQueue = null,
	intervalMs = 5000,
	stuckMs = 15000,
	logger = console,
} = {}) {
	let timer = null
	let lastEventId = null
	let lastBrokenCount = 0
	let lastBrokenCountAt = 0
	let lastWarningAt = 0
	let lastLeftoverScheduleAt = 0

	async function tick() {
		if (!bot || !breakQueue) return

		try {
			const now = Date.now()
			const state = breakQueue.breakState
			const currentId =
				state?.currentEventId || breakQueue.currentEvent?.id || null

			if (breakQueue.isBreaking === true) {
				if (currentId !== lastEventId) {
					lastEventId = currentId
					lastBrokenCount = state?.brokenCount || 0
					lastBrokenCountAt = now
					return
				}

				const brokenCount = state?.brokenCount || 0
				if (brokenCount !== lastBrokenCount) {
					lastBrokenCount = brokenCount
					lastBrokenCountAt = now
					return
				}

				const lastProgressAt = state?.lastProgressAt || lastBrokenCountAt || now
				const idleFor = Math.max(now - lastProgressAt, now - lastBrokenCountAt)

				if (idleFor > 20000 && now - lastWarningAt > 20000) {
					lastWarningAt = now
					logger.log(
						`[WATCHDOG] warning: break queue no progress id=${currentId} broken=${brokenCount}/${state?.totalBlocks || 0} idleMs=${idleFor}`
					)
				}
				return
			}

			lastEventId = null
			lastBrokenCount = 0
			lastBrokenCountAt = 0

			if (now - lastLeftoverScheduleAt < 10000) return
			if (breakQueue.queue.length > 0) return
			if (spawnQueue?.isSpawning === true) return

			const positions = await scanFlagBlocksInArena({
				bot,
				arena,
				mode: 'cleanup',
			})
			if (!positions.length) return
			lastLeftoverScheduleAt = now

			logger.log(
				`[WATCHDOG] leftover blocks found, scheduling visual break event count=${positions.length}`
			)
			breakQueue.add({
				id: `leftover_break_${Date.now()}`,
				type: 'BREAK_LEFTOVERS',
				scanExisting: true,
				expandedSearch: true,
				country: 'leftovers',
				createdAt: Date.now(),
			})
		} catch (err) {
			logger.log('[WATCHDOG] scan error:', err?.message || err)
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
	startBreakWatchdog,
}
