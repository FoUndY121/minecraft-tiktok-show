const { Vec3 } = require('vec3')
const behavior = require('../config/botBehavior')
const { safeSend } = require('../rcon')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { setCameraTarget } = require('../bot/camera/cameraLock')
const { smoothLookAt } = require('../bot/camera/smoothLookAt')

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randInt(min, max) {
	return min + Math.floor(Math.random() * (max - min + 1))
}

function randFloat(min, max) {
	return min + Math.random() * (max - min)
}

function vecCenter(pos) {
	return new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
}

function distance(a, b) {
	const dx = a.x - b.x
	const dy = a.y - b.y
	const dz = a.z - b.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function withTimeout(promise, timeoutMs, label = 'timeout') {
	let timer
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error(label)), timeoutMs)
		}),
	]).finally(() => {
		if (timer) clearTimeout(timer)
	})
}

function isLiveFlagBlock(block) {
	return block && block.name !== 'air' && FLAG_BLOCKS.has(block.name)
}

async function tinyLookAround(bot, target, cfg) {
	if (Math.random() > 0.18) return
	const jitter = randFloat(0.03, 0.06)
	await smoothLookAt(bot, target.offset(randFloat(-jitter, jitter), randFloat(-jitter, jitter), randFloat(-jitter, jitter)), {
		durationMs: 150,
		jitter: 0,
	})
	await smoothLookAt(bot, target, {
		durationMs: cfg.lookAtBlockDurationMs ?? 45,
		jitter: 0,
	})
}

async function angryShake(bot, target, cfg, blocksLeft) {
	if (blocksLeft < 120 || Math.random() > 0.08) return
	for (let i = 0; i < 3; i++) {
		await smoothLookAt(bot, target.offset(randFloat(-0.05, 0.05), randFloat(-0.04, 0.04), randFloat(-0.05, 0.05)), {
			durationMs: 35,
			jitter: 0,
		})
	}
	await smoothLookAt(bot, target, {
		durationMs: cfg.lookAtBlockDurationMs ?? 45,
		jitter: 0,
	})
}

async function digWithFallback({ bot, rcon, liveBlock, cfg }) {
	const position = liveBlock.position
	const beforeDig = bot.blockAt(position)
	if (!isLiveFlagBlock(beforeDig)) return { ok: false, skippedAir: true }

	try {
		await withTimeout(
			bot.dig(beforeDig, true),
			cfg.maxDigTimeMs ?? 500,
			`dig timeout ${cfg.maxDigTimeMs ?? 500}ms`
		)
		return { ok: true, fallback: false }
	} catch {}

	if (!cfg.useDigFallback || !rcon) return { ok: false, fallback: false }

	const beforeFallback = bot.blockAt(position)
	if (!isLiveFlagBlock(beforeFallback)) return { ok: false, skippedAir: true }

	await safeSend(
		rcon,
		`/setblock ${position.x} ${position.y} ${position.z} minecraft:air`
	)
	return { ok: true, fallback: true }
}

async function mineBurstHumanLike({
	bot,
	rcon,
	blocks,
	options = behavior,
	blocksLeft = 0,
	onProgress = null,
} = {}) {
	const cfg = options
	let broken = 0
	let fallbackBroken = 0
	let skippedAir = 0

	for (let i = 0; i < (blocks || []).length; i++) {
		const pos = blocks[i]
		const liveBlock = bot.blockAt(pos)
		if (!isLiveFlagBlock(liveBlock)) {
			skippedAir += 1
			continue
		}

		const blockCenter = vecCenter(liveBlock.position)
		if (distance(bot.entity.position, blockCenter) > (cfg.maxReachDistance ?? 4.5)) {
			continue
		}

		if (cfg.cameraLockEnabled) setCameraTarget(blockCenter)
		await smoothLookAt(bot, blockCenter, {
			durationMs: cfg.lookAtBlockDurationMs ?? 45,
			jitter: i > 0 && i % randInt(3, 4) === 0 ? randFloat(0.03, 0.06) : 0,
		})

		await tinyLookAround(bot, blockCenter, cfg)
		await angryShake(bot, blockCenter, cfg, blocksLeft)

		if (cfg.preBreakPauseMs > 0) await sleep(cfg.preBreakPauseMs)
		else await sleep(randInt(30, 50))

		const beforeSwing = bot.blockAt(liveBlock.position)
		if (!isLiveFlagBlock(beforeSwing)) {
			skippedAir += 1
			continue
		}
		if (distance(bot.entity.position, blockCenter) > (cfg.maxReachDistance ?? 4.5)) {
			continue
		}

		try {
			await bot.lookAt(blockCenter, true)
		} catch {}

		const stillBeforeSwing = bot.blockAt(liveBlock.position)
		if (!isLiveFlagBlock(stillBeforeSwing)) {
			skippedAir += 1
			continue
		}
		if (distance(bot.entity.position, blockCenter) > (cfg.maxReachDistance ?? 4.5)) {
			continue
		}

		try {
			bot.swingArm('right')
		} catch {}
		await sleep(cfg.swingPauseMs ?? randInt(40, 60))

		const result = await digWithFallback({
			bot,
			rcon,
			liveBlock,
			cfg,
		})

		if (result.skippedAir) {
			skippedAir += 1
			continue
		}

		if (result.ok) {
			broken += 1
			if (result.fallback) fallbackBroken += 1
			onProgress?.({
				block: liveBlock,
				fallback: result.fallback,
			})
		}

		await sleep(cfg.afterBreakPauseMs ?? randInt(20, 40))
		if (cfg.breakDelayMs > 0) await sleep(cfg.breakDelayMs)
	}

	return {
		broken,
		fallbackBroken,
		skippedAir,
	}
}

module.exports = {
	mineBurstHumanLike,
}
