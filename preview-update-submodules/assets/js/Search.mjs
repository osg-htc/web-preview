class Search {
	constructor(data, listener) {
		this.node = document.getElementById("project-search")
		this.listener = listener
		this.timer = undefined
		this.node.addEventListener("input", this.search)
		this.lunr_idx = lunr(function () {
			this.ref('projectName')
			this.field('detailedFieldOfScience')
			this.field('projectName')
			this.field('projectInstitutionName')

			data.forEach(function (doc) {
				this.add(doc)
			}, this)
		})
	}
	search = () => {
		clearTimeout(this.timer)
		this.timer = setTimeout(this.listener, 250)
	}
	filter = (data) => {
		if(this.node.value == ""){
			return data
		} else {
			console.log(this.node.value)
			let table_keys = this.lunr_idx.search(`*${this.node.value}* ${this.node.value} ${this.node.value}~2`).map(r => r.ref)
			return table_keys.reduce((pv, k) => {
				pv[k] = data[k]
				return pv
			}, {})
		}
	}
}

export default Search;