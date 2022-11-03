import ElasticSearchQuery, {ENDPOINT, DATE_RANGE, SUMMARY_INDEX, DEBUG} from "../elasticsearch.js";
import {GraccDisplay} from "../util.js";

const GRAFANA_PROJECT_BASE_URL = "https://gracc.opensciencegrid.org/d-solo/axV4YtN4k/facility-public"
const GRAFANA_BASE = {
    orgId: 1,
    from: DATE_RANGE['oneYearAgo'],
    to: DATE_RANGE['now']
}

async function getTopologyData() {
    let response;

    try {
        response = await fetch("https://topology.opensciencegrid.org/miscfacility/json")
    } catch (error) {
        try {
            response = await fetch("/web-preview/preview-add-facilities-page/assets/data/facilities.json")
        } catch (error) {
            console.error("Topology and Back Up data fetch failed: " + error)
        }
    }
    return await response.json()
}

async function getElasticSearchData() {
    let es = new ElasticSearchQuery(SUMMARY_INDEX, ENDPOINT)

    // Query ES and ask for Sites that have provided resources in the last year
    let response = await es.search({"size": 0, "query": {"range": {"EndTime": {"lte": DATE_RANGE['now'], "gte": DATE_RANGE['oneYearAgo']}}}, "aggs": {"facilities": {"terms": {"field": "OIM_Facility", "size": 99999999}, "aggs": {"facilityCpuProvided": {"sum": {"field": "CoreHours"}}, "facilityGpuProvided": {"sum": {"field": "GPUHours"}}, "countProjectsImpacted": {"cardinality": {"field": "ProjectName"}}, "countFieldsOfScienceImpacted": {"cardinality": {"field": "OIM_FieldOfScience"}}, "countOrganizationImpacted": {"cardinality": {"field": "OIM_Organization"}}, "gpu_bucket_filter": {"bucket_selector": {"buckets_path": {"totalGPU": "facilityGpuProvided", "totalCPU": "facilityCpuProvided"}, "script": "params.totalGPU > 0 || params.totalCPU > 0"}}}}}})

    // Decompose this data into information we want, if they provided GPU or CPU
    let facilityBuckets = response.aggregations.facilities.buckets
    let facilityData = facilityBuckets.reduce((p, v) => {
        p[v['key']] = {
            name: v['key'],
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

async function getData() {
    if (!getData.data) {
        let elasticSearchData = await getElasticSearchData()
        let topologyData = await getTopologyData()

        // Combine the data sets on facility name
        getData.data = Object.entries(topologyData).reduce((p, [k, v]) => {
            if (k in elasticSearchData) {
                p[k] = {...elasticSearchData[k], ...topologyData[k]}
            }
            return p
        }, {})
    }

    return getData.data
}

/**
 * A node wrapping the project information break down
 */
class FacilityDisplay {
    constructor(nodeId) {
        this.parentNode = document.getElementById(nodeId)
        this.grafanaGraphInfo = [
            {
                className: "gpu-provided",
                panelId: 8,
                showDisplay: async (facility) => (await getData())[facility]?.gpuProvided > 0,
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
    }

    get graphDisplays() {
        // Create these when they are needed and not before
        if (!this._graphDisplays) {
            this._graphDisplays = this.grafanaGraphInfo.map(graph => {
                let wrapper = document.getElementsByClassName(graph['className'])[0]
                let graphDisplay = new GraccDisplay(
                    GRAFANA_PROJECT_BASE_URL,
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
        this.updateTextValue("facility-Name", Name)
        this.graphDisplays.forEach(gd => {
            gd.updateSearchParams({"var-facility": Name})
        })
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
            return data
        } else {
            let table_keys = this.lunr_idx.search("*" + this.node.value + "*").map(r => r.ref)
            return table_keys.map(key => data[key])
        }
    }
}

class Table {
    constructor(wrapper, data_function) {
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.facilityDisplay = new FacilityDisplay("display")
        this.display_modal = new bootstrap.Modal(document.getElementById("display"), {
            keyboard: true
        })
        this.columns = [
            {
                id: 'Name',
                name: 'Name'
            }, {
                id: 'cpuProvided',
                name: 'Contributed CPU Hours',
                data: (row) => Math.floor(row.cpuProvided)
            }, {
                id: 'numFieldsOfScience',
                name: 'Impacted Fields of Science'
            }, {
                id: 'numProjects',
                name: 'Impacted Research Projects'
            }
        ]
    }

    initialize = () => {
        let table = this;
        this.grid = new gridjs.Grid({
            columns: table.columns,
            sort: true,
            className: {
                container: "",
                table: "table table-hover",
                td: "pointer",
                paginationButton: "mt-2 mt-sm-0"
            },
            data: async () => Object.values(await table.data_function()),
            pagination: {
                enabled: true,
                limit: 50,
                buttonsCount: 1
            },
            width: "100%"
        }).render(table.wrapper);
        this.grid.on('rowClick', this.row_click);
    }
    update = (data) => {
        this.grid.updateConfig({
            data: data
        }).forceRender();
    }
    toggle_row = (toggled_row, facility) => {
        this.facilityDisplay.update(facility)
        this.display_modal.show()
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][0].data
        let facility = data[row_name]
        this.toggle_row(PointerEvent.currentTarget, facility)
    }
}

class FacilityPage {
    constructor() {
        this.mode = undefined
        this.data = undefined
        this.filtered_data = undefined
        this.wrapper = document.getElementById("wrapper")
        this.search = new Search(getData, this.update_data)
        this.table = new Table(this.wrapper, getData)
        this.initialize()
    }
    initialize = async () => {
        await getData()
        await this.table.initialize()
        await this.search.initialize()
    }
    update_data = async () => {
        let new_filtered_data = await this.search.filter_data()

        if (JSON.stringify(this.filtered_data) != JSON.stringify(new_filtered_data)) {
            this.filtered_data = new_filtered_data
            this.table.update(Object.values(this.filtered_data))
        }
    }
}

const facility_page = new FacilityPage()
