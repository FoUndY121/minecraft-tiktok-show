const { Vec3 } = require('vec3')
const { getCountryBlock } = require('./objectBuilder')

function scanBlocks({ bot, objectEvent, yMin, yMax, targetBlock }) {
	const found = []
	const origin = objectEvent.origin

	for (let y = yMax; y >= yMin; y--) {
		for (let z = origin.z; z < origin.z + objectEvent.depth; z++) {
			for (let x = origin.x; x < origin.x + objectEvent.width; x++) {
				const position = new Vec3(x, y, z)
				const block = bot?.blockAt ? bot.blockAt(position) : null
				if (!block || block.name !== targetBlock) continue
				found.push(position)
			}
		}
	}

	return found
}

async function findObjectBlocks({ bot, objectEvent }) {
	const targetBlock = getCountryBlock(objectEvent.country)	const FLAG_BLOCKS = new Set([
	  "sand",
	  "red_sand",
	  "white_concrete_powder",
	  "blue_concrete_powder",
	  "green_concrete_powder",
	  "yellow_concrete_powder",
	  "black_concrete_powder",
	  "gravel",
	  "orange_concrete_powder",
	  "light_blue_concrete_powder"
	]);
	
	async function findObjectBlocks({ bot, arena }) {
	  const blocks = [];
	  const { origin, maxWidth, maxDepth, maxHeight, maxStack } = arena;
	
	  for (let x = origin.x; x < origin.x + maxWidth; x++) {
		for (let y = origin.y - 5; y < origin.y + maxStack * maxHeight + 30; y++) {
		  for (let z = origin.z; z < origin.z + maxDepth; z++) {
			const block = bot.blockAt({ x, y, z });
			if (block && FLAG_BLOCKS.has(block.name)) {
			  blocks.push(block);
			}
		  }
		}
	  }
	
	  return blocks;
	}
	
	module.exports = { findObjectBlocks };
	const origin = objectEvent.origin
	const found = scanBlocks({
		bot,
		objectEvent,
		yMin: origin.y - 10,
		yMax: origin.y + objectEvent.height + 25,
		targetBlock,
	})

	if (found.length === 0) {
		console.log(`[BREAK] No blocks found country=${objectEvent.country} targetBlock=${targetBlock}`)
	}

	return found
}

module.exports = {
	findObjectBlocks,
}
