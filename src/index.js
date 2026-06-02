require('dotenv').config()

const net = require('net')
const express = require('express')
const readline = require('readline')
const { createMinecraftBot } = require('./bot')
const { createRconClient, safeRconCommand } = require('./rcon')
const { createGiftHandlers, handleGift } = require('./gifts/handlers')
const ARENA = require('./config/arena')
const botBehavior = require('./config/botBehavior')
const { SpawnQueue } = require('./core/spawnQueue')
const { BreakQueue } = require('./core/breakQueue')
const { StackManager } = require('./core/stackManager')
const { EventRegistry } = require('./core/eventRegistry')
const { CameraSync } = require('./camera/cameraSync')
const { startCameraLock, stopCameraLock } = require('./bot/camera/cameraLock')
const { applyFastMiningSetup } = require('./bot/setup/applyFastMiningSetup')
const { LikeTracker } = require('./tiktok/likeTracker')
const { spawnFallingTntAboveFlag } = require('./effects/spawnFallingTntAboveFlag')
const { startKeepDay } = require('./effects/keepDay')
const { startBreakWatchdog } = require('./core/breakWatchdog')
const { startBreakIdleWatchdog } = require('./core/breakIdleWatchdog')
const { runStartupCleanup } = require('./core/startupCleanup')
const { playFlagMusic } = require('./effects/playFlagMusic')
const { connectTikTokLive } = require('./tiktok/connectTikTokLive')

function tcpPing({ host, port, timeoutMs = 2500 }) {
	return new Promise(resolve => {
		const socket = new net.Socket()

		const done = result => {
			try {
				socket.destroy()
			} catch {}
			resolve(result)
		}

		socket.setTimeout(timeoutMs)
		socket.once('connect', () => done({ ok: true }))
		socket.once('timeout', () => done({ ok: false, reason: 'timeout' }))
		socket.once('error', err =>
			done({ ok: false, reason: err?.code || err?.message || 'error' })
		)
		socket.connect(port, host)
	})
}

function parseCommandLine(line) {
	const text = String(line || '').trim()
	if (text.toLowerCase() === 'big gift') return ['big gift']

	return text
		.split(/\s+/)
		.map(part => part.trim())
		.filter(Boolean)
}

function startTerminalTriggers({ handleGift }) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	console.log(
		'Terminal triggers ready: gg | rose | tiktok | poland | galaxy | big gift'
	)
	rl.on('line', async line => {
		const gifts = parseCommandLine(line)
		for (const gift of gifts) {
			const result = await handleGift({ giftName: gift, username: 'terminal' })
			if (!result.ok) console.log(result.reason)
			else console.log(`triggered: ${gift}`)
		}
	})
}

function startMinecraftChatTriggers({ bot, handleGift }) {
	console.log(
		'Minecraft chat triggers: gg | rose | tiktok | poland | galaxy | !gg'
	)

	bot.on('chat', async (username, message) => {
		if (!message || username === bot.username) return

		const text = String(message).trim()
		const isExplicitCommand = text.startsWith('!')
		const gifts = parseCommandLine(isExplicitCommand ? text.slice(1) : text)
		if (!isExplicitCommand && gifts.length !== 1) return

		for (const gift of gifts) {
			const result = await handleGift({ giftName: gift, username })
			if (!result.ok && isExplicitCommand) bot.chat(`Unknown gift: ${gift}`)
		}
	})
}

function botPose(bot) {
	const p = bot?.entity?.position
	if (!p) return null

	return {
		x: Number(p.x.toFixed(3)),
		y: Number(p.y.toFixed(3)),
		z: Number(p.z.toFixed(3)),
		yaw: Number((bot.entity.yaw || 0).toFixed(5)),
		pitch: Number((bot.entity.pitch || 0).toFixed(5)),
	}
}

async function main() {
	console.log('Starting Minecraft TikTok Show object MVP')

	const mcHost = process.env.MC_HOST
	const mcPort = process.env.MC_PORT ? Number(process.env.MC_PORT) : 25565
	console.log(`MC target: ${mcHost}:${mcPort}`)

	const ping = await tcpPing({ host: mcHost, port: mcPort, timeoutMs: 2500 })
	if (!ping.ok) {
		console.log(
			`Cannot reach Minecraft server at ${mcHost}:${mcPort} (${ping.reason}). Check server, firewall and LAN IP.`
		)
	} else {
		console.log(`TCP port is reachable: ${mcHost}:${mcPort}`)
	}

	const bot = createMinecraftBot()
	let botReady = false

	bot.once('spawn', () => {
		botReady = true
	})
	bot.on('end', () => {
		botReady = false
	})

	const waitForBotReady = (timeoutMs = 5000) =>
		new Promise(resolve => {
			if (botReady || bot?.entity?.position) return resolve(true)

			const timer = setTimeout(() => {
				cleanup()
				resolve(false)
			}, timeoutMs)
			const onSpawn = () => {
				cleanup()
				resolve(true)
			}
			const cleanup = () => {
				clearTimeout(timer)
				bot.off('spawn', onSpawn)
			}

			bot.on('spawn', onSpawn)
		})

	const rcon = await createRconClient()
	if (rcon) console.log('RCON connected')
	else {
		console.log(
			'RCON not configured. LAN fallback will send commands via bot chat; the bot must be /op.'
		)
	}

	const commandBus = rcon || bot
	bot._commandBus = commandBus
	let stopKeepDay = null
	let tiktokLive = null
	const stackManager = new StackManager({
		baseOrigin: ARENA.origin,
		objectHeight: ARENA.height,
		maxStack: 6,
	})
	const eventRegistry = new EventRegistry()

	const likeTracker = new LikeTracker({
		threshold: 200,
		onThreshold: data => {
			spawnFallingTntAboveFlag({
				bot,
				rcon: commandBus,
				fuse: 40,
				source: 'likes',
				label: '200 likes',
				arena: ARENA,
			}).catch(err =>
				console.log('[LIKES] spawn TNT failed:', err?.message || err)
			)
		},
	})

	const breakQueue = new BreakQueue({
		bot,
		rcon: commandBus,
		options: botBehavior,
		stackManager,
		eventRegistry,
	})
	const spawnQueue = new SpawnQueue({
		bot,
		rcon: commandBus,
		breakQueue,
		stackManager,
		eventRegistry,
	})
	const cameraSync = new CameraSync({
		bot,
		rcon: commandBus,
		enabled:
			String(process.env.ENABLE_CAMERA_SYNC || '').toLowerCase() === 'true',
		cameraUsername: process.env.CAMERA_USERNAME,
		cameraMode: process.env.CAMERA_MODE || 'first_person',
		intervalMs: process.env.CAMERA_SYNC_INTERVAL_MS
			? Number(process.env.CAMERA_SYNC_INTERVAL_MS)
			: botBehavior.cameraSyncIntervalMs,
	})
	const watchdog = startBreakWatchdog({
		bot,
		arena: {
			origin: ARENA.origin,
			maxWidth: ARENA.width,
			maxDepth: ARENA.depth,
			maxHeight: ARENA.height,
			maxStack: 6,
		},
		breakQueue,
		spawnQueue,
		intervalMs: 5000,
		logger: console,
	})
	const idleWatchdog = startBreakIdleWatchdog({
		bot,
		arena: {
			origin: ARENA.origin,
			maxWidth: ARENA.width,
			maxDepth: ARENA.depth,
			maxHeight: ARENA.height,
			maxStack: 6,
		},
		breakQueue,
		intervalMs: 5000,
		logger: console,
	})

	const handlers = createGiftHandlers({
		bot,
		rcon: commandBus,
		spawnQueue,
		breakQueue,
		arena: {
			origin: ARENA.origin,
			maxWidth: ARENA.width,
			maxDepth: ARENA.depth,
			maxHeight: ARENA.height,
			maxStack: 6,
		},
	})

	const guardedHandleGift = async ({
		giftName,
		username = 'Someone',
		giftValue = 1,
		data = null,
	}) => {
		if (!botReady && !bot?.entity?.position) {
			const ok = await waitForBotReady(5000)
			if (!ok) return { ok: false, reason: 'Bot not ready' }
		}

		return await handleGift({ giftName, username, giftValue, data, handlers })
	}

	startTerminalTriggers({ handleGift: guardedHandleGift })
	startMinecraftChatTriggers({ bot, handleGift: guardedHandleGift })

	tiktokLive = connectTikTokLive({
		enabled:
			String(process.env.ENABLE_TIKTOK_LIVE || '').toLowerCase() === 'true',
		username: process.env.TIKTOK_USERNAME,
		handleGift: guardedHandleGift,
		likeTracker,
		bot,
		rcon: commandBus,
	})
	tiktokLive.start()

	const app = express()
	app.use(express.json())

	app.get('/status', (req, res) => {
		res.json({
			ok: true,
			botReady: botReady || Boolean(bot?.entity?.position),
			botUsername: bot?.username || null,
			botPose: botPose(bot),
			spawnQueueSize: spawnQueue.size(),
			spawnQueueRunning: spawnQueue.isSpawning,
			breakQueueSize: breakQueue.size(),
			breakQueueRunning: breakQueue.isBreaking,
			breakQueue: {
				isBreaking: breakQueue.isBreaking,
				queueLength: breakQueue.size(),
				currentEventId: breakQueue.currentEvent?.id || null,
				currentEventCountry: breakQueue.currentEvent?.country || null,
			},
			spawnQueue: {
				isSpawning: spawnQueue.isSpawning,
				queueLength: spawnQueue.size(),
			},
			stackIndex: stackManager.currentStackIndex,
			cameraSync: cameraSync.status(),
			tiktokLive: tiktokLive?.status?.() || null,
			arena: ARENA,
			botBehavior,
		})
	})

	app.post('/gift', async (req, res) => {
		try {
			const data = req.body || {}
			const gift = data.gift || data.giftName || data.name
			const username =
				data.nickname ||
				data.uniqueId ||
				data.username ||
				data.user ||
				'Someone'
			const giftValue = data.diamondCount || data.giftValue || data.value || 1
			const result = await guardedHandleGift({
				giftName: gift,
				username,
				giftValue,
				data,
			})
			if (!result.ok) return res.status(400).json(result)
			return res.json({ ok: true })
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	app.post('/likes', (req, res) => {
		try {
			const data = req.body || {}
			const count = data.likeCount || data.count || 1
			const result = likeTracker.addLikes(count, {
				username: data.username || data.nickname || data.uniqueId || 'test',
				...data,
			})

			return res.json({
				ok: true,
				count: Number(count) || 0,
				triggered: result.triggered,
				buffer: result.buffer,
				threshold: likeTracker.threshold,
			})
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	app.post('/test-falling-tnt', async (req, res) => {
		try {
			if (!botReady && !bot?.entity?.position) {
				const ok = await waitForBotReady(5000)
				if (!ok) return res.status(503).json({ ok: false, error: 'Bot not ready' })
			}

			const result = await spawnFallingTntAboveFlag({
				bot,
				rcon: commandBus,
				arena: ARENA,
				fuse: 40,
				source: 'test_endpoint',
				label: 'test TNT',
			})
			return res.json(result)
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	app.post('/cleanup-arena', async (req, res) => {
		try {
			if (!botReady && !bot?.entity?.position) {
				const ok = await waitForBotReady(5000)
				if (!ok) return res.status(503).json({ ok: false, error: 'Bot not ready' })
			}

			const result = await runStartupCleanup({
				bot,
				rcon: commandBus,
				arena: ARENA,
			})
			return res.json({ ok: true, removed: result.removed })
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	app.post('/test-sound', async (req, res) => {
		try {
			const data = req.body || {}
			const sound = String(data.sound || '').trim()
			if (!sound) {
				return res.status(400).json({ ok: false, error: 'sound is required' })
			}

			await safeRconCommand(commandBus, '/stopsound @a master')
			await safeRconCommand(
				commandBus,
				`/playsound ${sound} master @a ~ ~ ~ 10 1`
			)
			return res.json({ ok: true, sound })
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	app.post('/test-country-sound', async (req, res) => {
		try {
			const data = req.body || {}
			const country = String(data.country || '').trim().toLowerCase()
			if (!country) {
				return res.status(400).json({ ok: false, error: 'country is required' })
			}

			const played = await playFlagMusic({
				rcon: commandBus,
				objectEvent: {
					country,
					id: 'test',
				},
			})

			return res.json({ ok: true, country, played })
		} catch (err) {
			return res
				.status(500)
				.json({ ok: false, error: err?.message || String(err) })
		}
	})

	const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : 3001
	const server = app.listen(apiPort, () => {
		console.log(`MVP API listening on http://localhost:${apiPort}`)
	})

	bot.once('spawn', async () => {
		await applyFastMiningSetup({ bot, rcon: commandBus })
		stopKeepDay = startKeepDay(commandBus)
		startCameraLock({ bot, rcon: commandBus })
		watchdog.start()
		idleWatchdog.start()
		if (cameraSync.enabled && process.env.CAMERA_USERNAME) {
			await safeRconCommand(
				commandBus,
				`/gamemode spectator ${process.env.CAMERA_USERNAME}`
			)
			cameraSync.start()
		}
		await runStartupCleanup({ bot, rcon: commandBus, arena: ARENA })
		await safeRconCommand(commandBus, '/say [TikTokShow] Object arena is ready')
		bot.chat('TikTok object MVP ready')
	})

	async function shutdown(signal) {
		console.log(`\nShutting down (${signal})...`)
		if (stopKeepDay) stopKeepDay()
		stopCameraLock()
		cameraSync.stop()
		watchdog.stop()
		idleWatchdog.stop()
		tiktokLive?.stop?.()
		try {
			if (rcon) await rcon.end()
		} catch {}
		try {
			if (bot) bot.quit()
		} catch {}
		try {
			if (server) server.close()
		} catch {}
	}

	process.on('SIGINT', async () => {
		await shutdown('SIGINT')
		process.exit(0)
	})

	process.once('SIGUSR2', async () => {
		await shutdown('SIGUSR2')
		process.kill(process.pid, 'SIGUSR2')
	})
}

main().catch(err => {
	console.log('Fatal error:', err?.message || err)
	process.exit(1)
})
