import * as d3 from "https://cdn.skypack.dev/d3@7";
import * as topojson from 'https://cdn.skypack.dev/topojson';
import {transpose} from "../util.js";

class GlobeVisualization {

    constructor(canvas_id) {
        this.canvas = document.getElementById(canvas_id);
        this.dimension = this.canvas.offsetWidth
        this.canvas.height = this.dimension
        this.canvas.width = this.dimension
        this.projection = d3["geoOrthographic"]().translate([this.dimension/2,this.dimension/2]).scale(this.dimension/2).precision(0.1)
        this.context = this.canvas.getContext('2d');
        this.topo = undefined
        this.data = [[]]
        this.initialize()
    }

    initialize = async () => {
        this.frame_generator = this.globe()
        this.topo = await this.get_topo("110")
        this.create_frame()
        fetch("/web-preview/preview-homepage-refresh/assets/data/job_lines.json").then(d => d.json()).then(d => this.data = d)
        this.get_topo("50").then(d => this.topo = d)
    }

    create_frame = () => {
        this.frame_generator.next()
        setTimeout(() => this.create_frame(), 10)
    }

    * globe() {
        const path = d3.geoPath(this.projection, this.context);

        const render = (land, arcs, submits, hosts) => {

            this.context.clearRect(0, 0, 500, 500);
            this.context.beginPath(), path(this.sphere), this.context.fillStyle = "#edf4ff", this.context.fill();
            this.context.beginPath(), path(this.topo), this.context.fillStyle = "#000", this.context.fill();
            this.context.beginPath(), path({type: "MultiPoint", coordinates: submits}), this.context.fillStyle = "#D100C5", this.context.fill();
            this.context.beginPath(), path({type: "MultiPoint", coordinates: hosts}), this.context.fillStyle = "#00D183", this.context.fill();
            this.context.beginPath(), path({type: "MultiLineString", coordinates: arcs}), this.context.strokeStyle = "#FFAE2C", this.context.lineWidth = 2, this.context.stroke();

            return this.context.canvas
        }

        this.projection.rotate([50,-50,-10])

        let overlap = 500;
        let duration = 1000;

        var arcs = [new Arc(duration, this.data[0])]
        let index = 1;
        let last_triggered = Date.now();

        while(true){

            if((Date.now() - last_triggered) > (duration - overlap)){
                last_triggered = Date.now();

                arcs.push(new Arc(duration, this.data[index]));
                index = (index + 1) % this.data.length;
            }

            let submits = [];
            let hosts = [];
            let lines = [];
            let remove_one = false;

            for (const arc of arcs) {
                let [arc_submits, arc_hosts, arc_lines] = arc.get_arc()


                if(arc_submits == null){
                    remove_one = true;
                    continue
                }

                submits = submits.concat(arc_submits);
                hosts = hosts.concat(arc_hosts);
                lines = lines.concat(arc_lines);
            }

            if(remove_one){
                arcs.splice(0, 1)
                remove_one = false;
            }

            yield render(this.topo, lines, submits, hosts)
        }

        return d3.select(this.context.canvas).node();

    }

    sphere = {type: "Sphere"}

    get_topo = async (resolution) => {
        return await fetch(`/web-preview/preview-homepage-refresh/assets/data/land-${resolution}m.json`).then(t => t.json()).then(j => topojson.feature(j, j.objects.land))
    }
}

class Arc {
    constructor(duration, lines) {
        this.submit_locations = lines.map(p => p[0])
        this.host_locations = lines.map(p => p[1])
        this.interpolated_points = lines.map(p => d3.geoInterpolate(p[0], p[1]))
        this.startTime = Date.now()
        this.duration = duration
        this.lines = lines
    }

    get_arc(){
        let t_dx = (Date.now() - this.startTime) / this.duration;
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
        return [this.submit_locations, this.host_locations, arcs]
    }
}

export {GlobeVisualization}