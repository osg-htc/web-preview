/**
 * A node to create and interact with a Grafana embedded graph
 *
 * A single node handles one graph which should be updated on the fly rather then recreated
 */
class GraccDisplay {
    constructor(srcUrl, showDisplay, searchParams, varKey, options) {
        for(const [k,v] of Object.entries(options)){
            this[k] = v
        }
        this.showDisplay = showDisplay
        this.srcUrl = srcUrl
        this.varKey = varKey
        this.loaded = false
        this.searchParams = searchParams
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
            node.style.width = this.width ? this.width : "100%"
            node.style.height = this.height ? this.height : "200px"
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
        let showDisplay = await this.showDisplay(this.searchParams[this.varKey])
        this.node.parentNode.style.display = showDisplay ? "flex" : "none";
        this.node.iframe.hidden = !this.loaded
        this.node.loadDisplay.hidden = this.loaded
    }
}

export {GraccDisplay}