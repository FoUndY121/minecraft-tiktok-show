const { Vec3 } = require('vec3')
const { safeSend } = require('../rcon')
const { FLAG_BLOCKS } = require('../config/flagBlocks')
const { markArenaDirty } = require('../core/arenaDirty')

async function removeOnlyFlagBlocksInRadius({
	bot,
	rcon,
	center,
	radius = 2.5,
	maxBlocks = 18,
} = {}) {
	const commandBus = rcon || bot
	if (!bot?.blockAt || !commandBus || !center) {
		return { removed: 0, skippedNonFlag: 0 }
	}

	const cx = Number(center.x)
	const cy = Number(center.y)
	const cz = Number(center.z)
	const r = Math.max(0, Number(radius) || 0)
	const scanRadius = Math.ceil(r)
	const limit = Math.max(0, Math.floor(maxBlocks ?? 18))
	const candidates = []
	let skippedNonFlag = 0

	for (let y = Math.floor(cy - scanRadius); y <= Math.ceil(cy + scanRadius); y++) {
		for (let x = Math.floor(cx - scanRadius); x <= Math.ceil(cx + scanRadius); x++) {
			for (let z = Math.floor(cz - scanRadius); z <= Math.ceil(cz + scanRadius); z++) {
				const dx = x + 0.5 - cx
				const dy = y + 0.5 - cy
				const dz = z + 0.5 - cz
				const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
				if (distance > r) continue

				const pos = new Vec3(x, y, z)
				const block = bot.blockAt(pos)
				if (!block || block.name === 'air') continue
				if (!FLAG_BLOCKS.has(block.name)) {
					skippedNonFlag += 1
					continue
				}

				candidates.push({ pos: block.position, distance })
			}
		}
	}

	candidates.sort((a, b) => a.distance - b.distance)

	let removed = 0
	for (const candidate of candidates.slice(0, limit)) {
		const block = bot.blockAt(candidate.pos)
		if (!block || !FLAG_BLOCKS.has(block.name)) continue

		await safeSend(
			commandBus,
			`/setblock ${candidate.pos.x} ${candidate.pos.y} ${candidate.pos.z} minecraft:air`
		)
		removed += 1
	}

	if (removed > 0) markArenaDirty('chaos_flag_cleanup')
	console.log(
		`[CHAOS] TNT removed flagBlocks=${removed} max=${limit} radius=${r}`
	)

	return { removed, skippedNonFlag }
}

module.exports = {
	removeOnlyFlagBlocksInRadius,
}
