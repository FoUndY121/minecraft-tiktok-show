function normalizeGiftName(rawGiftName) {
	return String(rawGiftName || '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function resolveGift(rawGiftName) {
	const normalized = normalizeGiftName(rawGiftName)
	const map = {
		gg: 'germany',
		germany: 'germany',
		rose: 'ukraine',
		ukraine: 'ukraine',
		tiktok: 'france',
		france: 'france',
		poland: 'poland',
		italy: 'italy',
		spain: 'spain',
		lithuania: 'lithuania',
		usa: 'usa',
		austria: 'austria',
		argentina: 'argentina',
		galaxy: 'tnt',
		tnt: 'tnt',
		'big gift': 'bigGift',
	}

	return map[normalized] || null
}

module.exports = {
	normalizeGiftName,
	resolveGift,
}
