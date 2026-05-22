class LikeTracker {
	constructor({ threshold = 200, onThreshold } = {}) {
		this.threshold = threshold
		this.onThreshold = onThreshold
		this.likeBuffer = 0
	}

	addLikes(count, data = {}) {
		const likes = Math.max(0, Math.floor(Number(count) || 0))
		if (likes <= 0) return { triggered: 0, buffer: this.likeBuffer }

		this.likeBuffer += likes
		console.log(`[LIKES] +${likes} likes, buffer=${this.likeBuffer}/${this.threshold}`)

		let triggered = 0
		while (this.likeBuffer >= this.threshold) {
			this.likeBuffer -= this.threshold
			triggered += 1
			console.log('[LIKES] threshold reached, spawning TNT')

			try {
				Promise.resolve(this.onThreshold?.(data)).catch(err =>
					console.log('[LIKES] TNT handler failed:', err?.message || err)
				)
			} catch (err) {
				console.log('[LIKES] TNT handler failed:', err?.message || err)
			}
		}

		return { triggered, buffer: this.likeBuffer }
	}
}

module.exports = {
	LikeTracker,
}
