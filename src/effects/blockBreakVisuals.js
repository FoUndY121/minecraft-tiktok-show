const { safeSend } = require('../rcon')

function soundForBlock(blockName) {
	if (!blockName) return 'minecraft:block.sand.break'
	if (blockName.includes('gravel')) return 'minecraft:block.gravel.break'
	if (blockName.includes('concrete_powder')) {
		return 'minecraft:block.sand.break'
	}
	return 'minecraft:block.sand.break'
}

async function playBlockBreakVisuals({ rcon, blockName, position } = {}) {
	if (!rcon || !blockName || !position) return

	const x = Number(position.x).toFixed(2)
	const y = Number(position.y).toFixed(2)
	const z = Number(position.z).toFixed(2)
	const particleBlock = `minecraft:${blockName}`
	const sound = soundForBlock(blockName)

	try {
		await safeSend(
			rcon,
			`/particle minecraft:block ${particleBlock} ${x} ${y} ${z} 0.25 0.25 0.25 0.05 8 force`
		)
		await safeSend(rcon, `/playsound ${sound} master @a ${x} ${y} ${z} 0.7 1.1`)
	} catch {}
}

module.exports = {
	playBlockBreakVisuals,
}
