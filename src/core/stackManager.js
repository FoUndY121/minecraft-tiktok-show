class StackManager {
	constructor({ baseOrigin, objectHeight, maxStack = 6 } = {}) {
		this.baseOrigin = { ...baseOrigin }
		this.objectHeight = objectHeight
		this.maxStack = maxStack
		this.currentStackIndex = 0
	}

	getNextOrigin() {
		let stackResetRequired = false
		if (this.currentStackIndex >= this.maxStack) {
			stackResetRequired = true
			this.reset()
		}

		const stackIndex = this.currentStackIndex
		const targetY = this.baseOrigin.y + this.objectHeight * stackIndex
		this.currentStackIndex += 1

		return {
			...this.baseOrigin,
			y: targetY,
			stackIndex,
			targetY,
			stackResetRequired,
		}
	}

	markObjectSpawned(objectEvent) {
		if (!objectEvent) return
		this.currentStackIndex = Math.max(
			this.currentStackIndex,
			Number(objectEvent.stackIndex || 0) + 1
		)
	}

	markObjectDestroyed(_objectEvent) {
		// MVP keeps stack height reserved until maxStack reset.
	}

	reset() {
		this.currentStackIndex = 0
	}

	getClearBounds({ width, depth, extraY = 5 } = {}) {
		return {
			x1: this.baseOrigin.x,
			y1: this.baseOrigin.y,
			z1: this.baseOrigin.z,
			x2: this.baseOrigin.x + width - 1,
			y2: this.baseOrigin.y + this.objectHeight * this.maxStack + extraY,
			z2: this.baseOrigin.z + depth - 1,
		}
	}
}

module.exports = {
	StackManager,
}
