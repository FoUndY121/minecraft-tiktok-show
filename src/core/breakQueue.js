const behavior = require('../config/botBehavior')
const reactions = require('../bot/reactions')
const { EventRegistry } = require('./eventRegistry')
const { stableBreakArena } = require('../botActions/stableBreakArena')

function withTimeout(promise, timeoutMs, onTimeout) {
	let timer = null
	const timeout = new Promise(resolve => {
		timer = setTimeout(() => {
			onTimeout?.()
			resolve({ timedOut: true })
		}, timeoutMs)
	})

	return Promise.race([promise, timeout]).finally(() => {
		if (timer) clearTimeout(timer)
	})
}

class BreakQueue {
	constructor({
		bot,
		rcon,
		options = behavior,
		stackManager = null,
		eventRegistry = new EventRegistry(),
	} = {}) {
		this.bot = bot
		this.rcon = rcon
		this.options = options
		this.stackManager = stackManager
		this.eventRegistry = eventRegistry
		this.queue = []
		this.isBreaking = false
		this.currentEvent = null
		this.currentEventStartedAt = 0
		this.breakState = null
		this.completedEventIds = new Set()
		this.completedEvents = this.completedEventIds
		this.skippedEvents = new Set()
	}

	add(objectEvent) {
		this.queue.push(objectEvent)
		console.log(
			`[BREAK_QUEUE] add id=${objectEvent.id} country=${
				objectEvent.country
			} size=${objectEvent.size || 'default'} queue=${this.queue.length}`
		)

		this.ensureProcessing()
	}

	ensureProcessing() {
		if (this.isBreaking || this.queue.length === 0) return false

		console.log('[BREAK_QUEUE] wake processNext isBreaking=false')
		this.processNext().catch(err => {
			this.isBreaking = false
			console.log('[BREAK_QUEUE] process error:', err?.message || err)
			this.ensureProcessing()
		})
		return true
	}

	async noticeFallingObject(objectEvent) {
		if (!this.isBreaking) return

		reactions
			.quickLookUp(this.bot, 90)
			.catch(err =>
				console.log('[BREAK_QUEUE] quick look up failed:', err?.message || err)
			)
		reactions
			.quickLookAtDonation(this.bot, objectEvent)
			.catch(err =>
				console.log('[BREAK_QUEUE] quick look failed:', err?.message || err)
			)
	}

	async processNext() {
		if (this.isBreaking) return

		const objectEvent = this.queue.shift()
		if (!objectEvent) return
		if (this.completedEventIds.has(objectEvent.id)) {
			setImmediate(() => this.ensureProcessing())
			return
		}

		this.isBreaking = true
		this.currentEvent = objectEvent
		this.currentEventStartedAt = Date.now()
		objectEvent.cancelled = false
		objectEvent.attempts = (objectEvent.attempts || 0) + 1
		this.breakState = {
			currentEventId: objectEvent.id,
			startedAt: this.currentEventStartedAt,
			lastProgressAt: this.currentEventStartedAt,
			brokenCount: 0,
			totalBlocks: 0,
		}
		console.log(
			`[BREAK_QUEUE] start id=${objectEvent.id} country=${objectEvent.country} attempt=${objectEvent.attempts}`
		)

		let result = null
		const maxBreakEventMs = this.options.maxBreakEventMs ?? 90000
		try {
			if (objectEvent.attempts > 2) {
				this.skippedEvents.add(objectEvent.id)
				console.log(
					`[BREAK_QUEUE] skip retry-limit id=${objectEvent.id} country=${objectEvent.country}`
				)
				return
			}

			const onProgress = () => this.markProgress(objectEvent.id)
			const breakPromise = stableBreakArena({
				bot: this.bot,
				rcon: this.rcon,
				objectEvent,
				options: this.options,
				onProgress,
			})
			result = await withTimeout(breakPromise, maxBreakEventMs, () => {
				objectEvent.cancelled = true
				console.log('[BREAK_QUEUE] event timeout, finishing safely')
			})
			if (result?.timedOut) {
				result = {
					broken: this.breakState?.brokenCount || 0,
					fallbackBroken: this.breakState?.brokenCount || 0,
					skippedAir: 0,
					leftovers: 0,
					passes: 0,
					rescans: 0,
					stopReason: 'break_queue_timeout',
				}
			}

			if (objectEvent.cancelled || this.completedEventIds.has(objectEvent.id)) {
				console.log(
					`[BREAK_QUEUE] abort finish id=${objectEvent.id} country=${objectEvent.country} cancelled=${Boolean(objectEvent.cancelled)}`
				)
				return
			}

			console.log(
				`[BREAK] finish id=${objectEvent.id} broken=${
					result?.broken ?? 0
				} fallback=${result?.fallbackBroken ?? 0} skippedAir=${
					result?.skippedAir ?? 0
				} leftovers=${result?.leftovers ?? 0} passes=${
					result?.passes ?? 0
				} rescans=${result?.rescans ?? 0}`
			)
			this.stackManager?.markObjectDestroyed?.(objectEvent)
		} catch (err) {
			console.error(
				`[BREAK_QUEUE] error id=${objectEvent.id} country=${objectEvent.country}:`,
				err?.message || err
			)
			if (objectEvent.attempts >= 2) {
				this.skippedEvents.add(objectEvent.id)
			}
		} finally {
			this.completedEventIds.add(objectEvent.id)
			this.eventRegistry.remove(objectEvent.id)
			console.log(
				`[BREAK_QUEUE] finally finish id=${objectEvent.id} broken=${
					result?.broken ?? 0
				} fallback=${result?.fallbackBroken ?? 0}`
			)
			if (!this.currentEvent || this.currentEvent.id === objectEvent.id) {
				this.currentEvent = null
			}
			this.isBreaking = false
			this.currentEventStartedAt = 0
			this.breakState = null
			setImmediate(() => this.ensureProcessing())
		}
	}

	markProgress(eventId, count = 1) {
		if (!eventId || this.breakState?.currentEventId !== eventId) return
		this.breakState.lastProgressAt = Date.now()
		this.breakState.brokenCount += count
	}

	forceFinishCurrent(reason = 'watchdog') {
		const objectEvent = this.currentEvent
		if (!objectEvent) return false
		if (this.completedEventIds.has(objectEvent.id)) return false

		objectEvent.cancelled = true
		this.skippedEvents.add(objectEvent.id)
		this.completedEventIds.add(objectEvent.id)
		this.eventRegistry.remove(objectEvent.id)
		this.isBreaking = false
		this.currentEvent = null
		this.currentEventStartedAt = 0
		this.breakState = null

		console.log(
			`[BREAK_QUEUE] force finish id=${objectEvent.id} country=${objectEvent.country} reason=${reason}`
		)
		setImmediate(() => this.ensureProcessing())
		return true
	}

	size() {
		return this.queue.length
	}
}

module.exports = {
	BreakQueue,
}
