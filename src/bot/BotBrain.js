const { Vec3 } = require('vec3')
const { flyToPosition } = require('./movement/flyToPosition')
const reactions = require('./reactions')
const { breakFlagHumanLike } = require('../botActions/breakFlagHumanLike')
const defaultBehavior = require('../config/botBehavior')

const STATES = {
	IDLE: 'IDLE',
	WATCHING_FLAG: 'WATCHING_FLAG',
	FLYING_TO_FLAG: 'FLYING_TO_FLAG',
	BREAKING_FLAG: 'BREAKING_FLAG',
	REACTING_TO_DONATION: 'REACTING_TO_DONATION',
	PANIC: 'PANIC',
	CELEBRATING: 'CELEBRATING',
}

class BotBrain {
	constructor({ bot, rcon, behavior = defaultBehavior } = {}) {
		this.bot = bot
		this.rcon = rcon
		this.behavior = { ...defaultBehavior, ...behavior }
		this.state = STATES.IDLE
		this.currentFlag = null
	}

	setState(state) {
		this.state = state
	}

	getState() {
		return this.state
	}

	async lookAtFlag(flagEvent) {
		const previous = this.state
		this.setState(STATES.WATCHING_FLAG)
		try {
			await reactions.lookAtNewFlag(this.bot, flagEvent)
		} catch (err) {
			console.log('⚠️ BotBrain lookAtFlag failed:', err?.message || err)
		} finally {
			this.setState(previous === STATES.BREAKING_FLAG ? STATES.BREAKING_FLAG : STATES.IDLE)
		}
	}

	async flyToFlag(flagEvent) {
		this.setState(STATES.FLYING_TO_FLAG)
		try {
			const target = this.viewPositionForFlag(flagEvent)
			await flyToPosition(this.bot, target, {
				commandBus: this.rcon,
				speed: this.behavior.flightSpeed,
				intervalMs: this.behavior.flightIntervalMs,
				stopDistance: this.behavior.flightStopDistance,
				lookAtTarget: true,
			})
			await reactions.lookAtNewFlag(this.bot, flagEvent)
		} catch (err) {
			console.log('⚠️ BotBrain flyToFlag failed:', err?.message || err)
		}
	}

	async breakFlagHumanLike(flagEvent, options = {}) {
		this.currentFlag = flagEvent
		this.setState(STATES.BREAKING_FLAG)
		try {
			return await breakFlagHumanLike({
				bot: this.bot,
				rcon: this.rcon,
				flagEvent,
				botBrain: this,
				options: { ...this.behavior, ...options },
			})
		} catch (err) {
			console.log('❌ BotBrain breakFlagHumanLike failed:', err?.message || err)
			return { ok: false, error: err?.message || String(err) }
		} finally {
			this.currentFlag = null
			this.setState(STATES.IDLE)
		}
	}

	async reactToDonation(event = {}) {
		const previous = this.state
		const tier = event.tier || 'small'
		this.setState(tier === 'series' ? STATES.PANIC : STATES.REACTING_TO_DONATION)

		try {
			if (tier === 'series') {
				await this.panicShakeCamera(this.behavior.reactionLongMs)
			} else if (tier === 'large') {
				await this.sadLookDown(this.behavior.reactionLongMs)
			} else if (tier === 'medium') {
				await this.panicShakeCamera(this.behavior.reactionShortMs)
			} else {
				await this.angryShakeCamera(this.behavior.reactionShortMs)
			}
		} catch (err) {
			console.log('⚠️ BotBrain reactToDonation failed:', err?.message || err)
		} finally {
			this.setState(previous === STATES.BREAKING_FLAG ? STATES.BREAKING_FLAG : STATES.IDLE)
		}
	}

	async panicShakeCamera(durationMs) {
		this.setState(STATES.PANIC)
		await reactions.panicShakeCamera(
			this.bot,
			durationMs,
			this.behavior.cameraShakeIntensity * 1.4
		)
	}

	async angryShakeCamera(durationMs) {
		await reactions.angryShakeCamera(
			this.bot,
			durationMs,
			this.behavior.cameraShakeIntensity
		)
	}

	async sadLookDown(durationMs) {
		await reactions.sadLookDown(this.bot, durationMs)
	}

	async celebrate(durationMs = this.behavior.reactionShortMs) {
		this.setState(STATES.CELEBRATING)
		try {
			await reactions.nodYes(this.bot, durationMs)
		} catch (err) {
			console.log('⚠️ BotBrain celebrate failed:', err?.message || err)
		} finally {
			this.setState(STATES.IDLE)
		}
	}

	viewPositionForFlag(flagEvent) {
		const origin = flagEvent.origin
		return new Vec3(
			origin.x + flagEvent.width / 2,
			origin.y + Math.max(2, flagEvent.height * 0.55),
			origin.z + (this.behavior.breakSideOffsetZ || 4)
		)
	}
}

module.exports = {
	BotBrain,
	STATES,
}
