import FacilityPage, {
    getFacilityEsData,
    getFacilitySummaryData,
    getTopologyData
} from "../facility-table.js";
import {PluginPosition, BaseComponent, h} from "https://unpkg.com/gridjs@5.1.0/dist/gridjs.module.js"

const GRAFANA_PROJECT_BASE_URL = "https://gracc.opensciencegrid.org/d-solo/hfZQzo2Vk/ospool-facility"

async function getData() {
    if (!getData.data) {
        let elasticSearchData = await getFacilityEsData(true)
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

const facility_page = new FacilityPage(getData, GRAFANA_PROJECT_BASE_URL)

class FacilitySummaryPlugin extends BaseComponent {

    constructor(...props) {
        super(...props);

        this.state = {
            numFacilities: 0,
            jobsRan: 0,
            numFieldsOfScience: 0,
            numProjects: 0
        };
    }

    setTotal() {
        getFacilitySummaryData(true).then(data => {
            this.setState(data);
        });
    }

    componentDidMount() {
        // initial setState
        this.setTotal();
    }

    render() {
        const tdClass = "gridjs-td pointer text-light bg-dark "


        let facilitiesLeft = h("div", { className: "col-auto" }, "Summary Statistics:")
        let facilitiesRight = h("div", { className: "col-auto" }, this.state['numFacilities'])
        let facilitiesDiv = h("div", { className: "row justify-content-between" }, facilitiesLeft, facilitiesRight)

        let numFacilities = h('td', { className: tdClass }, facilitiesDiv)
        let jobsRanTd = h('td', { textContent: this.state['jobsRan'], className: tdClass + "text-end"})
        let numFieldsOfScienceTd = h('td', { textContent: this.state['numFieldsOfScience'], className: tdClass + "text-end"})
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
