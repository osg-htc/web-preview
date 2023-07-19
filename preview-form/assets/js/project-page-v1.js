import ElasticSearchQuery, {ENDPOINT, DATE_RANGE, SUMMARY_INDEX, OSPOOL_FILTER} from "./elasticsearch.js";
import {GraccDisplay, locale_int_string_sort, string_sort, hideNode} from "./util.js";

function makeDelay(ms) {
    let timer = 0;
    return function(callback){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
}

/**
 * A suite of Boolean functions deciding the visual status of a certain grafana graph
 *
 * true results in the graph being shown, false the opposite
 */
const elasticSearch = new ElasticSearchQuery(SUMMARY_INDEX, ENDPOINT)

class UsageToggles {

    static async getUsage() {
        if (this.usage) {
            return this.usage
        }

        let usageQueryResult = await elasticSearch.search({
            size: 0,
            query: {
                bool: {
                    filter: [
                        {
                            term: {ResourceType: "Payload"}
                        },
                        {
                            range: {
                                EndTime: {
                                    lte: DATE_RANGE['now'],
                                    gte: DATE_RANGE['oneYearAgo']
                                }
                            }
                        },
                        OSPOOL_FILTER
                    ]
                },
            },
            aggs: {
                projects: {
                    "terms": {
                        field: "ProjectName",
                        size: 99999999
                    },
                    aggs: {
                        projectCpuUse: {
                            sum: {
                                field: "CoreHours"
                            }
                        },
                        projectGpuUse: {
                            sum: {
                                field: "GPUHours"
                            }
                        },
                        projectJobsRan: {
                            sum: {
                                field: "Njobs"
                            }
                        }
                    }
                }
            }
        })

        let projectBuckets = usageQueryResult.aggregations.projects.buckets

        this.usage = projectBuckets.reduce((p, v) => {
            p[v['key']] = {
                cpu: v['projectCpuUse']['value'] != 0,
                gpu: v['projectGpuUse']['value'] != 0,
                jobs: v['projectJobsRan']['value']
            }
            return p
        }, {})

        return this.usage
    }

    static async usedCpu(projectName) {
        let usage = await UsageToggles.getUsage()
        if (projectName in usage) {
            return usage[projectName]["cpu"]
        }
        return false
    }

    static async usedGpu(projectName) {
        let usage = await UsageToggles.getUsage()
        if (projectName in usage) {
            return usage[projectName]["gpu"]
        }
        return false
    }
}

const GRAFANA_PROJECT_BASE_URL = "https://gracc.opensciencegrid.org/d-solo/tFUN4y44z/projects"
const GRAFANA_BASE = {
    orgId: 1,
    from: DATE_RANGE['oneYearAgo'],
    to: DATE_RANGE['now']
}

/**
 * A node wrapping the project information break down
 */
class ProjectDisplay{
    constructor(parentNode) {
        this.parentNode = parentNode
        this.grafanaGraphInfo = [
            {
                className: "facilities-int",
                panelId: 12,
                showDisplay: UsageToggles.usedCpu,
                height: "400px",
                ...GRAFANA_BASE
            },{
                className: "facilities-bar-graph",
                panelId: 10,
                showDisplay: UsageToggles.usedCpu,
                height: "400px",
                ...GRAFANA_BASE
            },{
                className: "gpu-hours-int",
                panelId: 16,
                showDisplay: UsageToggles.usedGpu,
                ...GRAFANA_BASE
            },{
                className: "cpu-core-hours-int",
                panelId: 4,
                showDisplay: UsageToggles.usedCpu,
                ...GRAFANA_BASE
            },{
                className: "jobs-ran-int",
                panelId: 22,
                showDisplay: UsageToggles.usedCpu,
                ...GRAFANA_BASE
            }
        ]
        this.display_modal = new bootstrap.Modal(parentNode, {
            keyboard: true
        })
    }

    get graphDisplays(){
        // Create these when they are needed and not before
        if(!this._graphDisplays){
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
                    "var-Project",
                    graph
                )
                wrapper.appendChild(graphDisplay.node)
                return graphDisplay
            })
        }
        return this._graphDisplays
    }

    setUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set("project", this.name)
        history.pushState({}, '', url)
    }

    updateTextValue(className, value){
        this.parentNode.getElementsByClassName(className)[0].textContent = value
    }

    update({Name, PIName, FieldOfScience, Organization, Description}) {
        this.name = Name;
        this.piName = PIName;
        this.fieldOfScience = FieldOfScience;
        this.organization = Organization;
        this.description = Description;

        this.updateTextValue("project-Name", Name)
        this.updateTextValue("project-PIName", PIName)
        this.updateTextValue("project-FieldOfScience", FieldOfScience)
        this.updateTextValue("project-Organization", Organization)
        this.updateTextValue("project-Description", Description)
        this.graphDisplays.forEach(gd => {
            gd.updateSearchParams({"var-Project": Name})
        })
        this.setUrl()
        this.display_modal.show()
    }
}

class Search {
    constructor(data, listener) {
        this.node = document.getElementById("project-search")
        this.listener = listener
        this.timer = undefined
        this.node.addEventListener("input", this.search)
        this.lunr_idx = lunr(function () {
            this.ref('Name')
            this.field('Department')
            this.field('Description')
            this.field('FieldOfScience')
            this.field('ID')
            this.field('Name')
            this.field('Organization')
            this.field('PIName')
            this.field('ResourceAllocations')

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
            let table_keys = this.lunr_idx.search("*" + this.node.value + "*").map(r => r.ref)
            return table_keys.reduce((pv, k) => {
                pv[k] = data[k]
                return pv
            }, {})
        }
    }
}

class Table {
    constructor(wrapper, data_function, updateProjectDisplay){
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.updateProjectDisplay = updateProjectDisplay
        this.columns = [
            {
                id: 'jobs',
                name: 'Jobs Ran',
                data: (row) => Math.floor(row.jobs).toLocaleString(),
                sort: { compare: locale_int_string_sort }
            },
            {
                id: 'Name',
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
                id: 'FieldOfScience',
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
            width: "1000px",
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
            data: Object.values(await table.data_function()).sort((a, b) => b.jobs - a.jobs)
        }).forceRender();
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][1].data
        let project = data[row_name]
        this.updateProjectDisplay(project)
    }
}

class DataManager {
    constructor(filters, consumerToggles) {
        this.filters = filters ? filters : {}
        this.consumerToggles = consumerToggles ? consumerToggles : []
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

    /**
     * Compiles the project data and does some prefilters to dump unwanted data
     * @returns {Promise<*>}
     */
    getData = async () => {

        if( this.data ){ return this.data }

        let response;

        try{
            response = await fetch("https://topology.opensciencegrid.org/miscproject/json")
        } catch(error) {
            try{
                response = await fetch("/web-preview/preview-form/assets/data/project.json")
            } catch(error){
                console.error("Topology and Back Up data fetch failed: " + error)
            }
        }

        let ospool_projects = new Set(await (await fetch("https://osg-htc.org/ospool-data/data/ospool_projects.json")).json())
        let osgconnect_projects = new Set(await (await fetch("/assets/data/osgconnect_projects.json")).json())

        let projects = new Set([...ospool_projects, ...osgconnect_projects])
        let usageJson = await UsageToggles.getUsage()
        let responseJson = await response.json()

        this.data = Object.entries(responseJson).reduce((p, [k,v]) => {
            if(k in usageJson && projects.has(k)){
                p[k] = {...v, ...usageJson[k]}
            }
            return p
        }, {})

        console.log(JSON.stringify(Object.keys(this.data)))

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

        this.search = new Search(Object.values(await this.dataManager.getData()), this.table.update)
        this.dataManager.addFilter("search", this.search.filter)
        this.dataManager.addFilter("minimumJobsFilter", this.minimumJobsFilter)

        this.toggleActiveFilterButton = document.getElementById("toggle-active-filter")
        this.toggleActiveFilterButton.addEventListener("click", this.toggleActiveFilter)

        let urlProject = new URLSearchParams(window.location.search).get('project')
        if(urlProject){
            this.projectDisplay.update((await this.dataManager.getData())[urlProject])
        }
    }

    minimumJobsFilter = (data) => {
        return Object.entries(data).reduce((pv, [k,v]) => {
            if(v['jobs'] >= 100){
                pv[k] = v
            } else {
                console.log(k)
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