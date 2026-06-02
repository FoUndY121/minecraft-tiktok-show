const { Vec3 } = require('vec3')
const { safeSend } = require('../rcon')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { markArenaDirty } = require('../core/arenaDirty')

function shuffle(items) {
	const out = [...items]
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const tmp = out[i]
		out[i] = out[j]
		out[j] = tmp
	}
	return out
}

async function removeRandomFlagBlocksNear({
	bot,
	rcon,
	center,
	radius = 4,
	count = 5,
} = {}) {
	const commandBus = rcon || bot
	if (!bot?.blockAt || !commandBus || !center) return { removed: 0 }

	const cx = Math.floor(center.x)
	const cy = Math.floor(center.y)
	const cz = Math.floor(center.z)
	const r = Math.max(0, Math.floor(radius))
	const limit = Math.min(8, Math.max(0, Math.floor(count ?? 5)))
	const candidates = []

	for (let y = cy - r; y <= cy + r; y++) {
		for (let x = cx - r; x <= cx + r; x++) {
			for (let z = cz - r; z <= cz + r; z++) {
				const block = bot.blockAt(new Vec3(x, y, z))
				if (block && FLAG_BLOCKS.has(block.name)) candidates.push(block.position)
			}
		}
	}

	let removed = 0
	for (const pos of shuffle(candidates).slice(0, limit)) {
		const block = bot.blockAt(pos)
		if (!block || !FLAG_BLOCKS.has(block.name)) continue
		await safeSend(commandBus, `/setblock ${pos.x} ${pos.y} ${pos.z} minecraft:air`)
		removed += 1
	}

	if (removed > 0) markArenaDirty('lightning_flag_cleanup')
	console.log(`[LIGHTNING] removed flag blocks=${removed}`)

	return { removed }
}

module.exports = {
	removeRandomFlagBlocksNear,
}
