const { WebcastPushConnection } = require('tiktok-live-connector')
const { safeSend } = require('../rcon')
const ARENA = require('../config/arena')
const { launchFirework } = require('../effects/fireworks')
const { spawnLightningAroundObject } = require('../effects/lightning')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function cleanUsername(value) {
	return (
		String(value || '')
			.replace(/[^\p{L}\p{N}_.-]/gu, '')
			.trim()
			.slice(0, 32) || 'viewer'
	)
}

function jsonText(text, extra = {}) {
	return JSON.stringify({ text, ...extra })
}

function extractUsername(data = {}) {
	return cleanUsername(
		data.uniqueId ||
			data.nickname ||
			data.user?.uniqueId ||
			data.user?.nickname ||
			data.user?.displayId
	)
}

function extractGiftName(data = {}) {
	return String(
		data.giftName ||
			data.gift?.name ||
			data.extendedGiftInfo?.name ||
			data.giftDetails?.giftName ||
			data.giftId ||
			''
	)
		.trim()
}

function isPlaceholderUsername(username) {
	const value = String(username || '').trim().toLowerCase()
	return (
		!value ||
		value === 'your_tiktok_username' ||
		value === 'твой_ник_в_tiktok'
	)
}

function shouldProcessGift(data = {}) {
	// TikTok sends streak gifts multiple times; process only final event.
	if (Number(data.giftType) === 1 && data.repeatEnd === false) return false
	return true
}

function botOrigin(bot) {
	const p = bot?.entity?.position
	if (!p) return ARENA.origin
	return {
		x: Math.floor(p.x),
		y: Math.floor(p.y),
		z: Math.floor(p.z),
	}
}

async function showFollowEffect({ bot, rcon, username }) {
	const commandBus = rcon || bot
	const name = cleanUsername(username)

	await safeSend(
		commandBus,
		`/title @a title ${jsonText(`${name} followed!`, {
			color: 'aqua',
			bold: true,
		})}`
	)

	const origin = botOrigin(bot)
	for (let i = 0; i < 3; i++) {
		await launchFirework({
			rcon: commandBus,
			x: origin.x + (i - 1),
			y: origin.y + 2,
			z: origin.z + 1,
		})
		await delay(80)
	}
}

async function showShareEffect({ rcon }) {
	await spawnLightningAroundObject({
		rcon,
		objectEvent: {
			origin: ARENA.origin,
			width: ARENA.width,
			depth: ARENA.depth,
		},
		count: 2,
		radius: 6,
	})
}

function connectTikTokLive({
	username = process.env.TIKTOK_USERNAME,
	handleGift,
	likeTracker,
	bot,
	rcon,
	reconnectDelayMs = 5000,
	logger = console,
} = {}) {
	const normalizedUsername = String(username || '').replace(/^@+/, '').trim()
	if (isPlaceholderUsername(normalizedUsername)) {
		logger.log('[TIKTOK] disabled: TIKTOK_USERNAME is not set')
		return {
			start: () => false,
			stop: () => {},
			status: () => ({ enabled: false, connected: false, username: null }),
		}
	}

	let connection = null
	let reconnectTimer = null
	let stopped = false
	let connected = false
	let connecting = false
	let roomId = null

	function status() {
		return {
			enabled: true,
			connected,
			connecting,
			username: normalizedUsername,
			roomId,
		}
	}

	function clearReconnectTimer() {
		if (!reconnectTimer) return
		clearTimeout(reconnectTimer)
		reconnectTimer = null
	}

	function scheduleReconnect(reason) {
		if (stopped || reconnectTimer) return
		const previousConnection = connection
		connection = null
		connected = false
		connecting = false
		try {
			previousConnection?.disconnect?.()
		} catch {}
		logger.log(
			`[TIKTOK] disconnected${reason ? `: ${reason}` : ''}, reconnecting in ${reconnectDelayMs}ms`
		)
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null
			start()
		}, reconnectDelayMs)
		reconnectTimer.unref?.()
	}

	function bindEvents(tiktok) {
		tiktok.on('gift', data => {
			if (!shouldProcessGift(data)) return

			const giftName = extractGiftName(data)
			const sender = extractUsername(data)
			if (!giftName) {
				logger.log('[TIKTOK] gift skipped: missing giftName')
				return
			}

			logger.log(`[TIKTOK] gift ${giftName} from ${sender}`)
			Promise.resolve(
				handleGift?.({
					giftName,
					username: sender,
					giftValue: data.diamondCount || data.gift?.diamondCount || 1,
					data,
				})
			).catch(err =>
				logger.log('[TIKTOK] gift handler failed:', err?.message || err)
			)
		})

		tiktok.on('like', data => {
			const likeCount = Math.max(0, Math.floor(Number(data.likeCount) || 0))
			if (!likeCount) return

			const sender = extractUsername(data)
			logger.log(`[TIKTOK] likes +${likeCount} from ${sender}`)
			likeTracker?.addLikes?.(likeCount, { username: sender, ...data })
		})

		tiktok.on('follow', data => {
			const sender = extractUsername(data)
			logger.log(`[TIKTOK] follow ${sender}`)
			showFollowEffect({ bot, rcon, username: sender }).catch(err =>
				logger.log('[TIKTOK] follow effect failed:', err?.message || err)
			)
		})

		tiktok.on('share', data => {
			const sender = extractUsername(data)
			logger.log(`[TIKTOK] share ${sender}`)
			showShareEffect({ rcon }).catch(err =>
				logger.log('[TIKTOK] share effect failed:', err?.message || err)
			)
		})

		tiktok.on('disconnected', data => {
			scheduleReconnect(data?.reason || data?.code || 'connection closed')
		})

		tiktok.on('streamEnd', data => {
			scheduleReconnect(`stream ended${data?.action ? ` action=${data.action}` : ''}`)
		})

		tiktok.on('error', err => {
			logger.log('[TIKTOK] error:', err?.message || err)
			scheduleReconnect('error')
		})
	}

	async function start() {
		if (stopped || connecting || connected) return false

		connecting = true
		clearReconnectTimer()

		try {
			connection = new WebcastPushConnection(normalizedUsername)
			bindEvents(connection)

			const state = await connection.connect()
			roomId = state?.roomId || connection.roomId || null
			connected = true
			connecting = false

			logger.log('[TIKTOK] connected')
			logger.log(`[TIKTOK] roomId=${roomId || 'unknown'}`)
			logger.log(`[TIKTOK] username=${normalizedUsername}`)
			return true
		} catch (err) {
			connection = null
			connected = false
			connecting = false
			logger.log('[TIKTOK] connect failed:', err?.message || err)
			scheduleReconnect('connect failed')
			return false
		}
	}

	function stop() {
		stopped = true
		clearReconnectTimer()
		connected = false
		connecting = false
		try {
			connection?.disconnect?.()
		} catch {}
		connection = null
	}

	return {
		start,
		stop,
		status,
	}
}

module.exports = {
	connectTikTokLive,
}
