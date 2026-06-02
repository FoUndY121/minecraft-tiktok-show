let dirty = false
let reason = null
let changedAt = 0

function markArenaDirty(nextReason = 'arena_changed') {
	dirty = true
	reason = nextReason
	changedAt = Date.now()
}

function consumeArenaDirty() {
	if (!dirty) return null
	const state = { dirty, reason, changedAt }
	dirty = false
	reason = null
	changedAt = 0
	return state
}

function isArenaDirty() {
	return dirty
}

module.exports = {
	markArenaDirty,
	consumeArenaDirty,
	isArenaDirty,
}
