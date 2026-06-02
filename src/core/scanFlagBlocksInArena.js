const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const { FLAG_BLOCKS } = require('../config/flagBlocks')

function wholeArenaBounds(arena = ARENA) {
	const origin = arena.origin || ARENA.origin
	return {
		xMin: origin.x - 4,
		xMax: origin.x + 20,
		yMin: origin.y - 10,
		yMax: origin.y + 100,
		zMin: origin.z - 4,
		zMax: origin.z + 20,
	}
}

function eventBounds(objectEvent) {
	if (!objectEvent?.origin) return null

	const width = objectEvent.width || ARENA.width
	const depth = objectEvent.depth || ARENA.depth
	const height = objectEvent.height || ARENA.height
	const origin = objectEvent.origin

	return {
		xMin: Math.floor(origin.x - 2),
		xMax: Math.floor(origin.x + width + 2),
		yMin: Math.floor(origin.y - 6),
		yMax: Math.floor(origin.y + height + 12),
		zMin: Math.floor(origin.z - 2),
		zMax: Math.floor(origin.z + depth + 2),
	}
}

function scanBounds({ arena = ARENA, objectEvent = null, mode = 'event' } = {}) {
	if (mode === 'cleanup' || mode === 'expanded') return wholeArenaBounds(arena)
	return eventBounds(objectEvent) || wholeArenaBounds(arena)
}

async function scanBoundsForFlagBlocks({
	bot,
	bounds,
} = {}) {
	const positions = []
	if (!bot?.blockAt) return positions

	const { xMin, xMax, yMin, yMax, zMin, zMax } = bounds

	for (let y = yMax; y >= yMin; y--) {
		for (let x = xMin; x <= xMax; x++) {
			for (let z = zMin; z <= zMax; z++) {
				const pos = new Vec3(x, y, z)
				const block = bot.blockAt(pos)
				if (block && FLAG_BLOCKS.has(block.name)) {
					positions.push(block.position)
				}
			}
		}

		if (y % 8 === 0) await new Promise(resolve => setImmediate(resolve))
	}

	return positions
}

async function scanFlagBlocks({
	bot,
	arena = ARENA,
	objectEvent = null,
	mode = 'event',
} = {}) {
	if (!bot?.blockAt) return []

	const primaryBounds = scanBounds({
		arena,
		objectEvent,
		mode,
	})
	const positions = await scanBoundsForFlagBlocks({ bot, bounds: primaryBounds })
	if (
		positions.length === 0 &&
		mode === 'event' &&
		(objectEvent?.expandedSearch || objectEvent?.scanExisting)
	) {
		return scanBoundsForFlagBlocks({
			bot,
			bounds: wholeArenaBounds(arena),
		})
	}
	if (positions.length === 0 && mode === 'event' && objectEvent) {
		return scanBoundsForFlagBlocks({
			bot,
			bounds: wholeArenaBounds(arena),
		})
	}

	return positions
}

async function scanFlagBlocksInArena(args = {}) {
	return scanFlagBlocks({
		...args,
		mode: args.mode || (args.objectEvent ? 'event' : 'cleanup'),
	})
}

module.exports = {
	scanFlagBlocks,
	scanFlagBlocksInArena,
	scanBounds,
}
