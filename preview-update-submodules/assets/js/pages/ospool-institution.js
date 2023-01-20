import FacilityPage, { getFacilityEsData, getTopologyData } from "../facility-table.js";

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