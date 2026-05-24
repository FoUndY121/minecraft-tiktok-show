const { safeRconCommand } = require('../rcon')
const { ARENA } = require('../config/arena')

const FLAG_BLOCKS = [
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
	'gray_concrete_powder',
]

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function sizeFromArena() {
	return {
		width: ARENA.flagWidth,
		height: ARENA.flagHeight,
		depth: ARENA.flagDepth,
	}
}

function horizontalBlock(stripesBottomToTop, size, yRel) {
	const stripeHeight = Math.max(1, Math.ceil(size.height / stripesBottomToTop.length))
	const stripe = Math.min(stripesBottomToTop.length - 1, Math.floor(yRel / stripeHeight))
	return stripesBottomToTop[stripe]
}

function verticalBlock(stripesLeftToRight, size, xRel) {
	const stripeWidth = Math.max(1, Math.ceil(size.width / stripesLeftToRight.length))
	const stripe = Math.min(stripesLeftToRight.length - 1, Math.floor(xRel / stripeWidth))
	return stripesLeftToRight[stripe]
}

async function fillBox(rcon, { x1, y1, z1, x2, y2, z2, block, replace }) {
	const replacePart = replace ? ` replace minecraft:${replace}` : ''
	return await safeRconCommand(
		rcon,
		`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} minecraft:${block}${replacePart}`
	)
}

async function summonFallingBlock(rcon, { x, z, fromY, block }) {
	return await safeRconCommand(
		rcon,
		`summon minecraft:falling_block ${x + 0.5} ${fromY} ${z + 0.5} {BlockState:{Name:"minecraft:${block}"},Time:1,DropItem:0b,Tags:["TikTokShowFallingFlag"],Motion:[0.0,-0.08,0.0]}`
	)
}

async function clearFallingFlagBlocks(rcon, origin, size) {
	await safeRconCommand(
		rcon,
		`kill @e[type=minecraft:falling_block,tag=TikTokShowFallingFlag,x=${origin.x - 2},y=${origin.y},z=${origin.z - 2},dx=${size.width + 4},dy=${size.height + 80},dz=${size.depth + 4}]`
	)
}

async function launchFlagFireworks(rcon, origin, size, yOffset = 2) {
	const y = origin.y + size.height + yOffset
	const points = [
		{ x: origin.x - 1, z: origin.z },
		{ x: origin.x + size.width, z: origin.z },
		{ x: origin.x + Math.floor(size.width / 2), z: origin.z - 2 },
		{ x: origin.x + Math.floor(size.width / 2), z: origin.z + size.depth + 1 },
	]

	for (const point of points) {
		await safeRconCommand(
			rcon,
			`summon minecraft:firework_rocket ${point.x + 0.5} ${y} ${point.z + 0.5} {LifeTime:18,FireworksItem:{id:"minecraft:firework_rocket",Count:1b,tag:{Fireworks:{Flight:1b,Explosions:[{Type:1b,Flicker:1b,Trail:1b,Colors:[I;16766720,16777215],FadeColors:[I;5636095]}]}}}}`
		)
		await sleep(55)
	}
}

async function placeTopper(rcon, origin, size) {
	const y = origin.y + size.height
	const x1 = origin.x
	const x2 = origin.x + size.width - 1
	const z1 = origin.z
	const z2 = origin.z + size.depth - 1
	const cx = origin.x + Math.floor(size.width / 2)

	await fillBox(rcon, { x1, y1: y, z1, x2, y2: y, z2, block: 'gold_block' })
	await fillBox(rcon, {
		x1: Math.max(x1, cx - 1),
		y1: y + 1,
		z1,
		x2: Math.min(x2, cx + 1),
		y2: y + 1,
		z2,
		block: 'sea_lantern',
	})
	await safeRconCommand(
		rcon,
		`particle minecraft:end_rod ${origin.x + size.width / 2} ${y + 1.2} ${origin.z + size.depth / 2} ${size.width / 4} 0.35 0.3 0.02 32 force`
	)
}

async function placeFlagLayer(rcon, origin, size, yRel, blockAt) {
	const y = origin.y + yRel

	for (let zRel = 0; zRel < size.depth; zRel++) {
		let xRel = 0
		while (xRel < size.width) {
			const block = blockAt({ xRel, yRel, zRel })
			let x2Rel = xRel
			while (
				x2Rel + 1 < size.width &&
				blockAt({ xRel: x2Rel + 1, yRel, zRel }) === block
			) {
				x2Rel += 1
			}

			await fillBox(rcon, {
				x1: origin.x + xRel,
				y1: y,
				z1: origin.z + zRel,
				x2: origin.x + x2Rel,
				y2: y,
				z2: origin.z + zRel,
				block,
			})
			xRel = x2Rel + 1
		}
	}
}

async function spawnFallingFlag(rcon, origin, blockAt) {
	const size = sizeFromArena()
	const fallOffset = Math.max(18, Math.min(30, size.height))
	const layerSettleMs = 230

	console.log(
		`[SPAWN_QUEUE] fixed origin ${origin.x},${origin.y},${origin.z} size=${size.width}x${size.height}x${size.depth}`
	)

	await clearFallingFlagBlocks(rcon, origin, size)
	await launchFlagFireworks(rcon, origin, size, fallOffset + 2)

	for (let yRel = 0; yRel < size.height; yRel++) {
		const y = origin.y + yRel
		for (let zRel = 0; zRel < size.depth; zRel++) {
			for (let xRel = 0; xRel < size.width; xRel++) {
				await summonFallingBlock(rcon, {
					x: origin.x + xRel,
					z: origin.z + zRel,
					fromY: y + fallOffset,
					block: blockAt({ xRel, yRel, zRel }),
				})
			}
		}

		await sleep(layerSettleMs)
		await clearFallingFlagBlocks(rcon, origin, size)
		await placeFlagLayer(rcon, origin, size, yRel, blockAt)
	}

	await placeTopper(rcon, origin, size)
	await launchFlagFireworks(rcon, origin, size, 3)
	await clearFallingFlagBlocks(rcon, origin, size)

	return { origin: { ...origin }, width: size.width, height: size.height + 2, depth: size.depth }
}

async function spawnHorizontalFlag(rcon, origin, stripesBottomToTop) {
	const size = sizeFromArena()
	return await spawnFallingFlag(rcon, origin, ({ yRel }) =>
		horizontalBlock(stripesBottomToTop, size, yRel)
	)
}

async function spawnVerticalFlag(rcon, origin, stripesLeftToRight) {
	const size = sizeFromArena()
	return await spawnFallingFlag(rcon, origin, ({ xRel }) =>
		verticalBlock(stripesLeftToRight, size, xRel)
	)
}

async function clearFlag(rcon, origin, width, height, depth = ARENA.flagDepth) {
	await fillBox(rcon, {
		x1: origin.x,
		y1: origin.y,
		z1: origin.z,
		x2: origin.x + width - 1,
		y2: origin.y + height - 1,
		z2: origin.z + depth - 1,
		block: 'air',
	})
}

async function clearFlagWoolArea(rcon, origin, { width, height, depth }) {
	for (const block of FLAG_BLOCKS) {
		await fillBox(rcon, {
			x1: origin.x,
			y1: origin.y,
			z1: origin.z,
			x2: origin.x + width - 1,
			y2: origin.y + height - 1,
			z2: origin.z + depth - 1,
			block: 'air',
			replace: block,
		})
		await sleep(20)
	}
}

async function spawnUkraineFlag(rcon, origin) {
	return await spawnHorizontalFlag(rcon, origin, ['yellow_wool', 'blue_wool'])
}

async function spawnGermanyFlag(rcon, origin) {
	return await spawnHorizontalFlag(rcon, origin, ['yellow_wool', 'red_wool', 'black_wool'])
}

async function spawnPolandFlag(rcon, origin) {
	return await spawnHorizontalFlag(rcon, origin, ['red_wool', 'white_wool'])
}

async function spawnFranceFlag(rcon, origin) {
	return await spawnVerticalFlag(rcon, origin, ['blue_wool', 'white_wool', 'red_wool'])
}

async function spawnLithuaniaFlag(rcon, origin) {
	return await spawnHorizontalFlag(rcon, origin, ['red_wool', 'green_wool', 'yellow_wool'])
}

async function spawnRussiaFlag(rcon, origin) {
	return await spawnHorizontalFlag(rcon, origin, ['red_wool', 'blue_wool', 'white_wool'])
}

module.exports = {
	clearFlag,
	clearFlagWoolArea,
	spawnUkraineFlag,
	spawnGermanyFlag,
	spawnPolandFlag,
	spawnFranceFlag,
	spawnLithuaniaFlag,
	spawnRussiaFlag,
}
