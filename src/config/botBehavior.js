module.exports = {
	// --- Main fast break switch ---
	fastBreakMode: true,

	// --- Movement (fallback/legacy breakers) ---
	flightSpeed: 7.2,
	flightIntervalMs: 25,
	stopDistance: 1.4,

	// --- Camera ---
	cameraLockEnabled: true,
	cameraLockIntervalMs: 25,
	cameraSyncIntervalMs: 60,
	gravitySettleDelayMs: 1800,

	lookAtFlagDurationMs: 250,
	lookAtBlockDurationMs: 90,
	finalLookDurationMs: 70,

	// --- Teleport smoothing (RCON) ---
	teleportStepSize: 0.45,
	teleportStepIntervalMs: 25,

	// --- Breaking micro timings (fast, "LMB held" look) ---
	preBreakPauseMs: 40,
	swingPauseMs: 60,
	breakDelayMs: 45,
	afterBreakPauseMs: 35,
	lookDelayMs: 70,
	swingDelayMs: 60,

	// --- Fast breaker bursts ---
	blocksPerBurst: 5,
	burstPauseMs: 25,

	// --- Dig settings ---
	maxDigTimeMs: 350,
	useDigFallback: true,
	fallbackSetBlock: true,

	// --- Reactions ---
	reactionShortMs: 500,
	reactionLongMs: 1200,

	// --- Optional camera shake (keep but tuned down for speed) ---
	cameraMicroShake: true,
	cameraShakeIntensity: 0.055,
	cameraShakeIntervalMs: 45,

	// --- Effects tuning ---
	fireworksPerSpawn: {
		min: 2,
		max: 4,
	},

	lightningPerSpawn: {
		min: 2,
		max: 3,
	},

	chaosChance: 0.08,
}
