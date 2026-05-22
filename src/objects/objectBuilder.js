const countryBlocks = require('./countryBlocks')

const FLAG_BLOCKS = new Set([
	'sand',
	'red_sand',
	'white_concrete_powder',
	'blue_concrete_powder',
	'green_concrete_powder',
	'yellow_concrete_powder',
	'black_concrete_powder',
	'gravel',
	'orange_concrete_powder',
	'light_blue_concrete_powder',
])

function getCountryConfig(country) {
	const key = String(country || '').toLowerCase()
	return countryBlocks[key] || countryBlocks.default
}

function getCountryBlock(country) {
	const config = getCountryConfig(country)
	if (FLAG_BLOCKS.has(config.block)) return config.block
	console.log(`[OBJECT_BUILDER] warning invalid block=${config.block}, using sand`)
	return 'sand'
}

function buildObjectCommands({ country, origin, width, depth, height }) {
	const key = String(country || 'default').toLowerCase()
	const block = getCountryBlock(key)
	console.log(`[OBJECT_BUILDER] country=${key} block=${block}`)

	const commands = []
	for (let y = 0; y < height; y++) {
		for (let z = 0; z < depth; z++) {
			for (let x = 0; x < width; x++) {
				commands.push(
					`/setblock ${origin.x + x} ${origin.y + y} ${origin.z + z} minecraft:${block}`
				)
			}
		}
	}

	return commands
}

module.exports = {
	FLAG_BLOCKS,
	buildObjectCommands,
	getCountryBlock,
	getCountryConfig,
}
