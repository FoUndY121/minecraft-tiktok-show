module.exports = {
	// --- Main fast break switch ---
	stableBreakMode: true,
	surfaceMiningMode: true,
	useBotDig: false,
	fastBreakMode: false,
	humanMiningMode: false,

	// --- Movement (fallback/legacy breakers) ---
	flightSpeed: 7.2,
	flightIntervalMs: 25,
	stopDistance: 1.4,
	movementMode: 'cinematic_fast_safe',
	outsideDistance: 2.2,
	flyStepSize: 0.55,
	flyStepIntervalMs: 25,
	boundsExpand: 0.7,
	emergencyDistance: 50,

	// --- Camera ---
	cameraLockEnabled: true,
	cameraLockIntervalMs: 45,
	cameraSyncIntervalMs: 60,
	gravitySettleDelayMs: 80,
	gravitySettleBeforeBreakMs: 1800,
	spawnWaitTimeoutMs: 5000,
	spawnWaitIntervalMs: 250,
	lookSmoothDurationMs: 120,
	lookSmoothSteps: 5,

	lookAtFlagDurationMs: 250,
	lookAtBlockDurationMs: 45,
	finalLookDurationMs: 70,

	// --- Teleport smoothing (RCON) ---
	teleportStepSize: 0.45,
	teleportStepIntervalMs: 25,

	// --- Breaking micro timings (fast, "LMB held" look) ---
	preBreakPauseMs: 25,
	preBreakLookMs: 15,
	swingPauseMs: 24,
	breakDelayMs: 25,
	blockBreakDelayMs: 10,
	afterBreakPauseMs: 70,
	lookDelayMs: 70,
	swingDelayMs: 60,

	// --- Fast breaker bursts ---
	blocksPerBurst: 2,
	blocksPerBurstMin: 12,
	blocksPerBurstMax: 18,
	burstsBeforeSideChange: 3,
	useTopSideOnlyAfterPass: 4,
	burstsPerSide: 2,
	minBlocksPerBurst: 6,
	maxBlocksPerBurst: 10,
	burstPauseMs: 50,
	sidePauseMs: 400,
	sideChangePauseMs: 180,
	passPauseMs: 250,
	maxCleanupPasses: 3,
	cleanupPassDelayMs: 250,
	rescanAfterArenaDirty: true,
	rescanEveryBlocks: 10,
	maxBlocksPerEvent: 800,
	maxBlocksPerPass: 1000,
	maxEmptyHits: 20,
	maxNoProgressMs: 10000,
	noProgressTimeoutMs: 10000,
	maxEventMs: 90000,
	maxBreakEventMs: 90000,
	maxDigAttemptsPerBlock: 3,
	maxBreakPasses: 8,
	maxPasses: 14,
	maxStableBreakPasses: 14,
	maxStableBreakEventMs: 90000,
	maxReachDistance: 5.5,
	tntFlagRadius: 2.5,
	tntMaxBlocksToRemove: 18,
	tntLargeGiftMaxBlocksToRemove: 25,

	// --- Dig settings ---
	maxDigTimeMs: 500,
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
