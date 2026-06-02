function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function randomOffset(intensity) {
	return (Math.random() - 0.5) * intensity
}

async function smoothLookAt(bot, targetVec, options = {}) {
	const durationMs = options.durationMs ?? 140
	const steps = Math.max(1, Math.min(12, options.steps ?? 6))
	const stepDelay = Math.max(1, Math.floor(durationMs / steps))
	const jitter = options.jitter || 0

	if (!bot?.lookAt || !targetVec) return

	for (let i = 0; i < steps; i++) {
		try {
			await bot.lookAt(targetVec, false)
		} catch {}
		await delay(stepDelay)
	}

	try {
		await bot.lookAt(targetVec, true)
	} catch {}

	if (jitter > 0) {
		const microTarget = targetVec.offset(
			randomOffset(jitter),
			randomOffset(jitter),
			randomOffset(jitter)
		)
		try {
			await bot.lookAt(microTarget, false)
			await delay(20)
			await bot.lookAt(targetVec, true)
		} catch {}
	}
}

module.exports = {
	smoothLookAt,
}
