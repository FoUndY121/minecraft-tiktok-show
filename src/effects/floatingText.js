const { safeSend } = require('../rcon')
const { cleanText, countryTitle } = require('./donationTitle')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function tagFor(objectEvent) {
	return `donation_text_${String(objectEvent.id || Date.now()).replace(/[^a-zA-Z0-9_]/g, '_')}`
}

function jsonName(text) {
	return JSON.stringify({ text, color: 'gold', bold: true })
}

async function showFloatingDonationText({ rcon, objectEvent }) {
	const origin = objectEvent.origin
	const x = origin.x + objectEvent.width / 2
	const y = objectEvent.spawnHeight + objectEvent.height + 1.5
	const z = origin.z + objectEvent.depth / 2
	const username = cleanText(objectEvent.username, 'Someone')
	const giftName = cleanText(objectEvent.giftName, 'Gift')
	const country = countryTitle(objectEvent.country)
	const tag = tagFor(objectEvent)
	const text = `${username} sent ${giftName} → ${country}`
	const name = jsonName(text).replace(/'/g, "\\'")

	await safeSend(
		rcon,
		`/summon armor_stand ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)} {Invisible:1b,Marker:1b,NoGravity:1b,CustomNameVisible:1b,Tags:["donation_text","${tag}"],CustomName:'${name}'}`
	)

	setTimeout(() => {
		safeSend(
			rcon,
			`/kill @e[type=minecraft:armor_stand,tag=${tag},x=${x.toFixed(2)},y=${y.toFixed(2)},z=${z.toFixed(2)},distance=..20]`
		).catch(() => {})
	}, 5000 + Math.floor(Math.random() * 2000))
}

module.exports = {
	showFloatingDonationText,
	tagFor,
}
