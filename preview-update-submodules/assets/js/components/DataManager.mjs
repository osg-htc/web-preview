import {getOverview} from "../adstash.mjs";

class DataManager {
	constructor(filters, consumerToggles, errorNode) {
		this.filters = filters ? filters : {}
		this.consumerToggles = consumerToggles ? consumerToggles : []
		this.errorNode = errorNode ? errorNode : document.getElementById("error")
		this.error = undefined
	}

	toggleConsumers = () => {
		this.consumerToggles.forEach(f => f())
	}

	addFilter = (name, filter) => {
		this.filters[name] = filter
		this.toggleConsumers()
	}

	removeFilter = (name) => {
		delete this.filters[name]
		this.toggleConsumers()
	}

	getData = async () => {
		if(!this.data) {
			this.data = this._getData()
		}
		return this.data
	}

	set error(error){
		if(error){
			this.errorNode.textContent = error
			this.errorNode.style.display = "block"
		} else {
			this.errorNode.style.display = "none"
		}
	}

	_fetch = async (url, options = {}) => {

		try {
			let response = await fetch(url, options)

			if(!response.ok){
				throw new Error(response.statusText)
			}

			return response.json()

		} catch(error) {
			this.error = "Error fetching usage data, learn more on the OSG status page: status.osg-htc.org"
		}
	}

	_getData = async () => {

		let topologyData = await this._fetch("https://topology.opensciencegrid.org/miscproject/json")
		let usageJson;
		try {
			usageJson = await getOverview()
		} catch(e) {
			this.error = "Error fetching usage data, learn more on the OSG status page: status.osg-htc.org"
		}

		this.data = Object.entries(topologyData).reduce((p, [k,v]) => {
			if(k in usageJson){
				p[k] = {...v, ...usageJson[k]}
			}
			return p
		}, {})

		return this.data
	}

	/**
	 * Filters the original data and returns the remaining data
	 * @returns {Promise<*>}
	 */
	getFilteredData = async () => {
		let filteredData = await this.getData()
		for(const filter of Object.values(this.filters)) {
			filteredData = filter(filteredData)
		}
		return filteredData
	}

	reduceByKey = async (key, value) => {
		let data = await this.getFilteredData()
		let reducedData = Object.values(data).reduce((p, v) => {
			if(v[key] in p) {
				p[v[key]] += v[value]
			} else {
				p[v[key]] = v[value]
			}
			return p
		}, {})
		let sortedData = Object.entries(reducedData)
				.filter(([k,v]) => v > 0)
				.map(([k,v]) => {return {label: k, [value]: Math.round(v)}})
				.sort((a, b) => b[value] - a[value])
		return {
			labels: sortedData.map(x => x.label),
			data: sortedData.map(x => x[value])
		}
	}
}

export default DataManager;