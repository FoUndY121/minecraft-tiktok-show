const ARENA = require('../config/arena')
const objectSizes = require('../config/objectSizes')
const { safeSend } = require('../rcon')
const { spawnFallingObject } = require('../objects/spawnFallingObject')
const reactions = require('../bot/reactions')
const { StackManager } = require('./stackManager')
const { EventRegistry } = require('./eventRegistry')

let activeStackManager = new StackManager({
	baseOrigin: ARENA.origin,
	objectHeight: ARENA.height,
	maxStack: 6,
})

function setStackManager(stackManager) {
	activeStackManager = stackManager || activeStackManager
}

function resolveObjectSize({ size, width, depth, height }) {
	if (
		Number.isFinite(width) &&
		Number.isFinite(depth) &&
		Number.isFinite(height)
	) {
		return {
			width: Number(width),
			depth: Number(depth),
			height: Number(height),
			size: size || null,
		}
	}

	const key = String(size || '').toLowerCase()
	if (key && objectSizes[key]) return { ...objectSizes[key], size: key }

	return {
		width: ARENA.width,
		depth: ARENA.depth,
		height: ARENA.height,
		size: size || null,
	}
}

function createObjectEvent({
	country = 'germany',
	username = 'Someone',
	giftName = 'Gift',
	giftValue = 1,
	size = null,
	width = null,
	depth = null,
	height = null,
} = {}) {
	const normalizedCountry = String(country || 'default').toLowerCase()
	const normalizedUsername = String(username || '').trim() || 'Someone'
	const normalizedGiftName = String(giftName || '').trim() || 'Gift'
	const normalizedGiftValue = Number.isFinite(Number(giftValue))
		? Number(giftValue)
		: 1
	const stackOrigin = activeStackManager.getNextOrigin()
	const { stackIndex, targetY, stackResetRequired, ...origin } = stackOrigin
	const dims = resolveObjectSize({ size, width, depth, height })

	return {
		id: `object_${Date.now()}_${normalizedCountry}_${Math.random()
			.toString(36)
			.slice(2, 8)}`,
		type: 'FLAG_OBJECT',
		country: normalizedCountry,
		size: dims.size,
		username: normalizedUsername,
		giftName: normalizedGiftName,
		giftValue: normalizedGiftValue,
		origin,
		spawnHeight: targetY + 25,
		targetY,
		stackIndex,
		stackResetRequired,
		width: dims.width,
		depth: dims.depth,
		height: dims.height,
		createdAt: Date.now(),
	}
}

async function clearStackArea(commandBus, stackManager, objectEvent) {
	const bounds = stackManager.getClearBounds({
		// Always clear the full arena footprint, even if current gift is smaller.
		width: Math.max(ARENA.width, objectEvent.width),
		depth: Math.max(ARENA.depth, objectEvent.depth),
	})

	await safeSend(
		commandBus,
		`/fill ${bounds.x1} ${bounds.y1} ${bounds.z1} ${bounds.x2} ${bounds.y2} ${bounds.z2} minecraft:air`
	)
}

class SpawnQueue {
	constructor({
		rcon,
		bot,
		breakQueue,
		stackManager = activeStackManager,
		eventRegistry = new EventRegistry(),
	} = {}) {
		this.rcon = rcon
		this.bot = bot
		this.breakQueue = breakQueue
		this.stackManager = stackManager
		this.eventRegistry = eventRegistry
		setStackManager(stackManager)
		this.queue = []
		this.isSpawning = false
	}

	add(event) {
		const objectEvent =
			event?.type === 'FLAG_OBJECT' ? event : createObjectEvent(event)
		if (!this.eventRegistry.add(objectEvent.id)) {
			console.log(`[SPAWN_QUEUE] duplicate object ${objectEvent.id}, ignored`)
			return objectEvent
		}

		this.queue.push(objectEvent)

		console.log(
			`[SPAWN_QUEUE] add id=${objectEvent.id} country=${
				objectEvent.country
			} size=${objectEvent.size || 'default'} queue=${this.queue.length}`
		)

		this.processNext().catch(err => {
			this.isSpawning = false
			console.log('[SPAWN_QUEUE] process error:', err?.message || err)
			this.processNext().catch(nextErr =>
				console.log(
					'[SPAWN_QUEUE] recovery failed:',
					nextErr?.message || nextErr
				)
			)
		})

		return objectEvent
	}

	async processNext() {
		if (this.isSpawning) return

		const objectEvent = this.queue.shift()
		if (!objectEvent) return

		this.isSpawning = true
		console.log(
			`[SPAWN_QUEUE] start id=${objectEvent.id} country=${objectEvent.country}`
		)

		try {
			if (objectEvent.stackResetRequired) {
				console.log('[SPAWN_QUEUE] max stack reached, clearing stack area')
				await clearStackArea(this.rcon, this.stackManager, objectEvent)
			}

			reactions
				.quickLookUp(this.bot, 120)
				.catch(err =>
					console.log(
						'[SPAWN_QUEUE] quick look up failed:',
						err?.message || err
					)
				)
			reactions
				.lookAtFallingObject(this.bot, objectEvent)
				.catch(err =>
					console.log(
						'[SPAWN_QUEUE] look at falling object failed:',
						err?.message || err
					)
				)
			if (this.queue.length >= 4) {
				reactions
					.rageReaction(this.bot, 650)
					.catch(err =>
						console.log('[SPAWN_QUEUE] rage failed:', err?.message || err)
					)
			}
			if (this.breakQueue?.noticeFallingObject) {
				this.breakQueue
					.noticeFallingObject(objectEvent)
					.catch(err =>
						console.log(
							'[SPAWN_QUEUE] breakQueue notice failed:',
							err?.message || err
						)
					)
			}

			const spawnedEvent = await spawnFallingObject({
				rcon: this.rcon,
				objectEvent,
			})
			this.stackManager.markObjectSpawned(spawnedEvent)
			console.log(
				`[SPAWN_QUEUE] finish id=${objectEvent.id} country=${objectEvent.country}`
			)

			if (this.breakQueue) this.breakQueue.add(spawnedEvent)
		} catch (err) {
			console.log(
				`[SPAWN_QUEUE] error object ${objectEvent.id}/${objectEvent.country}:`,
				err?.message || err
			)
			this.eventRegistry.remove(objectEvent.id)
		} finally {
			this.isSpawning = false
			// Always continue (fix race where queue is appended during finally).
			if (this.queue.length > 0) {
				this.processNext().catch(err =>
					console.log('[SPAWN_QUEUE] next error:', err?.message || err)
				)
			}
		}
	}

	size() {
		return this.queue.length
	}
}

module.exports = {
	SpawnQueue,
	createObjectEvent,
	setStackManager,
}
