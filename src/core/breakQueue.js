const ARENA = require('../config/arena')
const behavior = require('../config/botBehavior')
const reactions = require('../bot/reactions')
const { EventRegistry } = require('./eventRegistry')
const {
	breakObjectBlockByBlock,
} = require('../botActions/breakObjectBlockByBlock')
const {
	fastBreakVisibleFlagBlocks,
} = require('../botActions/fastBreakVisibleFlagBlocks')
const { findObjectBlocks } = require('../objects/findObjectBlocks')
const { scanArenaForFlagBlocks } = require('./arenaScanner')

function arenaForScan() {
	return {
		origin: ARENA.origin,
		maxWidth: ARENA.width,
		maxDepth: ARENA.depth,
		maxHeight: ARENA.height,
		maxStack: 6,
	}
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

		// Always attempt to start immediately (fix "first event waits for second").
		this.processNext().catch(err => {
			this.isBreaking = false
			console.log('[BREAK_QUEUE] process error:', err?.message || err)
			this.processNext().catch(nextErr =>
				console.log(
					'[BREAK_QUEUE] recovery failed:',
					nextErr?.message || nextErr
				)
			)
		})
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
			setImmediate(() =>
				this.processNext().catch(err =>
					console.log('[BREAK_QUEUE] next error:', err?.message || err)
				)
			)
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

		try {
			if (objectEvent.attempts > 2) {
				this.skippedEvents.add(objectEvent.id)
				this.completedEventIds.add(objectEvent.id)
				console.log(
					`[BREAK_QUEUE] skip retry-limit id=${objectEvent.id} country=${objectEvent.country}`
				)
				return
			}

			let foundPositions = []
			try {
				foundPositions = await findObjectBlocks({
					bot: this.bot,
					objectEvent,
					arena: arenaForScan(),
				})
			} catch {}

			if (!foundPositions.length) {
				try {
					foundPositions = await scanArenaForFlagBlocks({
						bot: this.bot,
						arena: arenaForScan(),
					})
				} catch {}
			}

			if (!foundPositions.length) {
				this.skippedEvents.add(objectEvent.id)
				this.completedEventIds.add(objectEvent.id)
				console.log(
					`[BREAK_QUEUE] skip id=${objectEvent.id} country=${objectEvent.country} attempts=${objectEvent.attempts}`
				)
				return
			}

			if (this.breakState?.currentEventId === objectEvent.id) {
				this.breakState.totalBlocks = foundPositions.length
			}

			console.log(
				`[BREAK_QUEUE] found ${foundPositions.length} blocks id=${objectEvent.id}`
			)

			const onProgress = () => this.markProgress(objectEvent.id)
			const result = this.options.fastBreakMode
				? await fastBreakVisibleFlagBlocks({
						bot: this.bot,
						rcon: this.rcon,
						objectEvent,
						onProgress,
				  })
				: await breakObjectBlockByBlock({
						bot: this.bot,
						rcon: this.rcon,
						objectEvent,
						options: this.options,
						onProgress,
				  })

			if (objectEvent.cancelled || this.completedEventIds.has(objectEvent.id)) {
				console.log(
					`[BREAK_QUEUE] abort finish id=${objectEvent.id} country=${objectEvent.country} cancelled=${Boolean(objectEvent.cancelled)}`
				)
				return
			}

			console.log(
				`[BREAK_QUEUE] finish id=${objectEvent.id} broken=${
					result?.broken ?? 'n/a'
				} fallback=${result?.fallbackBroken ?? 'n/a'}`
			)
			this.stackManager?.markObjectDestroyed?.(objectEvent)
			this.completedEventIds.add(objectEvent.id)
		} catch (err) {
			console.log(
				`[BREAK_QUEUE] error id=${objectEvent.id} country=${objectEvent.country}:`,
				err?.message || err
			)
			if (objectEvent.attempts >= 2) {
				this.skippedEvents.add(objectEvent.id)
				this.completedEventIds.add(objectEvent.id)
			}
		} finally {
			this.eventRegistry.remove(objectEvent.id)
			if (this.currentEvent?.id === objectEvent.id) {
				this.isBreaking = false
				this.currentEvent = null
				this.currentEventStartedAt = 0
				this.breakState = null
				setImmediate(() =>
					this.processNext().catch(err =>
						console.log('[BREAK_QUEUE] next error:', err?.message || err)
					)
				)
			}
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
		setImmediate(() =>
			this.processNext().catch(err =>
				console.log('[BREAK_QUEUE] watchdog next error:', err?.message || err)
			)
		)
		return true
	}

	size() {
		return this.queue.length
	}
}

module.exports = {
	BreakQueue,
}
