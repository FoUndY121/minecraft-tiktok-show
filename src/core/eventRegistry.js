class EventRegistry {
	constructor() {
		this.ids = new Set()
	}

	has(id) {
		return this.ids.has(id)
	}

	add(id) {
		if (!id || this.ids.has(id)) return false
		this.ids.add(id)
		return true
	}

	remove(id) {
		if (!id) return false
		return this.ids.delete(id)
	}
}

module.exports = {
	EventRegistry,
}
