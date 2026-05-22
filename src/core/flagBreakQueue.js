const { breakFlagHumanLike } = require('../botActions/breakFlagHumanLike')
const botBehavior = require('../config/botBehavior')

class FlagBreakQueue {
	constructor({ commandBus, bot, botBrain = null, behavior = botBehavior } = {}) {
		this.commandBus = commandBus
		this.bot = bot
		this.botBrain = botBrain
		this.behavior = behavior
		this.queue = []
		this.isBreaking = false
		this.speedMultiplier = 1
	}

	add(flagEvent) {
		this.queue.push(flagEvent)
		console.log(`[BREAK_QUEUE] added ${flagEvent.id} (${flagEvent.country}) queue=${this.queue.length}`)

		this.processNext().catch(err => {
			this.isBreaking = false
			console.log('[BREAK_QUEUE] process error:', err?.message || err)
			this.processNext().catch(nextErr =>
				console.log('[BREAK_QUEUE] recovery failed:', nextErr?.message || nextErr)
			)
		})
	}

	async processNext() {
		if (this.isBreaking) return

		const flagEvent = this.queue.shift()
		if (!flagEvent) return

		this.isBreaking = true
		console.log(`[BREAK_QUEUE] started ${flagEvent.id}`)

		try {
			if (this.botBrain?.breakFlagHumanLike) {
				await this.botBrain.breakFlagHumanLike(flagEvent, this.currentBehavior())
			} else {
				await breakFlagHumanLike({
					bot: this.bot,
					rcon: this.commandBus,
					flagEvent,
					options: this.currentBehavior(),
				})
			}
			console.log(`[BREAK_QUEUE] finished ${flagEvent.id}`)
		} catch (err) {
			console.log(`[BREAK_QUEUE] error ${flagEvent.id}:`, err?.message || err)
		} finally {
			this.isBreaking = false
		}

		if (this.queue.length > 0) {
			await this.processNext()
		}
	}

	size() {
		return this.queue.length
	}

	setSpeedMultiplier(multiplier) {
		this.speedMultiplier = Math.max(1, Math.min(12, Number(multiplier) || 1))
	}

	currentBehavior() {
		return {
			...this.behavior,
			flightSpeed: this.behavior.flightSpeed * Math.min(3, this.speedMultiplier / 3),
			breakDelayMs: Math.max(5, Math.floor(this.behavior.breakDelayMs / this.speedMultiplier)),
		}
	}
}

module.exports = {
	FlagBreakQueue,
}
