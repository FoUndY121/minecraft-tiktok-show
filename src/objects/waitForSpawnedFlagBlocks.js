const { getCountryBlock } = require('./objectBuilder')
const { scanFlagBlocksInArena } = require('../core/scanFlagBlocksInArena')

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForSpawnedFlagBlocks({
	bot,
	arena,
	objectEvent,
	timeoutMs = 4000,
	intervalMs = 250,
} = {}) {
	const id = objectEvent?.id || 'unknown'
	const startedAt = Date.now()
	const targetBlock = objectEvent?.country ? getCountryBlock(objectEvent.country) : null

	console.log(`[SPAWN_WAIT] waiting for blocks id=${id}`)

	while (Date.now() - startedAt <= timeoutMs) {
		const blocks = await scanFlagBlocksInArena({
			bot,
			arena,
			objectEvent,
			mode: 'expanded',
		})
		const matchingBlocks = targetBlock
			? blocks.filter(pos => {
					const block = bot?.blockAt?.(pos)
					return block?.name === targetBlock
				})
			: blocks
		const found = matchingBlocks.length > 0 ? matchingBlocks : blocks

		if (found.length > 0) {
			console.log(`[SPAWN_WAIT] found blocks=${found.length} id=${id}`)
			return found
		}

		await delay(intervalMs)
	}

	console.log(`[SPAWN_WAIT] timeout blocks=0 id=${id}`)
	return []
}

module.exports = {
	waitForSpawnedFlagBlocks,
}
