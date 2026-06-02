const { Vec3 } = require('vec3')
const { FLAG_BLOCKS } = require('../config/flagBlocks')

function normalizeArena(arena = {}) {
	// Supports both:
	// - { origin, maxWidth, maxDepth, maxHeight, maxStack }
	// - config/arena.js shape { origin, width, depth, height } + injected maxStack
	const origin = arena.origin || { x: 0, y: 0, z: 0 }
	const maxWidth = arena.maxWidth ?? arena.width ?? 7
	const maxDepth = arena.maxDepth ?? arena.depth ?? 7
	const maxHeight = arena.maxHeight ?? arena.height ?? 7
	const maxStack = arena.maxStack ?? 6
	return { origin, maxWidth, maxDepth, maxHeight, maxStack }
}

async function scanArenaForFlagBlocks({ bot, arena }) {
	const a = normalizeArena(arena)
	const positions = []

	const x1 = a.origin.x - 2
	const x2 = a.origin.x + a.maxWidth + 2
	const z1 = a.origin.z - 2
	const z2 = a.origin.z + a.maxDepth + 2

	const y1 = a.origin.y - 10
	const y2 = a.origin.y + a.maxStack * a.maxHeight + 40

	for (let y = y2; y >= y1; y--) {
		for (let x = x1; x <= x2; x++) {
			for (let z = z1; z <= z2; z++) {
				const block = bot.blockAt(new Vec3(x, y, z))
				if (block && FLAG_BLOCKS.has(block.name)) positions.push(block.position)
			}
		}
		// Yield periodically so we don't freeze the event loop on large scans.
		if (y % 8 === 0) await new Promise(resolve => setImmediate(resolve))
	}

	return positions
}

module.exports = {
	FLAG_BLOCKS,
	scanArenaForFlagBlocks,
}
