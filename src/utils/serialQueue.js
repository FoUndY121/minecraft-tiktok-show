function createSerialQueue() {
	let running = false
	const queue = []

	const runNext = async () => {
		if (running) return
		const next = queue.shift()
		if (!next) return
		running = true
		try {
			await next()
		} finally {
			running = false
			// run in next tick to avoid deep recursion
			setTimeout(() => {
				runNext().catch(() => {})
			}, 0)
		}
	}

	const enqueue = taskFn => {
		const task = new Promise((resolve, reject) => {
			queue.push(async () => {
				try {
					resolve(await taskFn())
				} catch (err) {
					reject(err)
					throw err
				}
			})
		})
		runNext().catch(() => {})
		return task
	}

	const enqueueNamed = (name, taskFn) => {
		return enqueue(async () => {
			console.log(`⏳ Queue start: ${name} (pending=${queue.length})`)
			try {
				await taskFn()
			} catch (err) {
				console.log(`❌ Queue failed: ${name}:`, err?.message || err)
				throw err
			} finally {
				console.log(`🏁 Queue finished: ${name} (pending=${queue.length})`)
			}
		})
	}

	return {
		enqueue,
		enqueueNamed,
		isBusy: () => running,
		size: () => queue.length,
	}
}

module.exports = {
	createSerialQueue,
}
