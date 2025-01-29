/**
 * Used to query the osg GRACC accounting endpoint
 *
 * This endpoint uses Elasticsearch
 */

const ADSTASH_SUMMARY_INDEX = "ospool-summary-*"
const ADSTASH_ENDPOINT = "https://elastic.osg.chtc.io/q"

const SUMMARY_INDEX = "gracc.osg.summary"
const ENDPOINT = "https://gracc.opensciencegrid.org/q"
const DEBUG=true
const DATE_RANGE = {
    oneYearAgo: new Date(new Date().setDate(new Date().getDate()-365)).getTime(), // Gets last years timestamp
    threeMonthsAgo: new Date(new Date().setDate(new Date().getDate()-90)).getTime(), // Gets date object 90 days in advance
    now: new Date().getTime()
}

const OSPOOL_FILTER = {
        regexp: {
            ProbeName: {"value": ".*(osgconnect\.net|grid\.uchicago\.edu|ci-connect\.net|xd-login\.opensciencegrid.org|SUBMIT.MIT.EDU|csiu.grid.iu.edu|otsgrid.iit.edu|workflow.isi.edu|lsst-glidein.rcac.purdue.edu|scosg16.jlab.org|gluex.phys.uconn.edu|login.duke.ci-connect.net|huxley-osgsub-001.sdmz.amnh.org|pcf-osg.t2.ucsd.edu|login.ci-connect.uchicago.edu|pcf-osg.t2.ucsd.edu|login.ci-connect.uchicago.edu|aragon.cyverse.org|akbul.cyverse.org|glidein-1.sbgrid.org|ce1.opensciencegrid.org|descmp3.cosmology.illinois.edu|osg-learn.chtc.wisc.edu|xd-submit0000.chtc.wisc.edu|login.snowmass21.io|nsgosg.sdsc.edu|osgsub01.sdcc.bnl.gov|uc.osg-htc.org|uw.osg-htc.org|ap21.uc.osg-htc.org)"}
        }
    }

class ElasticSearchQuery {
    constructor(index, endpoint) {
        this.index = index
        this.endpoint = endpoint
    }

    /**
     * Makes a request to the Elasticsearch API
     * @param url - The url to make the request too
     * @param body - The Object to be used as data
     * @param options - Additional Fetch request options
     * @returns Object - A JSON object
     */
    async make_request(url, body = {}, options={}){

        let response = await fetch(url, {
            ...options,
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if( !response.ok ){
            console.error(await response.json())
            throw `Invalid Response from ${url}`
        }

        return await response.json()
    }

    /**
     * Helper for Elasticsearch searches
     *
     * @param body - The object representative of the search
     * @param options - Any additional fetch options
     * @returns Object - A JSON object
     */
    async search(body, ...options){

        let url = `${this.endpoint}/${this.index}/_search`
        let method = "POST"

        return await this.make_request(url, body, {method:method, ...options})
    }
}

export { ENDPOINT, DEBUG, SUMMARY_INDEX, DATE_RANGE, OSPOOL_FILTER, ADSTASH_ENDPOINT, ADSTASH_SUMMARY_INDEX }
export default ElasticSearchQuery;



