import { fetchForBackup, fetchWithBackup } from "./backup.js";
import {getProjects} from "./adstash.mjs"
import {locale_int_string_sort, string_sort} from "./util.js";
import {PieChart} from "./components/pie-chart.js";
import ProjectDisplay from "./components/ProjectDisplay.mjs";
import UpdateTextField from "./components/UpdateTextField.mjs";
import Search from "./Search.mjs"

class Table {
    constructor(wrapper, data_function, updateProjectDisplay){
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.updateProjectDisplay = updateProjectDisplay
        this.columns = [
            {
                id: 'numJobs',
                name: 'Jobs Ran',
                data: (row) => Math.floor(row.numJobs).toLocaleString(),
                sort: { compare: locale_int_string_sort }
            },
            {
                id: 'projectName',
                name: 'Name',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'PIName',
                name: 'PI Name',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'Organization',
                name: 'Organization',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'detailedFieldOfScience',
                name: 'Field Of Science',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }
        ]

        let table = this;
        this.grid =  new gridjs.Grid({
            columns: table.columns,
            sort: true,
            className: {
                container: "",
                table: "table table-hover",
                td: "pointer",
                paginationButton: "mt-2 mt-sm-0"
            },
            data: async () => Object.values(await table.data_function()).sort((a, b) => b.jobs - a.jobs),
            pagination: {
                enabled: true,
                limit: 50,
                buttonsCount: 1
            },
            style: {
                td: {
                    'text-align': 'right'
                }
            }
        }).render(table.wrapper);
        this.grid.on('rowClick', this.row_click);
    }
    update = async () => {
        let table = this
        this.grid.updateConfig({
            data: Object.values(await table.data_function()).sort((a, b) => b.numJobs - a.numJobs)
        }).forceRender();
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][1].data
        let project = data[row_name]
        this.updateProjectDisplay({...project, FieldOfScience: project.detailedFieldOfScience})
    }
}

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

    _getData = async () => {

        let topologyData = [];
        try {
          topologyData = (await fetchWithBackup(fetchForBackup, "https://topology.opensciencegrid.org/miscproject/json"))['data']
        } catch (e) {
          this.error = "Error fetching topology data, learn more on the OSG status page: status.osg-htc.org"
        }
        let usageJson;
        try {
            usageJson = (await fetchWithBackup(getProjects))['data']
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

class ProjectPage{
    constructor() {
        this.initialize()
    }

    /**
     * Initializes the project page objects
     *
     * Easier to do this all in an async environment so I can wait on data grabs
     * @returns {Promise<void>}
     */
    initialize = async () => {
        this.mode = undefined
        this.dataManager = new DataManager()

        let projectDisplayNode = document.getElementById("project-display")
        this.projectDisplay = new ProjectDisplay(projectDisplayNode)

        this.wrapper = document.getElementById("wrapper")
        this.table = new Table(this.wrapper, this.dataManager.getFilteredData, this.projectDisplay.update.bind(this.projectDisplay))
        this.dataManager.consumerToggles.push(this.table.update)

        this.search = new Search(Object.values(await this.dataManager.getData()), this.dataManager.toggleConsumers)
        this.dataManager.addFilter("search", this.search.filter)
        this.dataManager.addFilter("minimumJobsFilter", this.minimumJobsFilter)

        this.toggleActiveFilterButton = document.getElementById("toggle-active-filter")
        this.toggleActiveFilterButton.addEventListener("click", this.toggleActiveFilter)

        this.projectCount = new UpdateTextField(
            async () => Object.keys(await this.dataManager.getFilteredData()).length,
            document.getElementById("project-count")
        )

        let urlProject = new URLSearchParams(window.location.search).get('project')
        if(urlProject){
            this.projectDisplay.update((await this.dataManager.getData())[urlProject])
        }

        this.orgPieChart = new PieChart(
            "project-fos-cpu-summary",
            this.dataManager.reduceByKey.bind(this.dataManager, "detailedFieldOfScience", "cpuHours"),
            "# of CPU Hours by Field of Science"
        )
        this.FosPieChart = new PieChart(
            "project-fos-job-summary",
            this.dataManager.reduceByKey.bind(this.dataManager, "detailedFieldOfScience", "numJobs"),
            "# of Jobs by Field Of Science"
        )
        this.jobPieChart = new PieChart(
            "project-job-summary",
            this.dataManager.reduceByKey.bind(this.dataManager, "projectName", "numJobs"),
            "# of Jobs by Project",
            ({label, value}) => {
                this.table.updateProjectDisplay(this.dataManager.data[label])
            }
        )
        this.cpuPieChart = new PieChart(
            "project-cpu-summary",
            this.dataManager.reduceByKey.bind(this.dataManager, "projectName", "cpuHours"),
            "# of CPU Hours by Project",
            ({label, value}) => {
                this.table.updateProjectDisplay(this.dataManager.data[label])
            }
        )
        this.gpuPieChart = new PieChart(
            "project-gpu-summary",
            this.dataManager.reduceByKey.bind(this.dataManager, "projectName", "gpuHours"),
            "# of GPU Hours by Project",
            ({label, value}) => {
                this.table.updateProjectDisplay(this.dataManager.data[label])
            }
        )

        populate_aggregate_statistics()

        this.dataManager.consumerToggles.push(this.orgPieChart.update)
        this.dataManager.consumerToggles.push(this.FosPieChart.update)
        this.dataManager.consumerToggles.push(this.jobPieChart.update)
        this.dataManager.consumerToggles.push(this.cpuPieChart.update)
        this.dataManager.consumerToggles.push(this.gpuPieChart.update)
        this.dataManager.consumerToggles.push(this.projectCount.update)
        this.dataManager.consumerToggles.push(populate_aggregate_statistics)
    }

    minimumJobsFilter = (data) => {
        return Object.entries(data).reduce((pv, [k,v]) => {
            if(v['numJobs'] >= 100){
                pv[k] = v
            }
            return pv
        }, {})
    }

    toggleActiveFilter = () => {
        if("minimumJobsFilter" in this.dataManager.filters){
            this.dataManager.removeFilter("minimumJobsFilter")
        } else {
            this.dataManager.addFilter("minimumJobsFilter", this.minimumJobsFilter)
        }
    }
}

const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

const project_page = new ProjectPage()

const populate_aggregate_statistics = async () => {
    const data = await project_page.dataManager.getFilteredData()
    console.log(data)
    document.getElementById("ospool-projects").textContent = Object.keys(data).length
    document.getElementById("ospool-jobs").textContent = Object.values(data).reduce((p, v) => p + v.numJobs, 0).toLocaleString()
    document.getElementById("ospool-institutions").textContent = new Set(Object.values(data).map(v => v.InstitutionID)).size
    document.getElementById("ospool-fields-of-science").textContent = new Set(Object.values(data).map(v => v.detailedFieldOfScience)).size
    document.getElementById("ospool-aggregate-text").hidden = false
}
