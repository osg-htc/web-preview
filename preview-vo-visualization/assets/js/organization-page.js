const iconConfig = {
    iconSize: [36,36],
    iconAnchor: [18, 36],
    popupAnchor: [0,-36],
    shadowUrl: "/assets/images/map/small_shadow.svg",
    shadowAnchor: [12,30],
    shadowSize: [24,24]
}

const icons = {
    blueIcon : L.icon({iconUrl: "/assets/images/map/blueIcon.svg", ...iconConfig}),
    redIcon : L.icon({iconUrl: "/assets/images/map/redIcon.svg", ...iconConfig}),
    greenIcon : L.icon({iconUrl: "/assets/images/map/greenIcon.svg", ...iconConfig}),
    purpleIcon : L.icon({iconUrl: "/assets/images/map/purpleIcon.svg", ...iconConfig})
}

let downloadPNG = async () => {
    let dataUrl = await domtoimage.toPng(document.getElementById("print-region"))

    let link = document.createElement('a');
    link.download = 'OSG_Map.png';
    link.href = dataUrl;
    link.click();
}

let toggleFullscreen = async () => {
    document.getElementById("main").requestFullscreen()
}

class Institution {
    constructor(name, {labs, latitude, longitude, country}) {
        this.name = name
        this.labs = labs
        this.latitude = latitude
        this.longitude = longitude
        this.country = country
    }

    get marker() {
        return L.marker([this.latitude, this.longitude]).bindPopup(this.html);
    }

    get html() {
        let container = document.createElement("div")
        container.classList.add("popup")

        let header = document.createElement("h4")
        header.textContent = this.name
        header.classList.add("card-header", "bg-white", "px-0")
        container.appendChild(header)

        if(this.labs){
            let labHeader = document.createElement("h5")
            labHeader.textContent = "Labs"
            labHeader.classList.add("rounded", "ps-0", "my-2")
            container.appendChild(labHeader)

            let labUL = document.createElement("ul")
            container.appendChild(labUL)
            this.labs.forEach(lab => {
                let labNode = document.createElement("li")
                labNode.textContent = lab
                labUL.appendChild(labNode)
            })
        }

        return container
    }
}

class ComputeSite {
    constructor(name, {ce, latitude, longitude, hosted_ce, ce_location, ap}) {
        this.name = name
        this.ce = ce
        this.latitude = latitude
        this.longitude = longitude
        this.hosted_ce = hosted_ce
        this.ce_location = ce_location
        this.ap = ap
    }

    get coordinates() {
        return [this.longitude, this.latitude]
    }

    get marker() {
        return L.marker(this.coordinates).bindPopup(this.html);
    }

    get html() {
        let container = document.createElement("div")
        container.classList.add("popup")

        let header = document.createElement("h4")
        header.textContent = this.name
        header.classList.add("card-header", "bg-white", "px-0")
        container.appendChild(header)

        if(this.ap) {
            let apNode = document.createElement("b")
            apNode.textContent = "Hosts Access Point"
            apNode.classList.add("ps-0", "my-2", "d-block")
            container.appendChild(apNode)
        }

        let ceCountNode = document.createElement("b")
        ceCountNode.textContent = "Hosts " + this.ce?.length + " Compute Entrypoint(s)"
        ceCountNode.classList.add("ps-0", "my-2", "d-block")
        container.appendChild(ceCountNode)

        if(this.hosted_ce == "Yes"){
            let hostedCeHeader = document.createElement("b")
            hostedCeHeader.textContent = "Hosted"
            hostedCeHeader.classList.add("ps-0", "my-2", "d-block")
            container.appendChild(hostedCeHeader)
        }

        return container
    }
}

class Collaboration {
    constructor(name, institutions, computeSites) {
        this.name = name
        this.institutions = institutions
        this.computeSites = computeSites
    }

    get views() {
        return {
            "institutions" : this.institutionView,
            "ces" : this.ceView,
            "aps" : this.apView
        }
    }

    get institutionView() {
        if(this._institutionView){
            return this._institutionView
        }

        let institutionViewMarkers = this.institutions.map(institution => {
            let marker = institution.marker
            marker.options.icon = icons.greenIcon
            return marker
        })

        this._institutionView = L.layerGroup(institutionViewMarkers)

        return this._institutionView
    }

    get ces() {
        return this.computeSites.filter(computeSite => computeSite.ce)
    }

    get ceView() {
        if(this._ceView){
            return this._ceView
        }

        let ceViewMarkers = this.ces.map(computeSite => {
            let marker = computeSite.marker
            marker.options.icon = icons.blueIcon
            return marker
        })

        this._ceView = L.layerGroup(ceViewMarkers)

        return this._ceView
    }

    get aps() {
        return this.computeSites.filter( computeSite => computeSite.ap )
    }

    get apView(){
        if(this._apView){
            return this._apView
        }

        let apViewMarkers = this.aps.map(computeSite => {
            let marker = computeSite.marker
            marker.options.icon = icons.purpleIcon
            return marker
        })

        this._apView = L.layerGroup(apViewMarkers)

        return this._apView
    }
}


class Map {

    constructor() {
        this.map = L.map('map').setView([38.96, -92.37], 4);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox/streets-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: 'pk.eyJ1IjoidGFraW5nZHJha2UiLCJhIjoiY2wya3IyZGNvMDFyOTNsbnhyZjBteHRycSJ9.g6tRaqN8_iJxHgAQKNP6Tw'
        }).addTo(this.map);

        // Initialize the legend nodes
        this.legendNode = document.getElementById("legend")
        this.legendItemsNode = document.getElementById("legend-items")
    }

    _updateLegend(legendData) {
        this.legendNode.hidden = false

        while(this.legendItemsNode.firstChild){
            this.legendItemsNode.removeChild(this.legendItemsNode.firstChild)
        }

        Object.entries(legendData).forEach( ([key,value]) => {
            let entryContainerNode = document.createElement("div")
            entryContainerNode.classList.add("entry-container")
            this.legendItemsNode.appendChild(entryContainerNode)

            let imgNode = document.createElement("img")
            let labelNode = document.createElement("span")
            entryContainerNode.appendChild(imgNode)
            entryContainerNode.appendChild(labelNode)

            imgNode.src = value
            imgNode.alt = "Icon for " + key

            labelNode.innerText = key
        })

        this.legendNode.hidden = false
    }

    _updateLayer(layer) {
        // Remove previous layer
        if( this.currentLayer ) {
            this.map.removeLayer(this.currentLayer)
        }

        // Update to new layer
        this.currentLayer = layer
        this.currentLayer.addTo(this.map)
    }

    update(layer, legend) {
        this._updateLayer(layer)
        this._updateLegend(legend)
    }
}

class Collaborations {
    constructor() {
        this.keypairs = {}
        this.initializeASYNC()
    }

    initializeASYNC = async () => {
        if(this.collaborations){
            return
        }
        this.collaborations = await this.initializeCollaborations()
    }

    fetchCollaborations = async () => {
        try {
            let collaborationsResponse = await fetch("https://raw.githubusercontent.com/ppaschos/Collab-dashboard-repo/main/data/collaborations.json")
            return await collaborationsResponse.json()
        } catch(error) {
            console.error("Could not fetch compute sites JSON for reason: " + error)
            return {}
        }
    }

    initializeCollaborations = async () => {

        let collaborationsJson = await this.fetchCollaborations()

        Object.entries(collaborationsJson).map((currentValue) => {
            let [name, {computeSites, institutions}] = currentValue

            institutions = Object.entries(institutions).map(institution => {
                let [name, data] = institution

                return new Institution(name, data)
            })

            computeSites = Object.entries(computeSites).map(computeSite => {
                let [name, data] = computeSite

                return new ComputeSite(name, data)
            })

            let newCollaboration = new Collaboration(name, institutions, computeSites)
            this[name] = newCollaboration
            this.keypairs[name] = newCollaboration
        })
    }


}

class CollaborationPage {
    constructor() {
        this.map = new Map()

        this.collaborations = new Collaborations()

        this.initializeViewSelect()
        this.initializeASYNC()
    }

    initializeASYNC = async () => {
        await this.collaborations.initializeASYNC()

        this.initializeCollaborationSelect()
        this.map.update(this.layer, this.legend)
    }

    initializeCollaborationSelect = () => {
        this.collaborationSelectNode = document.getElementById("collaboration")
        Object.keys(this.collaborations.keypairs).forEach(key => {
            let optionNode = document.createElement("option")
            optionNode.value = key
            optionNode.innerText = key
            this.collaborationSelectNode.appendChild(optionNode)
        })
    }

    initializeViewSelect = () => {
        this.viewSelectNode = document.getElementById("view")
        this.viewSelectNode.addEventListener("change", () => {
            this.map.update(this.layer, this.legend)
        })
    }

    get legend() {
        let legendData = {
            "institutions" : {
                "Institute" : icons.greenIcon?.options?.iconUrl
            },
            "ces" : {
                "Compute Entrypoints" : icons.blueIcon?.options?.iconUrl
            }
            ,
            "aps" : {
                "Access Points" : icons.purpleIcon?.options?.iconUrl
            }
        }

        return legendData[this.view]
    }

    get layer() {
        return this.collaborations[this.collaboration].views[this.view]
    }

    get collaboration() {
        return this.collaborationSelectNode.value
    }

    get view() {
        return this.viewSelectNode.value
    }
}

export { Collaborations, icons }