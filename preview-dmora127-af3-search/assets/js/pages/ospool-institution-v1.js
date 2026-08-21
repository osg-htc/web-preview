import {getInstitutions, getInstitutionsOverview, getProjects} from "../adstash.mjs";
import {Grid, PluginPosition, BaseComponent, h} from "https://unpkg.com/gridjs@5.1.0/dist/gridjs.module.js"
import {GraccDisplay, locale_int_string_sort, string_sort, createNode} from "../util.js";
import InstitutionDisplay from "../components/InstitutionDisplay.mjs";
import { fetchWithBackup, fetchForBackup } from "../backup.js";

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
            this.data = await this._getData()
        }
        console.log(this.data)

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
        return (await fetchWithBackup(getInstitutions))['data']
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


class Table {
    constructor(wrapper, data_function, updateDisplay, tableOptions = {}, summaryData = {}) {
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.updateDisplay = updateDisplay
        this.tableOptions = tableOptions
        this.columns = [
            {
                id: 'institutionName',
                name: 'Name',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'numJobs',
                name: 'Jobs Ran',
                data: (row) => Math.floor(row.numJobs).toLocaleString(),
                sort: { compare: locale_int_string_sort }
            }, {
                id: 'numDetailedFieldOfScience',
                name: 'Impacted Fields of Science',
                data: (row) => row.numDetailedFieldOfScience.toLocaleString(),
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
            data: async () => Object.values(await this.data_function()).sort((a,b) => b['numJobs'] - a['numJobs']),
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
        this.updateDisplay(data[row_name])
    }
}

class FacilityPage {
    constructor(tableOptions) {
        this.mode = undefined
        this.dataFunction = new DataManager().getFilteredData
        this.wrapper = document.getElementById("wrapper")
        this.institutionDisplay = new InstitutionDisplay(document.getElementById("display"))
        this.table = new Table(this.wrapper, this.dataFunction, this.institutionDisplay.update.bind(this.institutionDisplay), tableOptions)
        this.initialize()
    }
    initialize = async () => {
        await this.usePopulatedFacility()
    }
    async usePopulatedFacility() {
        let searchParams = new URLSearchParams(window.location.search)
        let urlFacility = searchParams.has("institution") ? searchParams.get("institution") : searchParams.get("facility")
        if(urlFacility){
            await this.institutionDisplay.update((await this.dataFunction())[urlFacility])
        }
    }
}

const facility_page = new FacilityPage()

class FacilitySummaryPlugin extends BaseComponent {

    constructor(...props) {
        super(...props);

        this.state = {
            numInstitutions: 0,
            numJobs: 0,
            numDetailedFieldOfScience: 0,
            numProjects: 0
        };
    }

    setTotal() {
        fetchWithBackup(getInstitutionsOverview).then(data => {
            this.setState(data['data']);
        });
    }

    componentDidMount() {
        // initial setState
        this.setTotal();
    }

    render() {
        const tdClass = "gridjs-td pointer text-light bg-dark "


        let facilitiesLeft = h("div", { className: "col-auto" }, "Summary Statistics:")
        let facilitiesRight = h("div", { className: "col-auto" }, this.state['numInstitutions'])
        let facilitiesDiv = h("div", { className: "row justify-content-between" }, facilitiesLeft, facilitiesRight)

        let numFacilities = h('td', { className: tdClass }, facilitiesDiv)
        let jobsRanTd = h('td', { textContent: this.state['numJobs'].toLocaleString(), className: tdClass + "text-end"})
        let numFieldsOfScienceTd = h('td', { textContent: this.state['numDetailedFieldOfScience'], className: tdClass + "text-end"})
        let numProjectsTd = h('td', { textContent: this.state['numProjects'], className: tdClass + "text-end"})

        let row = h("tr", {}, numFacilities, jobsRanTd, numFieldsOfScienceTd, numProjectsTd)
        let tbody = h("tbody", {}, row)
        let table = h("table", {className: "gridjs-table"}, tbody)

        return table
    }
}

facility_page.table.grid.plugin.add({
    id: 'facilitySummaryPlugin',
    component: FacilitySummaryPlugin,
    position: PluginPosition.Footer,
    order: 1
})

facility_page.table.render()
