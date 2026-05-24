/**
 * TikTok gift tier system (STRICT keys).
 *
 * Important:
 * - 1 gift => 1 event
 * - no includes / partial matching
 * - keys must match resolveGift(normalizeGiftName(raw)) EXACTLY
 */

const GIFT_MAP = {
	// Cheap gifts -> small 4x4x4
	rose: { country: 'ukraine', size: 'small' },
	gg: { country: 'germany', size: 'small' },
	perfume: { country: 'russia', size: 'small' },
	'finger heart': { country: 'france', size: 'small' },
	'heart me': { country: 'spain', size: 'small' },
	tiktok: { country: 'france', size: 'small' },
	poland: { country: 'poland', size: 'small' },
	lithuania: { country: 'lithuania', size: 'small' },

	// Medium gifts -> 5x5x5
	cap: { country: 'germany', size: 'medium' },
	'hand heart': { country: 'ukraine', size: 'medium' },
	'love you': { country: 'poland', size: 'medium' },
	sunglasses: { country: 'italy', size: 'medium' },
	donut: { country: 'russia', size: 'medium' },

	// Expensive gifts -> large 7x7x7 (+ instant effects)
	galaxy: { country: 'usa', size: 'large', effects: ['tnt_chaos'] },
	lion: { country: 'germany', size: 'large', effects: ['lightning'] },
	universe: { country: 'ukraine', size: 'large', effects: ['fireworks'] },
	rocket: { country: 'usa', size: 'large', effects: ['tnt_chaos'] },
	castle: { country: 'france', size: 'large' },
	'money gun': { country: 'russia', size: 'large', effects: ['tnt_chaos'] },
	'drama queen': { country: 'russia', size: 'large', effects: ['lightning'] },
}

module.exports = {
	GIFT_MAP,
}
