import ElasticSearchQuery, {DATE_RANGE, ENDPOINT, OSPOOL_FILTER, SUMMARY_INDEX} from "./elasticsearch.js";
import {GraccDisplay, locale_int_string_sort, string_sort, createNode} from "./util.js";
import {Grid, BaseComponent, h} from "https://unpkg.com/gridjs@5.1.0/dist/gridjs.module.js"

const GRAFANA_BASE = {
    orgId: 1,
    from: DATE_RANGE['oneYearAgo'],
    to: DATE_RANGE['now']
}

/**
 * A node wrapping the project information break down
 */
class FacilityDisplay {
    constructor(nodeId, dataFunction, grafanaUrl) {
        this.parentNode = document.getElementById(nodeId)
        this.dataFunction = dataFunction
        this.grafanaUrl = grafanaUrl
        this.grafanaGraphInfo = [
            {
                className: "gpu-provided",
                panelId: 8,
                showDisplay: async (facility) => (await this.dataFunction())[facility]?.gpuProvided > 0,
                ...GRAFANA_BASE
            }, {
                className: "cpu-provided",
                panelId: 2,
                showDisplay: async () => true,
                ...GRAFANA_BASE
            }, {
                className: "jobs-ran",
                panelId: 6,
                showDisplay: async  () => true,
                ...GRAFANA_BASE
            }, {
                className: "projects-supported",
                panelId: 18,
                height: "400px",
                showDisplay: async  () => true,
                ...GRAFANA_BASE
            }, {
                className: "fields-of-science-supported",
                panelId: 12,
                height: "400px",
                showDisplay: async  () => true,
                ...GRAFANA_BASE
            }, {
                className: "organizations-supported",
                panelId: 16,
                height: "400px",
                showDisplay: async  () => true,
                ...GRAFANA_BASE
            }
        ]
        this.display_modal = new bootstrap.Modal(this.parentNode, {
            keyboard: true
        })
        this.parentNode.addEventListener("hidden.bs.modal", this.onClose.bind(this))
    }

    get graphDisplays() {
        // Create these when they are needed and not before
        if (!this._graphDisplays) {
            this._graphDisplays = this.grafanaGraphInfo.map(graph => {
                let wrapper = document.getElementsByClassName(graph['className'])[0]
                let graphDisplay = new GraccDisplay(
                    this.grafanaUrl,
                    graph['showDisplay'],
                    {
                        to: graph['to'],
                        from: graph['from'],
                        orgId: graph['orgId'],
                        panelId: graph['panelId']
                    },
                    "var-facility",
                    graph
                )
                wrapper.appendChild(graphDisplay.node)
                return graphDisplay
            })
        }
        return this._graphDisplays
    }

    updateTextValue(className, value) {
        this.parentNode.getElementsByClassName(className)[0].textContent = value
    }

    update({Name}) {
        this.name = Name
        this.updateTextValue("facility-Name", Name)
        this.graphDisplays.forEach(gd => {
            gd.updateSearchParams({"var-facility": Name})
        })
        this.setUrl()
        this.display_modal.show()
    }

    setUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set("institution", this.name)
        history.pushState({}, '', url)
    }

    onClose(){
        this.unsetUrl()
        this.graphDisplays.forEach(gd => {
            gd.src = ""
        })
    }

    unsetUrl() {
        const url = new URL(window.location.href);
        url.searchParams.delete('institution')
        history.pushState({}, '', url)
    }
}

class Search {
    constructor(data_function, listener) {
        this.node = document.getElementById("search")
        this.lunr_idx = undefined
        this.data_function = data_function
        this.listener = listener
        this.timer = undefined
        this.node.addEventListener("input", this.search)
    }

    search = () => {
        clearTimeout(this.timer)
        this.timer = setTimeout(this.listener, 250)
    }
    initialize = async () => {

        if (this.lunr_idx) {
            return
        }

        let data = Object.values(await this.data_function())

        this.lunr_idx = lunr(function () {
            this.ref('Name')

            let fields = ['cpuProvided', 'gpuProvided', 'numProjects', 'numFieldsOfScience', 'numOrganizations', 'ID', 'IsCCStar', 'Name']
            for(const field of fields) {
                this.field(field)
            }
            data.forEach(function (doc) {
                this.add(doc)
            }, this)
        })
    }
    filter_data = async () => {
        let data = await this.data_function()
        if (this.node.value == "") {
            return Object.values(await this.data_function()).sort((a,b) => b['jobsRan'] - a['jobsRan'])
        } else {
            let table_keys = this.lunr_idx.search("*" + this.node.value + "*~2").map(r => r.ref)
            return table_keys.map(key => data[key])
        }
    }
}

class Table {
    constructor(wrapper, data_function, updateDisplay, tableOptions = {}, summaryData = {}) {
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.updateDisplay = updateDisplay
        this.tableOptions = tableOptions
        this.columns = [
            {
                id: 'Name',
                name: 'Name',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'jobsRan',
                name: 'Jobs Ran',
                data: (row) => Math.floor(row.jobsRan).toLocaleString(),
                sort: { compare: locale_int_string_sort }
            }, {
                id: 'numFieldsOfScience',
                name: 'Impacted Fields of Science',
                data: (row) => row.numFieldsOfScience.toLocaleString(),
                sort: { compare: locale_int_string_sort }
            }, {
                id: 'numProjects',
                name: 'Impacted Research Projects',
                data: (row) => row.numProjects.toLocaleString(),
                sort: { compare: locale_int_string_sort }
            }
        ]

        let table = this;
        this.grid = new Grid({
            columns: table.columns,
            sort: true,
            className: {
                container: "",
                table: "table table-hover",
                td: "pointer",
                paginationButton: "mt-2 mt-sm-0"
            },
            data: async () => Object.values(await this.data_function()).sort((a,b) => b['jobsRan'] - a['jobsRan']),
            width: "100%",
            search: {
                enabled: true
            },
            style: {
                td: {
                    'text-align': 'right'
                }
            },
            ...table.tableOptions
        }).render(table.wrapper);
        this.grid.on('rowClick', this.row_click);
    }

    render () {
        this.grid.forceRender()
    }

    update = (data) => {
        this.grid.updateConfig({
            data: data
        }).forceRender();
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][0].data
        let facility = data[row_name]
        this.updateDisplay(facility)
    }
}

class FacilityPage {
    constructor(dataFunction, grafanaUrl, tableOptions) {
        this.mode = undefined
        this.dataFunction = dataFunction
        this.data = undefined
        this.filtered_data = undefined
        this.wrapper = document.getElementById("wrapper")
        this.facilityDisplay = new FacilityDisplay("display", this.dataFunction, grafanaUrl)
        this.table = new Table(this.wrapper, this.dataFunction, this.facilityDisplay.update.bind(this.facilityDisplay), tableOptions)
        this.initialize()
    }
    initialize = async () => {
        await this.usePopulatedFacility()
    }
    update_data = async () => {
        let new_filtered_data = await this.search.filter_data()

        if (JSON.stringify(this.filtered_data) != JSON.stringify(new_filtered_data)) {
            this.filtered_data = new_filtered_data
            this.table.update(Object.values(this.filtered_data))
        }
    }
    async usePopulatedFacility() {
        let searchParams = new URLSearchParams(window.location.search)
        let urlFacility = searchParams.has("institution") ? searchParams.get("institution") : searchParams.get("facility")
        if(urlFacility){
            this.facilityDisplay.update((await this.dataFunction())[urlFacility])
        }
    }
}

async function getFacilityEsData(ospoolOnly = false){

    let es = new ElasticSearchQuery(SUMMARY_INDEX, ENDPOINT)

    // Query ES and ask for Sites that have provided resources in the last year
    let response = await es.search({
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"ResourceType": "Payload"}},
                    {"range": {"EndTime": {"lte": DATE_RANGE['now'], "gte": DATE_RANGE['oneYearAgo']}}},
                    ...(ospoolOnly ? [OSPOOL_FILTER] : []) // Cryptic but much cleaner
                ],
                "must_not": [
                    { "term" : {"ProjectName" : "GLOW"} },
                ]
            }
        },
        "aggs": {
            "fieldsOfScience": { "cardinality": { "field": "OIM_FieldOfScience" }, },
            "jobsRan": { "sum": { "field": "Count" } },
            "projects": { "cardinality": { "field": "ProjectName" } },
            "facilities": {
                "terms": {
                    "field": "OIM_Facility", "size": 99999999
                },
                "aggs": {
                    "facilityCpuProvided": {"sum": {"field": "CoreHours"}},
                    "facilityJobsRan": {"sum": {"field": "Count"}},
                    "facilityGpuProvided": {"sum": {"field": "GPUHours"}},
                    "countProjectsImpacted": {"cardinality": {"field": "ProjectName"}},
                    "countFieldsOfScienceImpacted": {"cardinality": {"field": "OIM_FieldOfScience"}},
                    "countOrganizationImpacted": {"cardinality": {"field": "OIM_Organization"}},
                    "gpu_bucket_filter": {
                        "bucket_selector": {
                            "buckets_path": {"totalGPU": "facilityGpuProvided", "totalCPU": "facilityCpuProvided"},
                            "script": "params.totalGPU > 0 || params.totalCPU > 0"
                        }
                    }
                }
            }
        }
    })

    // Decompose this data into information we want, if they provided GPU or CPU
    let facilityBuckets = response.aggregations.facilities.buckets
    let facilityData = facilityBuckets.reduce((p, v) => {
        p[v['key']] = {
            name: v['key'],
            jobsRan: v['facilityJobsRan']['value'],
            cpuProvided: v['facilityCpuProvided']['value'],
            gpuProvided: v['facilityGpuProvided']['value'],
            numProjects: v['countProjectsImpacted']['value'],
            numFieldsOfScience: v['countFieldsOfScienceImpacted']['value'],
            numOrganizations: v['countOrganizationImpacted']['value'],
        }
        return p
    }, {})

    return facilityData
}

async function getFacilitySummaryData(ospoolOnly=false) {

    let es = new ElasticSearchQuery(SUMMARY_INDEX, ENDPOINT)

    // Query ES and ask for Sites that have provided resources in the last year
    let response = await es.search({
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"ResourceType": "Payload"}},
                    {"range": {"EndTime": {"lte": DATE_RANGE['now'], "gte": DATE_RANGE['oneYearAgo']}}},
                    ...(ospoolOnly ? [OSPOOL_FILTER] : []) // Cryptic but much cleaner
                ],
                "must_not": [
                    { "term" : {"ProjectName" : "GLOW"} },
                ]
            }
        },
        "aggs": {
            "numFacilities": { "cardinality": { "field": "OIM_Facility" }, },
            "numFieldsOfScience": { "cardinality": { "field": "OIM_FieldOfScience" }, },
            "jobsRan": { "sum": { "field": "Count" } },
            "numProjects": { "cardinality": { "field": "ProjectName" } }
        }
    })

    // Pull out the summary data as well
    let summaryData = {
        numFacilities: `${response.aggregations.numFacilities.value.toLocaleString()}`,
        jobsRan: response.aggregations.jobsRan.value.toLocaleString(),
        numFieldsOfScience: response.aggregations.numFieldsOfScience.value.toLocaleString(),
        numProjects: response.aggregations.numProjects.value.toLocaleString()
    }

    return summaryData
}

async function getTopologyData() {
    let response;

    try {
        response = await fetch("https://topology.opensciencegrid.org/miscfacility/json")
    } catch (error) {
        try {
            response = await fetch("/web-preview/preview-events/assets/data/facilities.json")
        } catch (error) {
            console.error("Topology and Back Up data fetch failed: " + error)
        }
    }
    return await response.json()
}

export { getFacilityEsData, getFacilitySummaryData, getTopologyData }
export default FacilityPage