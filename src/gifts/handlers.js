const ARENA = require('../config/arena')
const { createObjectEvent } = require('../core/spawnQueue')
const reactions = require('../bot/reactions')
const { randomChaos, expensiveGiftWeather } = require('../effects/chaosEvents')
const { spawnTntNearBot } = require('../effects/spawnTntNearBot')
const { lightningBurst, thunderSounds } = require('../effects/lightning')
const { fireworksBurst } = require('../effects/fireworks')
const { scanArenaForFlagBlocks } = require('../core/arenaScanner')
const { normalizeGiftName, resolveGift } = require('./resolveGift')

function extractGiftPayload(input = {}) {
	const data = input.data || input

	return {
		giftKey:
			input.giftName || data.gift || data.giftName || data.name || 'Gift',
		username:
			input.username ||
			data.nickname ||
			data.uniqueId ||
			data.username ||
			data.user ||
			'Someone',
		giftName: data.giftName || input.giftName || data.gift || 'Gift',
		giftValue: data.diamondCount || data.giftValue || data.value || 1,
	}
}

function arenaForScan() {
	return {
		origin: ARENA.origin,
		maxWidth: ARENA.width,
		maxDepth: ARENA.depth,
		maxHeight: ARENA.height,
		maxStack: 6,
	}
}

function createGiftHandlers({
	bot,
	rcon,
	spawnQueue,
	breakQueue = null,
	arena = arenaForScan(),
} = {}) {
	const giftTimes = []
	let lastCleanupAt = 0

	function registerGiftRush() {
		const now = Date.now()
		giftTimes.push(now)
		while (giftTimes.length > 0 && now - giftTimes[0] > 40000) giftTimes.shift()
		return giftTimes.length
	}

	function reactToGiftRush(count) {
		if (count >= 12) {
			reactions
				.rageReaction(bot, 900)
				.catch(err =>
					console.log('[GIFTS] rage reaction failed:', err?.message || err)
				)
		} else if (count >= 8) {
			reactions
				.scaredLookAround(bot, 600)
				.catch(err =>
					console.log('[GIFTS] rush reaction failed:', err?.message || err)
				)
		}
	}

	async function maybeScheduleCleanup() {
		if (!breakQueue) return
		const idle =
			breakQueue.isBreaking === false &&
			Array.isArray(breakQueue.queue) &&
			breakQueue.queue.length === 0
		if (!idle) return

		const now = Date.now()
		if (now - lastCleanupAt < 6000) return

		const positions = await scanArenaForFlagBlocks({ bot, arena })
		if (!positions.length) return

		lastCleanupAt = now
		console.log(
			`[GIFTS] arena has leftover flag blocks (${positions.length}), scheduling cleanup`
		)

		breakQueue.add({
			id: `cleanup_${Date.now()}`,
			type: 'CLEANUP_EXISTING_FLAGS',
			country: 'cleanup',
			scanExisting: true,
		})
	}

	async function runResolvedEffects(resolved, objectEvent) {
		const effects = resolved?.effects || []
		if (!effects.length) return

		for (const effect of effects) {
			try {
				if (effect === 'tnt_chaos') {
					await spawnTntNearBot({
						bot,
						rcon,
						fuse: 60,
						source: resolved.key,
						label: resolved.key,
					})
				} else if (effect === 'lightning') {
					await thunderSounds({ rcon, objectEvent })
					await lightningBurst({ rcon, objectEvent, min: 3, max: 3, radius: 7 })
				} else if (effect === 'fireworks') {
					await fireworksBurst({
						rcon,
						objectEvent,
						min: 3,
						max: 4,
						delayMs: 100,
					})
				}
			} catch (err) {
				console.log('[GIFTS] effect failed:', effect, err?.message || err)
			}
		}
	}

	async function handleObjectGift({ resolved, username, giftName, giftValue }) {
		const rushCount = registerGiftRush()
		reactToGiftRush(rushCount)

		const objectEvent = createObjectEvent({
			country: resolved.country,
			size: resolved.size,
			username,
			giftName,
			giftValue,
		})

		console.log(
			`Gift: ${objectEvent.giftName} by ${objectEvent.username} -> ${
				objectEvent.country
			} size=${objectEvent.size || 'default'}`
		)

		// Quick visible reaction
		if (objectEvent.size === 'large') {
			reactions.panicShakeCamera(bot, 500).catch(() => {})
			reactions.exhaustedLookDown(bot, 450).catch(() => {})
		} else {
			reactions.lookAtDonation(bot, objectEvent).catch(() => {})
		}

		spawnQueue.add(objectEvent)

		// Auto-break safety: if bot missed a flag before, schedule cleanup.
		maybeScheduleCleanup().catch(err =>
			console.log('[GIFTS] cleanup check failed:', err?.message || err)
		)

		// Always run tier-specific effects (if any)
		runResolvedEffects(resolved, objectEvent).catch(() => {})

		// Keep existing chaos system (probabilistic) + weather for big gifts
		randomChaos({ bot, rcon, objectEvent, giftValue }).catch(err =>
			console.log('[GIFTS] chaos failed:', err?.message || err)
		)
		expensiveGiftWeather({ rcon, giftValue }).catch(err =>
			console.log('[GIFTS] weather failed:', err?.message || err)
		)
	}

	return {
		async handle(input = {}) {
			const payload = extractGiftPayload(input)
			const resolved = resolveGift(payload.giftKey)
			console.log(
				`[GIFT] raw="${payload.giftKey}" resolved="${resolved?.key || 'null'}"`
			)

			if (!resolved) {
				// Strict matching: ignore unknown gifts.
				return {
					ok: true,
					ignored: true,
					reason: `Unknown gift: ${payload.giftKey}`,
				}
			}

			await handleObjectGift({
				resolved,
				username: payload.username,
				giftName: payload.giftName,
				giftValue: payload.giftValue,
			})

			return { ok: true }
		},
	}
}

async function handleGift({
	giftName,
	username = 'Someone',
	giftValue = 1,
	data = null,
	handlers,
}) {
	if (handlers?.handle) {
		return await handlers.handle({
			giftName,
			username,
			giftValue,
			data,
		})
	}

	const key = normalizeGiftName(giftName)
	const fn = handlers?.[key]
	if (!fn)
		return { ok: true, ignored: true, reason: `Unknown gift: ${giftName}` }

	await fn({ username, giftName: key })
	return { ok: true }
}

module.exports = {
	createGiftHandlers,
	handleGift,
	normalizeGiftName,
}
