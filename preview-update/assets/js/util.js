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
            iframe.src = this.buildIframeSrc()
            iframe.setAttribute("frameBorder", true)
            iframe.addEventListener("load", () => {
                this.loaded = true;
                this.toggle()
            })

            let node = document.createElement("div")
            node.classList.add("justify-content-center")
            node.classList.add("d-flex")
            node.style.width = this.width ? this.width : "100%"
            node.style.height = this.height ? this.height : "200px"
            node.iframe = iframe
            node.appendChild(iframe)

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

    set src(src) {
        this.node.iframe.src = src
    }

    buildIframeSrc() {
        let url = new URL(this.srcUrl)
        let searchParams = {...this.searchParams}
        Object.entries(searchParams).forEach( ([k,v], i) => url.searchParams.append(k, v))
        return url.toString()
    }

    async update(){
        this.src = this.buildIframeSrc()
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
    }
}

let string_sort = (a, b) => {
    let a_standardized = a.toUpperCase()
    let b_standardized = b.toUpperCase()

    return a_standardized.localeCompare(b_standardized)
}

function localeIntToInt (i) {
    return parseInt(i.replace(/[^0-9\.]/g, ''))
}

let locale_int_string_sort = (a, b) => {
    let a_int = parseInt(localeIntToInt(a))
    let b_int = parseInt(localeIntToInt(b))
    return b_int - a_int
}

let hideNode = (e) => {
    e.currentTarget.hidden = true
}

/**
 *
 * @param tagName
 * @param children {Array}
 * @param options
 * @returns {HTMLElement}
 */
let createNode = ({tagName, children = [], ...options}) => {
    let node = document.createElement(tagName)

    Object.entries(options).forEach(([k, v]) => {
        node.setAttribute(k, v);
        node[k] = v;
    })
    children.forEach(n => node.appendChild(n))
    return node
}

const byteSizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
const bytesSizesLong = ['Bytes', 'Kilobytes', 'Megabytes', 'Gigabytes', 'Terabytes', 'Petabytes', 'Exabytes', 'Zettabytes', 'Yottabytes']

function formatBytes(bytes, long=false) {
    if (bytes === 0) return '0 Bytes';
    const k = 1000;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const byteValue = parseFloat((bytes / Math.pow(k, i)).toFixed(2))

    if(long){
        return `${byteValue} ${bytesSizesLong[i]}`
    } else {
        return `${byteValue} ${byteSizes[i]}`
    }
}

function byteStringToBytes(byteString) {
    const [value, type] = byteString.split(" ")
    const typeIndex = byteSizes.indexOf(type)
    const bytes = parseFloat(value) * Math.pow(1000, typeIndex)
    return bytes
}

function sortByteString(a, b) {
    if(byteStringToBytes(a) < byteStringToBytes(b)) return -1
    if(byteStringToBytes(a) > byteStringToBytes(b)) return 1
    return 0
}


export {GraccDisplay, string_sort, locale_int_string_sort, hideNode, createNode, formatBytes, sortByteString, byteStringToBytes, localeIntToInt}