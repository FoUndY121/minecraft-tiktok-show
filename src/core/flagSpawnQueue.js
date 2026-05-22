const { safeSend } = require('../rcon')
const { ARENA } = require('../config/arena')

const COUNTRY_FLAGS = {
	germany: { title: 'Germany', emoji: '🇩🇪' },
	ukraine: { title: 'Ukraine', emoji: '🇺🇦' },
	poland: { title: 'Poland', emoji: '🇵🇱' },
	france: { title: 'France', emoji: '🇫🇷' },
	russia: { title: 'Russia', emoji: '🇷🇺' },
}

function commandString(value) {
	return String(value || '')
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.slice(0, 48)
}

class FlagSpawnQueue {
	constructor({
		commandBus,
		breakQueue,
		botBrain = null,
		origin = ARENA.flagOrigin,
		width = ARENA.flagWidth,
		height = ARENA.flagHeight,
		depth = ARENA.flagDepth,
	} = {}) {
		this.commandBus = commandBus
		this.breakQueue = breakQueue
		this.botBrain = botBrain
		this.origin = { ...origin }
		this.width = width
		this.height = height
		this.depth = depth
		this.queue = []
		this.isSpawning = false
		this.addedCount = 0
	}

	add(flagEvent = {}) {
		const normalized = this.createFlagEvent(flagEvent)
		this.queue.push(normalized)
		this.addedCount += 1

		if (this.addedCount === 1) console.log('[SPAWN_QUEUE] added first flag')
		console.log(
			`[SPAWN_QUEUE] added ${normalized.id} (${normalized.country}) queue=${this.queue.length}`
		)

		this.processNext().catch(err => {
			this.isSpawning = false
			console.log('[SPAWN_QUEUE] process error:', err?.message || err)
			this.processNext().catch(nextErr =>
				console.log('[SPAWN_QUEUE] recovery failed:', nextErr?.message || nextErr)
			)
		})

		return normalized
	}

	createFlagEvent(flagEvent = {}) {
		const country = String(flagEvent.country || 'germany').toLowerCase()
		const id = flagEvent.id || `flag_${Date.now()}_${country}`

		return {
			...flagEvent,
			id,
			country,
			username: flagEvent.username || 'unknown',
			origin: { ...this.origin },
			width: this.width,
			height: this.height,
			depth: this.depth,
		}
	}

	async processNext() {
		if (this.isSpawning) return

		const flagEvent = this.queue.shift()
		if (!flagEvent) return

		this.isSpawning = true
		console.log(`[SPAWN_QUEUE] started ${flagEvent.id}`)

		try {
			await this.showTitle(flagEvent)
			const spawned = await flagEvent.spawn(this.commandBus, flagEvent.origin)
			const breakEvent = {
				...flagEvent,
				origin: spawned?.origin || flagEvent.origin,
				width: spawned?.width || flagEvent.width,
				height: spawned?.height || flagEvent.height,
				depth: spawned?.depth || flagEvent.depth,
			}

			console.log(`[SPAWN_QUEUE] finished ${flagEvent.id}`)

			if (this.botBrain?.lookAtFlag) {
				this.botBrain.lookAtFlag(breakEvent).catch(err =>
					console.log('[SPAWN_QUEUE] lookAtFlag failed:', err?.message || err)
				)
			}
			if (this.breakQueue) this.breakQueue.add(breakEvent)
		} catch (err) {
			console.log(`[SPAWN_QUEUE] error ${flagEvent.id}:`, err?.message || err)
		} finally {
			this.isSpawning = false
		}

		if (this.queue.length > 0) {
			await this.processNext()
		}
	}

	async showTitle(flagEvent) {
		const def = COUNTRY_FLAGS[flagEvent.country] || COUNTRY_FLAGS.germany
		await safeSend(
			this.commandBus,
			`title @a title {"text":"${commandString(def.emoji)} ${commandString(def.title)} flag incoming!","color":"gold","bold":true}`
		)
	}

	size() {
		return this.queue.length
	}
}

module.exports = {
	FlagSpawnQueue,
	COUNTRY_FLAGS,
}
