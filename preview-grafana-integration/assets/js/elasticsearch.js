/**
 * Used to query the osg GRACC accounting endpoint
 *
 * This endpoint uses Elasticsearch
 */

const SUMMARY_INDEX = "gracc.osg.summary"
const ENDPOINT = "https://gracc.opensciencegrid.org/q"
const DEBUG=true
const DATE_RANGE = {
    ninetyDaysAgo: new Date(new Date().setDate(new Date().getDate()-90)).getTime(), // Gets date object 90 days in advance
    now: new Date().getTime()
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

    async hasUsedCPU(){

        let url = `${this.endpoint}/${this.index}/_search`
        let method = "POST"
        let body = {

        }

        let options = {method:method, body:JSON.stringify(body)}

        if(DEBUG){
            console.log(options)
        }

        console.log( await this.make_request(url, options))
    }
}

export { ENDPOINT, DEBUG, SUMMARY_INDEX, DATE_RANGE }
export default ElasticSearchQuery;



