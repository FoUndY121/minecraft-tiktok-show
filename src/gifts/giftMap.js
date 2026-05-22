const { normalizeGiftName, resolveGift } = require('./resolveGift')

const GIFT_MAP = {
	germany: {
		type: 'object',
		country: 'germany',
		giftName: 'GG',
		giftValue: 1,
	},
	ukraine: {
		type: 'object',
		country: 'ukraine',
		giftName: 'Rose',
		giftValue: 1,
	},
	france: {
		type: 'object',
		country: 'france',
		giftName: 'TikTok',
		giftValue: 1,
	},
	poland: {
		type: 'object',
		country: 'poland',
		giftName: 'Poland',
		giftValue: 1,
	},
	italy: {
		type: 'object',
		country: 'italy',
		giftName: 'Italy',
		giftValue: 1,
	},
	spain: {
		type: 'object',
		country: 'spain',
		giftName: 'Spain',
		giftValue: 1,
	},
	lithuania: {
		type: 'object',
		country: 'lithuania',
		giftName: 'Lithuania',
		giftValue: 1,
	},
	usa: {
		type: 'object',
		country: 'usa',
		giftName: 'USA',
		giftValue: 1,
	},
	austria: {
		type: 'object',
		country: 'austria',
		giftName: 'Austria',
		giftValue: 1,
	},
	argentina: {
		type: 'object',
		country: 'argentina',
		giftName: 'Argentina',
		giftValue: 1,
	},
	tnt: {
		type: 'tnt',
		giftName: 'Galaxy',
		giftValue: 20,
		fuse: 60,
	},
	bigGift: {
		type: 'tnt',
		giftName: 'Big Gift',
		giftValue: 100,
		fuse: 100,
	},
}

function getGiftDefinition(name) {
	const key = resolveGift(name)
	if (!key || !GIFT_MAP[key]) return null
	return { key, ...GIFT_MAP[key] }
}

module.exports = {
	GIFT_MAP,
	normalizeGiftName,
	resolveGift,
	getGiftDefinition,
}
