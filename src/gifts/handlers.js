const { createObjectEvent } = require('../core/spawnQueue')
const { spawnTntNearBot } = require('../effects/spawnTntNearBot')
const { randomChaos, expensiveGiftWeather } = require('../effects/chaosEvents')
const reactions = require('../bot/reactions')
const { getGiftDefinition, normalizeGiftName, resolveGift } = require('./giftMap')

function extractGiftPayload(input = {}) {
	const data = input.data || input

	return {
		giftKey: input.giftName || data.gift || data.giftName || data.name || 'Gift',
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

function createGiftHandlers({ bot, rcon, spawnQueue }) {
	const giftTimes = []

	function registerGiftRush() {
		const now = Date.now()
		giftTimes.push(now)
		while (giftTimes.length > 0 && now - giftTimes[0] > 40000) giftTimes.shift()
		return giftTimes.length
	}

	function reactToGiftRush(count) {
		if (count >= 12) {
			reactions.rageReaction(bot, 900).catch(err =>
				console.log('[GIFTS] rage reaction failed:', err?.message || err)
			)
		} else if (count >= 8) {
			reactions.scaredLookAround(bot, 600).catch(err =>
				console.log('[GIFTS] rush reaction failed:', err?.message || err)
			)
		}
	}

	function spawnChaos(definition, objectEvent = null) {
		randomChaos({
			bot,
			rcon,
			objectEvent,
			giftValue: definition.giftValue || 1,
		}).catch(err => console.log('[GIFTS] chaos failed:', err?.message || err))

		expensiveGiftWeather({ rcon, giftValue: definition.giftValue || 1 }).catch(err =>
			console.log('[GIFTS] weather failed:', err?.message || err)
		)
	}

	async function handleObjectGift({ definition, username, giftName, giftValue }) {
		const rushCount = registerGiftRush()
		reactToGiftRush(rushCount)

		const objectEvent = createObjectEvent({
			country: definition.country,
			username,
			giftName: giftName || definition.giftName,
			giftValue: giftValue || definition.giftValue,
		})

		console.log(
			`Gift: ${objectEvent.giftName} by ${objectEvent.username} -> ${definition.country} object`
		)

		if (objectEvent.giftValue >= 20) {
			reactions.panicShakeCamera(bot, 500).catch(() => {})
			reactions.exhaustedLookDown(bot, 450).catch(() => {})
		} else {
			reactions.lookAtDonation(bot, objectEvent).catch(() => {})
		}

		spawnQueue.add(objectEvent)
		spawnChaos({ ...definition, giftValue: objectEvent.giftValue }, objectEvent)
	}

	async function handleTntGift({ definition, giftValue }) {
		const rushCount = registerGiftRush()
		reactToGiftRush(rushCount)
		console.log(`Gift: ${definition.giftName} -> TNT instant event`)

		spawnTntNearBot({ bot, rcon, fuse: definition.fuse || 60 }).catch(err =>
			console.log('[GIFTS] TNT failed:', err?.message || err)
		)
		spawnChaos({ ...definition, giftValue: giftValue || definition.giftValue }, null)
	}

	return {
		async handle(input = {}) {
			const payload = extractGiftPayload(input)
			const resolvedGift = resolveGift(payload.giftKey)
			console.log(`[GIFT] raw="${payload.giftKey}" resolved="${resolvedGift || 'null'}"`)

			const definition = getGiftDefinition(payload.giftKey)
			if (!definition) return { ok: false, reason: `Unknown gift: ${payload.giftKey}` }

			if (definition.type === 'object') {
				await handleObjectGift({
					definition,
					username: payload.username,
					giftName: payload.giftName,
					giftValue: payload.giftValue,
				})
			} else if (definition.type === 'tnt') {
				await handleTntGift({ definition, username: payload.username, giftValue: payload.giftValue })
			}

			return { ok: true }
		},
	}
}

async function handleGift({ giftName, username = 'Someone', giftValue = 1, data = null, handlers }) {
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
	if (!fn) return { ok: false, reason: `Unknown gift: ${giftName}` }

	await fn({ username, giftName: key })
	return { ok: true }
}

module.exports = {
	createGiftHandlers,
	handleGift,
	normalizeGiftName,
}
