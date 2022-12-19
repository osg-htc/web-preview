import ElasticSearchQuery, {ENDPOINT, DATE_RANGE, SUMMARY_INDEX} from "../elasticsearch.js";
import FacilityPage from "../facility-table.js";

async function getTopologyData() {
    let response;

    try {
        response = await fetch("https://topology.opensciencegrid.org/miscfacility/json")
    } catch (error) {
        try {
            response = await fetch("/web-preview/preview-update-submodules/assets/data/facilities.json")
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
            if (k in elasticSearchData && v.IsCCStar && v.Name !== "New Mexico State University") {
                p[k] = {...elasticSearchData[k], ...topologyData[k]}
            }
            return p
        }, {})
    }

    return getData.data
}

const facility_page = new FacilityPage(getData)