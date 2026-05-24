const { GIFT_MAP } = require('./giftMap')

function normalizeGiftName(rawGiftName) {
	return String(rawGiftName || '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

/**
 * Strict resolver:
 * - normalize -> lookup -> return gift definition
 * - no includes / partial matching
 */
function resolveGift(rawGiftName) {
	const key = normalizeGiftName(rawGiftName)
	if (!key) return null

	const def = GIFT_MAP[key]
	if (!def) return null

	return { key, ...def }
}

module.exports = {
	normalizeGiftName,
	resolveGift,
}
