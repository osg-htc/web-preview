import {PieChart} from "./pie-chart.js";
import {getInstitutionOverview, getProjectOverview} from "../adstash.mjs";
import Count from "./Count.mjs";

class InstitutionDisplay{
	constructor(parentNode) {
		this.parentNode = parentNode
		this.display_modal = new bootstrap.Modal(parentNode, {
			keyboard: true
		})
	}

	/**
	 * Replace the graph slot children with placeholders
	 */
	clearGraphSlots(){
		Array.from(document.getElementsByClassName("graph-slot")).forEach((n) => {
			while(n.firstChild){
				n.removeChild(n.firstChild)
			}
			let placeholder = document.createElement("span")
			placeholder.className = "placeholder  bg-light w-100"
			n.appendChild(placeholder)
		})
	}

	setUrl(Name) {
		const url = new URL(window.location.href);
		url.searchParams.set("institution", Name)
		history.pushState({}, '', url)
	}

	updateTextValue(className, value){
		Array.from(this.parentNode.getElementsByClassName(className)).forEach(e => {
			e.textContent = value
		})
	}

	async update({institutionName}) {
		this.updateTextValue("institution-Name", institutionName)
		this.setUrl(institutionName)
		this.clearGraphSlots()
		this.parentNode.addEventListener("shown.bs.modal", () => {
			this.updateWithData(institutionName)
		}, {once : true})
		this.display_modal.show()
	}

	async updateWithData(Name){
		const data = await this.getData(Name)

		console.log(data)

		this.fillTable(
				"supported-projects-table",
				Object.values(data)
						.reduce((acc, {projectName, numJobs}) => [...acc, [projectName, numJobs]], [])
						.sort((a, b) => b[1] - a[1])
		)
		this.fillTable(
				"supported-fos-table",
				Object.entries(
						Object.values(data)
							.reduce((acc, {detailedFieldOfScience, numJobs}) => {
							acc[detailedFieldOfScience] = acc[detailedFieldOfScience] ? acc[detailedFieldOfScience] + numJobs : numJobs;
							return acc;
						}, {})
				)
						.sort((a, b) => b[1] - a[1])
						.filter(([k, v]) => k !== 'null')
		)
		this.fillTable(
				"supported-project-institution-table",
				Object.entries(
						Object.values(data)
								.reduce((acc, {projectInstitutionName, numJobs}) => {
									acc[projectInstitutionName] = acc[projectInstitutionName] ? acc[projectInstitutionName] + numJobs : numJobs;
									return acc;
								}, {})
				)
						.sort((a, b) => b[1] - a[1])
						.filter(([k, v]) => k !== 'null')
		)
		Count("institution-job-count", Math.round(Object.values(data).reduce((p, v) => p + v.numJobs, 0)), 100)
		Count("institution-cpu-count", Math.round(Object.values(data).reduce((p, v) => p + v.cpuHours, 0)), 100)
		Count("institution-gpu-count", Math.round(Object.values(data).reduce((p, v) => p + v.gpuHours, 0)), 100)
	}

	async getData(Name){
		return await getInstitutionOverview(Name)
	}

	fillTable(id, data) {
		const table = document.getElementById(id);
		if (!table) {
			console.error(`Table with id ${id} not found.`);
			return;
		}

		// Get the table body from the table
		const tableBody = table.querySelector("tbody");

		// Clear existing rows in the table body
		while (tableBody.firstChild) {
			tableBody.removeChild(tableBody.firstChild);
		}

		// Add the data as rows to the table body
		data.forEach(([key, value]) => {
			const row = document.createElement("tr");
			const keyCell = document.createElement("td");
			keyCell.textContent = key;
			row.appendChild(keyCell);
			const valueCell = document.createElement("td");
			valueCell.className = "text-end";
			valueCell.textContent = value.toLocaleString();
			row.appendChild(valueCell);
			tableBody.appendChild(row);
		})
	}
}

export default InstitutionDisplay;
