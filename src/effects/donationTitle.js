const { safeSend } = require('../rcon')

const COUNTRY_NAMES = {
	germany: 'Germany',
	ukraine: 'Ukraine',
	poland: 'Poland',
	france: 'France',
}

function cleanText(value, fallback) {
	const text = String(value || fallback || '')
		.replace(/[^\p{L}\p{N}\s_.!?#+\-]/gu, '')
		.trim()

	return (text || fallback).slice(0, 48)
}

function jsonText(text, extra = {}) {
	return JSON.stringify({ text, ...extra })
}

function countryTitle(country) {
	const key = String(country || '').toLowerCase()
	return COUNTRY_NAMES[key] || cleanText(country, 'Unknown')
}

async function showDonationTitle({ rcon, objectEvent }) {
	const username = cleanText(objectEvent?.username, 'Someone')
	const giftName = cleanText(objectEvent?.giftName, 'Gift')
	const country = countryTitle(objectEvent?.country)

	await safeSend(
		rcon,
		`/title @a title ${jsonText(username, { color: 'gold', bold: true })}`
	)
	await safeSend(
		rcon,
		`/title @a subtitle ${jsonText(`sent ${giftName} → ${country} Flag`, { color: 'white' })}`
	)
	await safeSend(
		rcon,
		`/title @a actionbar ${jsonText(`${country} flag is falling! Donated by ${username}`, { color: 'yellow' })}`
	)
}

module.exports = {
	showDonationTitle,
	countryTitle,
	cleanText,
}
