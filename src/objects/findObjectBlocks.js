const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const { FLAG_BLOCKS } = require('../config/flagBlocks')

const noBlocksLogged = new Set()

function normalizeScanArea(arena = null) {
	const origin = arena?.origin || ARENA.origin
	const maxWidth = arena?.maxWidth ?? arena?.width ?? ARENA.width
	const maxDepth = arena?.maxDepth ?? arena?.depth ?? ARENA.depth
	const maxHeight = arena?.maxHeight ?? arena?.height ?? ARENA.height
	const maxStack = arena?.maxStack ?? 6

	return {
		xMin: origin.x - 2,
		xMax: origin.x + maxWidth + 2,
		yMin: origin.y - 10,
		yMax: origin.y + maxStack * maxHeight + 40,
		zMin: origin.z - 2,
		zMax: origin.z + maxDepth + 2,
	}
}

function scanBounds({ bot, bounds, predicate }) {
	const found = []
	if (!bot?.blockAt || !bounds) return found

	for (let y = bounds.yMax; y >= bounds.yMin; y--) {
		for (let z = bounds.zMin; z <= bounds.zMax; z++) {
			for (let x = bounds.xMin; x <= bounds.xMax; x++) {
				const pos = new Vec3(x, y, z)
				const block = bot.blockAt(pos)
				if (!block || block.name === 'air') continue
				if (!predicate(block)) continue
				found.push(pos)
			}
		}
	}

	return found
}

async function findObjectBlocks({ bot, objectEvent, arena = null } = {}) {
	if (!objectEvent) return []

	const bounds = normalizeScanArea(arena)
	const anyFlag = scanBounds({
		bot,
		bounds,
		predicate: block => FLAG_BLOCKS.has(block.name),
	})

	if (anyFlag.length > 0) {
		return anyFlag
	}

	const logKey = objectEvent.id || `${objectEvent.country || 'unknown'}:all_flags`
	if (!noBlocksLogged.has(logKey)) {
		noBlocksLogged.add(logKey)
		console.log(
			`[BREAK] No flag blocks found for id=${objectEvent.id} country=${objectEvent.country}, skipping`
		)
	}

	return []
}

module.exports = {
	findObjectBlocks,
}
