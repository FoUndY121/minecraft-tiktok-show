const { breakObjectBlockByBlock } = require('../botActions/breakObjectBlockByBlock')
const reactions = require('../bot/reactions')
const behavior = require('../config/botBehavior')
const { EventRegistry } = require('./eventRegistry')

class BreakQueue {
	constructor({ bot, rcon, options = behavior, stackManager = null, eventRegistry = new EventRegistry() } = {}) {
		this.bot = bot
		this.rcon = rcon
		this.options = options
		this.stackManager = stackManager
		this.eventRegistry = eventRegistry
		this.queue = []
		this.isBreaking = false
	}

	add(objectEvent) {
		this.queue.push(objectEvent)
		console.log(
			`[BREAK_QUEUE] added object ${objectEvent.id}/${objectEvent.country} queue=${this.queue.length}`
		)

		this.processNext().catch(err => {
			this.isBreaking = false
			console.log('[BREAK_QUEUE] process error:', err?.message || err)
			this.processNext().catch(nextErr =>
				console.log('[BREAK_QUEUE] recovery failed:', nextErr?.message || nextErr)
			)
		})
	}

	async noticeFallingObject(objectEvent) {
		if (!this.isBreaking) return

		reactions.quickLookUp(this.bot, 90).catch(err =>
			console.log('[BREAK_QUEUE] quick look up failed:', err?.message || err)
		)
		reactions.quickLookAtDonation(this.bot, objectEvent).catch(err =>
			console.log('[BREAK_QUEUE] quick look failed:', err?.message || err)
		)
	}

	async processNext() {
		if (this.isBreaking) return

		const objectEvent = this.queue.shift()
		if (!objectEvent) return

		this.isBreaking = true
		console.log(`[BREAK_QUEUE] started object ${objectEvent.id}/${objectEvent.country}`)

		try {
			await breakObjectBlockByBlock({
				bot: this.bot,
				rcon: this.rcon,
				objectEvent,
				options: this.options,
			})
			console.log(`[BREAK_QUEUE] finished object ${objectEvent.id}/${objectEvent.country}`)
			this.stackManager?.markObjectDestroyed?.(objectEvent)
		} catch (err) {
			console.log(
				`[BREAK_QUEUE] error object ${objectEvent.id}/${objectEvent.country}:`,
				err?.message || err
			)
		} finally {
			this.eventRegistry.remove(objectEvent.id)
			this.isBreaking = false
		}

		if (this.queue.length > 0) {
			await this.processNext()
		}
	}

	size() {
		return this.queue.length
	}
}

module.exports = {
	BreakQueue,
}
