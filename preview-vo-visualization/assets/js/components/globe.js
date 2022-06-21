import * as d3 from "https://cdn.skypack.dev/d3@7";
import * as topojson from 'https://cdn.skypack.dev/topojson';
import {transpose, easeOutExpo} from "../util.js";

import {icons} from "../organization-page.js";

class Icon {
    static size = [30, 45]
    static icons = {}
    static load() {
        ["blueIcon", "greenIcon", "purpleIcon"].map(i => Icon.getIcon(i))
    }
    static getIcon(icon) {
        if (icon in Icon.icons) {
            return Icon.icons[icon]
        }
        let image = new Image()
        image.src = icons[icon]?.options?.iconUrl
        Icon.icons[icon] = image
        return image
    }
    static getSize(scale){
        return Icon.size.map(s => s*scale)
    }
}

class View {
    constructor(range, id) {
        this.range = range
        this.fadedIn = false
        this.container = document.getElementById(id)
    }

    getViewProgress(scrollProgress) {
        return (scrollProgress - this.range[0])/ (this.range[1] - this.range[0])
    }

    fadeIn() {
        if(!this.fadedIn){
            this.container.classList.add("opaque")
            this.fadedIn = true
        }
    }

    fadeOut() {
        if(this.fadedIn) {
            this.container.classList.remove("opaque")
            this.fadedIn = false
        }
    }
}

class PointsView extends View {

    constructor(range, id, points, context, projection, icon) {
        super(range, id);
        this.points = points;
        this.context = context;
        this.projection = projection;
        this.icon = icon;
    }

    addIcons = (context, locations, scale, color) => {

        locations.sort((a,b) => {
            return a[1] - b[1]
        })

        locations.forEach( c => {
            let iconSize = Icon.getSize(scale)

            let adjusted_coordinates = [c[0] - iconSize[0]/2, c[1] - iconSize[1]]

            this.context.drawImage(Icon.getIcon(color), ...adjusted_coordinates, ...iconSize)
        })
    }

    iconScale(viewProgress) {
        if(viewProgress < .5){
            return easeOutExpo(viewProgress, 0, 1, .5)
        } else {
            return easeOutExpo(1 - viewProgress, 0, 1, .5)
        }
    }

    update = (scrollProgress) => {
        let viewProgress = this.getViewProgress(scrollProgress)

        let points = this.points
            .map(i => [i.longitude, i.latitude])
            .map(pos => this.projection(pos))

        let iconScale = this.iconScale(viewProgress)

        this.addIcons(this.context, points, iconScale, this.icon)

        if(.25 > viewProgress){
            this.fadeOut()
        } else if(viewProgress < .75){
            this.fadeIn()
        } else {
            this.fadeOut()
        }
    }
}

class ArcView extends View {

    constructor(range, id, points_from, points_to, context, projection) {
        super(range, id);
        this.points_from = points_from
        this.points_to = points_to;
        this.context = context;
        this.projection = projection;

        this.arc_points = []
        this.points_from.forEach(pf => {
            this.points_to.forEach(pt => {
                this.arc_points.push([pf, pt])
            })
        })
        this.arcs = new Arc(this.arc_points)
    }

    update = (scrollProgress) => {
        let arcs = this.arcs.get_arcs(this.getViewProgress(scrollProgress))
        let geoPath = d3.geoPath(this.projection, this.context)

        this.context.beginPath(), geoPath({type: "MultiLineString", coordinates: arcs}), this.context.strokeStyle = "#FFAE2C", this.context.lineWidth = 2, this.context.stroke();

    }
}

class CollaborationGlobe {

    constructor(canvas_id, collaboration) {
        this.outerContainer = document.getElementById("outer-globe-container")
        this.innerContainer = document.getElementById("inner-globe-container")

        this.ceView = document.getElementById("ce-view")
        this.globe = new GlobeVisualization(canvas_id, this.render)

        this.outerContainer.style.marginTop = this.globe.canvas.offsetHeight / 2 + "px"
        this.outerContainer.style.marginBottom = "-" + this.globe.canvas.offsetHeight / 2 + "px"
        this.innerContainer.style.height = this.globe.canvas.offsetHeight + "px"

        this.collaboration = collaboration
        this.height = this.outerContainer.clientHeight - (
            this.globe.canvas.getBoundingClientRect().bottom - this.globe.canvas.getBoundingClientRect().y
        )

        this.institutionView = new PointsView([-0.05, .25], "institutions-view", this.collaboration.institutions, this.globe.context, this.globe.projection, 'greenIcon')
        this.apView = new PointsView([.25, .5], "ap-view", this.collaboration.aps, this.globe.context, this.globe.projection, 'purpleIcon')
        this.arcView = new ArcView([.5, .75], "arc-view", this.collaboration.aps.map(i => [i.longitude, i.latitude]), this.collaboration.ces.map(i => [i.longitude, i.latitude]), this.globe.context, this.globe.projection)
        this.ceView = new PointsView([.75, 1], "ce-view", this.collaboration.ces, this.globe.context, this.globe.projection, 'blueIcon')

        this.populateHTML()
    }

    get scrollPosition() {
        let containerPosition = this.outerContainer.getBoundingClientRect().top + window.scrollY
        let globePosition = this.globe.canvas.getBoundingClientRect().top + window.scrollY

        return globePosition - containerPosition
    }

    get scrollProgress() {
        return this.scrollPosition / this.height
    }

    get view() {
        let view;
        if(this.scrollProgress < .25){
            view = this.institutionView
        } else if(this.scrollProgress < .5) {
            view = this.apView
        } else if(this.scrollProgress < .75) {
            view = this.arcView
        } else {
            view = this.ceView
        }

        // Make the removal of text deterministic
        if(view === this._view){
            return view
        } else {
            [this.institutionView, this.apView, this.ceView].filter(v => v !== view).forEach(v => v.update(1))
            this._view = view
            return view
        }
    }

    render = () => {
        this.view.update(this.scrollProgress)
    }

    populateHTML = () => {
        this.institutionView.container.getElementsByClassName("number-of")[0].textContent = parseInt(this.collaboration.institutions.length)
        this.apView.container.getElementsByClassName("number-of")[0].textContent = parseInt(this.collaboration.aps.length)
        this.ceView.container.getElementsByClassName("number-of")[0].textContent = parseInt(this.collaboration.ces.length)

        let ul = this.institutionView.container.getElementsByClassName("resource-list")[0].getElementsByTagName("ul")[0]
        // this.collaboration.institutions.forEach(i => {
        //     let li = document.createElement("li")
        //     li.textContent = i.name
        //     ul.appendChild(li)
        // }) TODO: Decide if this should be used
    }
}

class GlobeVisualization {

    constructor(canvas_id, renderFunction) {
        this.canvas = document.getElementById(canvas_id);
        this.canvas.height = this.canvas.offsetHeight
        this.canvas.width = this.canvas.offsetWidth
        this.projection = d3["geoNaturalEarth1"]().translate([this.canvas.width/2,this.canvas.height/2]).scale(this.canvas.width/6).precision(0.1)
        this.context = this.canvas.getContext('2d');
        this.geoPath = d3.geoPath(this.projection, this.context);
        this.topo = undefined
        this.renderFunction = renderFunction
        this.initialize()
    }

    initialize = async () => {
        this.frame_generator = this.globe()
        this.topo = await this.get_topo("110")
        this.create_frame()
        this.get_topo("50").then(d => this.topo = d)
    }

    create_frame = () => {
        this.frame_generator.next()
        setTimeout(() => this.create_frame(), 10)
    }

    * globe() {const render = () => {
            this.context.clearRect(0, 0, 1920, 1080);
            this.context.beginPath(), this.geoPath(this.sphere), this.context.fillStyle = "#f1f1f1", this.context.fill();
            this.context.beginPath(), this.geoPath(this.topo), this.context.fillStyle = "#5a5a5a", this.context.fill(); // this.context.strokeStyle = "#f1f1f1"; this.context.stroke()

            this.renderFunction()

            return this.context.canvas
        }

        while(true){
            yield render(this.topo)
        }

        return d3.select(this.context.canvas).node();
    }

    sphere = {type: "Sphere"}

    get_topo = async (resolution) => {
        return await fetch(`/web-preview/preview-vo-visualization/assets/data/countries-${resolution}m.json`).then(t => t.json()).then(j => topojson.feature(j, j.objects.land))
    }
}

class Arc {
    constructor(lines) {
        this.submit_locations = lines.map(p => p[0])
        this.host_locations = lines.map(p => p[1])
        this.interpolated_points = lines.map(p => d3.geoInterpolate(p[0], p[1]))
    }

    get_arcs = (position) => {
        let t_dx = position;
        let arcs;

        if( t_dx < .5 ){
            arcs = transpose([
                this.submit_locations,
                this.interpolated_points.map(ip => ip(t_dx * 2))
            ])
        } else if (t_dx < 1) {
            arcs = transpose([
                this.interpolated_points.map(ip => ip((t_dx - .5) * 2)),
                this.host_locations
            ])
        }  else {
            return [null, null, null]
        }
        return arcs
    }
}

export {GlobeVisualization, CollaborationGlobe}