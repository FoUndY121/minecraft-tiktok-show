const { Vec3 } = require('vec3')
const ARENA = require('../config/arena')
const { getCountryBlock, FLAG_BLOCKS } = require('./objectBuilder')
const { scanArenaForFlagBlocks } = require('../core/arenaScanner')

const noBlocksLogged = new Set()

function scanBounds({ bot, origin, width, depth, yMin, yMax, predicate }) {
	const found = []
	if (!bot?.blockAt || !origin) return found

	for (let y = yMax; y >= yMin; y--) {
		for (let z = origin.z; z < origin.z + depth; z++) {
			for (let x = origin.x; x < origin.x + width; x++) {
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

/**
 * findObjectBlocks:
 * - if objectEvent.scanExisting === true -> any FLAG_BLOCKS
 * - else -> try target block for country
 * - if target not found -> fallback any FLAG_BLOCKS in object area
 *
 * Returns Vec3 positions.
 */
async function findObjectBlocks({ bot, objectEvent, arena = null } = {}) {
	if (!objectEvent) return []

	const scanExisting = objectEvent.scanExisting === true
	const origin = objectEvent.origin
	const width = objectEvent.width ?? ARENA.width
	const depth = objectEvent.depth ?? ARENA.depth
	const height = objectEvent.height ?? ARENA.height

	// Extended Y range because gravity blocks can still be settling.
	const yMin = (origin?.y ?? ARENA.origin.y) - 10
	const yMax = (origin?.y ?? ARENA.origin.y) + height + 25

	// 1) If we don't have origin (cleanup event), scan whole arena.
	if (!origin) {
		if (!scanExisting) return []
		const arenaCfg = arena || {
			origin: ARENA.origin,
			maxWidth: ARENA.width,
			maxDepth: ARENA.depth,
			maxHeight: ARENA.height,
			maxStack: 6,
		}
		return await scanArenaForFlagBlocks({ bot, arena: arenaCfg })
	}

	// 2) Scan inside object area.
	if (scanExisting) {
		return scanBounds({
			bot,
			origin,
			width,
			depth,
			yMin,
			yMax,
			predicate: block => FLAG_BLOCKS.has(block.name),
		})
	}

	const targetBlock = getCountryBlock(objectEvent.country)
	const target = scanBounds({
		bot,
		origin,
		width,
		depth,
		yMin,
		yMax,
		predicate: block => block.name === targetBlock,
	})

	if (target.length > 0) {
		target.fallback = false
		return target
	}

	// Fallback: if country block is wrong / texture pack mismatch, still clear any flag blocks.
	const anyFlag = scanBounds({
		bot,
		origin,
		width,
		depth,
		yMin,
		yMax,
		predicate: block => FLAG_BLOCKS.has(block.name),
	})

	if (anyFlag.length > 0) {
		anyFlag.fallback = true
		return anyFlag
	}

	const arenaCfg = arena || {
		origin: ARENA.origin,
		maxWidth: ARENA.width,
		maxDepth: ARENA.depth,
		maxHeight: ARENA.height,
		maxStack: 6,
	}
	const arenaFlags = await scanArenaForFlagBlocks({ bot, arena: arenaCfg })
	if (arenaFlags.length > 0) {
		arenaFlags.fallback = true
		return arenaFlags
	}

	const logKey = objectEvent.id || `${objectEvent.country}:${targetBlock}`
	if (!noBlocksLogged.has(logKey)) {
		noBlocksLogged.add(logKey)
		console.log(
			`[BREAK] No blocks found for id=${objectEvent.id} country=${objectEvent.country} targetBlock=${targetBlock}, skipping`
		)
	}

	return []
}

module.exports = {
	findObjectBlocks,
}
