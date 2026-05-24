const { scanArenaForFlagBlocks } = require('./arenaScanner')

function startBreakWatchdog({
	bot,
	arena,
	breakQueue,
	intervalMs = 5000,
	cooldownMs = 10000,
	stuckMs = 15000,
	logger = console,
} = {}) {
	let timer = null
	let lastCleanupAt = 0
	let lastEventId = null
	let lastBrokenCount = 0
	let lastBrokenCountAt = 0

	function idleTimeoutFor(totalBlocks = 0) {
		if (totalBlocks > 500) return 45000
		if (totalBlocks > 300) return 30000
		return stuckMs
	}

	function hasCleanupQueued() {
		if (breakQueue.currentEvent?.type === 'CLEANUP_EXISTING_FLAGS') return true
		if (!Array.isArray(breakQueue.queue)) return false
		return breakQueue.queue.some(
			event => event?.type === 'CLEANUP_EXISTING_FLAGS'
		)
	}

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
				const timeoutMs = idleTimeoutFor(state?.totalBlocks || 0)

				if (idleFor > timeoutMs) {
					logger.log(
						`[WATCHDOG] break queue no progress id=${currentId} broken=${brokenCount}/${state?.totalBlocks || 0} idleMs=${idleFor}, forcing finish`
					)
					breakQueue.forceFinishCurrent?.('watchdog_stuck')
					lastEventId = null
					lastBrokenCount = 0
					lastBrokenCountAt = 0
				}
				return
			}

			lastEventId = null
			lastBrokenCount = 0
			lastBrokenCountAt = 0

			const idle =
				breakQueue.isBreaking === false &&
				Array.isArray(breakQueue.queue) &&
				breakQueue.queue.length === 0

			if (!idle) return
			if (hasCleanupQueued()) return
			if (now - lastCleanupAt < cooldownMs) return

			const positions = await scanArenaForFlagBlocks({ bot, arena })
			if (!positions.length) return
			if (breakQueue.isBreaking === true) return
			if (breakQueue.queue?.length > 0) return
			if (hasCleanupQueued()) return

			lastCleanupAt = now

			logger.log(
				`[WATCHDOG] found leftover flag blocks (${positions.length}), scheduling cleanup`
			)

			breakQueue.add({
				id: `cleanup_${Date.now()}`,
				type: 'CLEANUP_EXISTING_FLAGS',
				country: 'cleanup',
				scanExisting: true,
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
