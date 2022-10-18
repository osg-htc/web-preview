import ElasticSearchQuery, {ENDPOINT, DATE_RANGE, SUMMARY_INDEX, DEBUG} from "./elasticsearch.js";

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
                range: {
                    EndTime: {
                        lte: DATE_RANGE['now'],
                        gte: DATE_RANGE['oneYearAgo']
                    }
                }
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
                        }
                    }
                }
            }
        })

        let projectBuckets = usageQueryResult.aggregations.projects.buckets

        this.usage = projectBuckets.reduce((p, v) => {
            p[v['key']] = {
                cpu: v['projectCpuUse']['value'] != 0,
                gpu: v['projectGpuUse']['value'] != 0
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


/**
 * A node to create and interact with a Grafana embedded graph
 *
 * A single node handles one graph which should be updated on the fly rather then recreated
 */
class GraccDisplay {
    constructor({srcUrl, showDisplay, searchParams}) {
        this.showDisplay = showDisplay
        this.srcUrl = srcUrl
        this.searchParams = searchParams
        this.loaded = false
    }

    get node() {
        if(!this._node){
            let iframe = document.createElement("iframe")
            iframe.width = "100%"
            iframe.height = "100%"
            iframe.src = this.src
            iframe.addEventListener("load", () => {
                this.loaded = true;
                this.toggle()
            })

            let loadDisplay = document.createElement("div")
            loadDisplay.classList.add("spinner-grow")
            loadDisplay.role = "status"

            let node = document.createElement("div")
            node.classList.add("justify-content-center")
            node.style.width = "100%"
            node.style.height = "200px"
            node.iframe = iframe
            node.appendChild(iframe)
            node.loadDisplay = loadDisplay
            node.appendChild(loadDisplay)

            this._node = node
        }
        return this._node
    }

    get searchParams(){
        return this._searchParams
    }

    set searchParams(searchParams){
        this._searchParams = searchParams
        this.update()
    }

    get src() {
        let url = new URL(this.srcUrl)
        let searchParams = {...this.searchParams}
        Object.entries(searchParams).forEach( ([k,v], i) => url.searchParams.append(k, v))
        return url.toString()
    }

    async update(){
        this.node.iframe.src = this.src
        this.loaded = false
        this.toggle()
    }

    updateSearchParams(searchParams){
        this.searchParams = {
            ...this.searchParams,
            ...searchParams
        }
    }

    async toggle(){
        let showDisplay = await this.showDisplay(this.searchParams["var-Project"])
        this.node.style.display = showDisplay ? "flex" : "none";
        this.node.iframe.hidden = !this.loaded
        this.node.loadDisplay.hidden = this.loaded
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
                ...GRAFANA_BASE
            },{
                className: "facilities-bar-graph",
                panelId: 10,
                showDisplay: UsageToggles.usedCpu,
                ...GRAFANA_BASE
            },{
                className: "gpu-hours-int",
                panelId: 16,
                showDisplay: UsageToggles.usedGpu,
                ...GRAFANA_BASE
            },{
                className: "gpu-hours-bar-graph",
                panelId: 14,
                showDisplay: UsageToggles.usedGpu,
                ...GRAFANA_BASE
            },{
                className: "cpu-core-hours-int",
                panelId: 4,
                showDisplay: UsageToggles.usedCpu,
                ...GRAFANA_BASE
            },{
                className: "cpu-core-hours-bar-graph",
                panelId: 2,
                showDisplay: UsageToggles.usedCpu,
                ...GRAFANA_BASE
            }
        ]
    }

    get graphDisplays(){
        // Create these when they are needed and not before
        if(!this._graphDisplays){
            this._graphDisplays = this.grafanaGraphInfo.map(graph => {
                let wrapper = document.getElementsByClassName(graph['className'])[0]
                let graphDisplay = new GraccDisplay({
                    srcUrl: GRAFANA_PROJECT_BASE_URL,
                    showDisplay: graph['showDisplay'],
                    searchParams: {
                        to: graph['to'],
                        from: graph['from'],
                        orgId: graph['orgId'],
                        panelId: graph['panelId']
                    }
                })
                wrapper.appendChild(graphDisplay.node)
                return graphDisplay
            })
        }
        return this._graphDisplays
    }

    updateTextValue(className, value){
        this.parentNode.getElementsByClassName(className)[0].textContent = value
    }

    update({Name, PIName, FieldOfScience, Organization, Description}) {
        this.updateTextValue("project-Name", Name)
        this.updateTextValue("project-PIName", PIName)
        this.updateTextValue("project-FieldOfScience", FieldOfScience)
        this.updateTextValue("project-Organization", Organization)
        this.updateTextValue("project-Description", Description)
        this.graphDisplays.forEach(gd => {
            gd.updateSearchParams({"var-Project": Name})
        })
    }
}

class Search {
    constructor(data_function, listener) {
        this.node = document.getElementById("project-search")
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

        if(this.lunr_idx){return}

        let data = Object.values(await this.data_function())

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
    filter_data = (data) => {
        if(this.node.value == ""){
            return data
        } else {
            let table_keys = this.lunr_idx.search("*" + this.node.value + "*").map(r => r.ref)
            return table_keys.map(key => data[key])
        }
    }
}

class Table {
    constructor(wrapper, data_function){
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper

        let projectDisplayNode = document.getElementById("project-display")
        this.projectDisplay = new ProjectDisplay(projectDisplayNode)
        this.display_modal = new bootstrap.Modal(projectDisplayNode, {
            keyboard: true
        })
        this.columns = [
            {
                id: 'Name',
                name: 'Name'
            }, {
                id: 'PIName',
                name: 'PI Name'
            }, {
                id: 'Organization',
                name: 'Organization'
            }, {
                id: 'FieldOfScience',
                name: 'Field Of Science'
            }
        ]
    }
    initialize = (data) => {
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
            data: async () => Object.values(await table.data_function()),
            pagination: {
                enabled: true,
                limit: 50,
                buttonsCount: 1
            },
            width: "1000px"
        }).render(table.wrapper);
        this.grid.on('rowClick', this.row_click);
    }
    update = (data) => {
        this.grid.updateConfig({
            data: data
        }).forceRender();
    }
    toggle_row = (toggled_row, project) => {
        this.projectDisplay.update(project)
        this.display_modal.show()
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][0].data
        let project = data[row_name]
        this.toggle_row(PointerEvent.currentTarget, project)
    }
}

class ProjectPage{
    constructor() {
        this.mode = undefined
        this.data = undefined
        this.filtered_data = undefined
        this.wrapper = document.getElementById("wrapper")
        this.search = new Search(this.get_data, this.update_data)
        this.table = new Table(this.wrapper, this.get_data)
        this.table.initialize()
    }
    get_data = async () => {

        if( this.data ){ return this.data }

        let response;

        try{
            response = await fetch("https://topology.opensciencegrid.org/miscproject/json")
        } catch(error) {
            try{
                response = await fetch("/web-preview/preview-training-event/assets/data/project.json")
            } catch(error){
                console.error("Topology and Back Up data fetch failed: " + error)
            }
        }

        let usageJson = await UsageToggles.getUsage()
        let responseJson = await response.json()

        this.data = Object.entries(responseJson).reduce((p, [k,v]) => {
            if(k in usageJson){
                p[k] = v
            }
            return p
        }, {})

        this.search.initialize()

        return this.data
    }
    update_data = () => {

        let new_filtered_data = this.search.filter_data(this.data)

        if(JSON.stringify(this.filtered_data) != JSON.stringify(new_filtered_data)){
            this.filtered_data = new_filtered_data
            this.table.update(Object.values(this.filtered_data))
        }
    }
}

UsageToggles.getUsage()
const project_page = new ProjectPage()
