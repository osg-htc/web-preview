function makeDelay(ms) {
    let timer = 0;
    return function(callback){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
    };
};

function populate_project_node(project, node){
    node.getElementsByClassName("project-Name")[0].textContent = project["Name"]
    node.getElementsByClassName("project-PIName")[0].textContent = project["PIName"]
    node.getElementsByClassName("project-FieldOfScience")[0].textContent = project["FieldOfScience"]
    node.getElementsByClassName("project-Organization")[0].textContent = project["Organization"]
    node.getElementsByClassName("project-Description")[0].textContent = project["Description"]
}

class Search {
    constructor(data_function, listener) {
        this.node = document.getElementById("project-search")
        this.lunr_idx = undefined
        this.data_function = data_function
        this.listener = listener
        this.timer = undefined
        this.node.addEventListener("input", this.search)
    }
    search = () => {
        clearTimeout(this.timer)
        this.timer = setTimeout(this.listener, 250)
    }
    initialize = async () => {

        if(this.lunr_idx){return}

        let data = Object.values(await this.data_function())

        this.lunr_idx = lunr(function () {
            this.ref('Name')
            this.field('Department')
            this.field('Description')
            this.field('FieldOfScience')
            this.field('ID')
            this.field('Name')
            this.field('Organization')
            this.field('PIName')
            this.field('ResourceAllocations')

            data.forEach(function (doc) {
                this.add(doc)
            }, this)
        })
    }
    filter_data = (data) => {
        if(this.node.value == ""){
            return data
        } else {
            let table_keys = this.lunr_idx.search("*" + this.node.value + "*").map(r => r.ref)
            return table_keys.map(key => data[key])
        }
    }
}

class Table {
    constructor(wrapper, data_function){
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.display_node = document.getElementById("project-display")
        this.display_modal = new bootstrap.Modal(document.getElementById("project-display"), {
            keyboard: true
        })
        this.columns = [
            {
                id: 'Name',
                name: 'Name'
            }, {
                id: 'PIName',
                name: 'PI Name'
            }, {
                id: 'Organization',
                name: 'Organization'
            }, {
                id: 'FieldOfScience',
                name: 'Field Of Science'
            }, {
                id: "Department",
                name: "Department",
                hidden: true
            }, {
                id: "Description",
                name: "Description",
                hidden: true
            }, {
                id: "ID",
                name: "ID",
                hidden: true
            }, {
                id:  "Organization",
                name: "Organization",
                hidden: true
            }, {
                id: "ResourceAllocations",
                name: "Resource Allocations",
                hidden: true
            }
        ]
    }
    initialize = async () => {
        let table = this;
        this.grid =  new gridjs.Grid({
            columns: table.columns,
            sort: true,
            className: {
                container: "table-responsive",
                table: "table table-hover",
                td: "pointer",
                paginationButton: "mt-2 mt-sm-0"
            },
            data: async () => Object.values(await table.data_function()),
            pagination: {
                enabled: true,
                limit: 50,
                buttonsCount: 1
            }
        }).render(table.wrapper.node);
        this.grid.on('rowClick', this.row_click);
    }
    update = (data) => {
        this.grid.updateConfig({
            data: data
        }).forceRender();
    }
    toggle_row = (toggled_row, project) => {
        populate_project_node(project, this.display_node)
        this.display_modal.show()
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][0].data
        let project = data[row_name]
        this.toggle_row(PointerEvent.currentTarget, project)
    }
}

class CardDisplay{
    constructor(wrapper, data_function) {
        this.wrapper = wrapper
        this.data_function = data_function
        this.template_card = document.getElementById("template-card")
    }
    initialize = async () => {
        let data = await this.data_function()

        let projects = Object.values(data)

        this.update(projects)
    }
    update = async (data) => {
        this.wrapper.remove_children()

        for(const project of data){
            let clone = this.template_card.cloneNode(true)
            clone.removeAttribute('id')

            populate_project_node(project, clone)

            let card_key = project['Name'].replace(/\s|\./g, '')

            clone.setAttribute("href", "#" + card_key)
            clone.setAttribute("aria-controsl", card_key)
            clone.getElementsByClassName("project-Description-container")[0].setAttribute("id", card_key)

            this.wrapper.node.appendChild(clone)

            clone.hidden = false
        }
    }
}

class Wrapper {
    constructor() {
        this.node = document.getElementById("wrapper")
    }
    remove_children = () => {
        while(this.node.hasChildNodes()){
            this.node.removeChild(this.node.firstChild)
        }
    }
}

class ProjectPage{
    constructor(props) {
        this.mode = undefined
        this.data = undefined
        this.filtered_data = undefined
        this.wrapper = new Wrapper()
        this.search = new Search(this.get_data, this.update_data)
        this.table = new Table(this.wrapper, this.get_data)
        this.card_display = new CardDisplay(this.wrapper, this.get_data)
        window.addEventListener("resize", this.update_width)

        this.initialize()
    }
    initialize = async () => {
        await this.update_width() // update_width ~= initialize based on width
    }
    get_data = async () => {

        if( this.data ){ return this.data }

        let response;

        try{
            response = await fetch("https://topology.opensciencegrid.org/miscproject/json")
        } catch(error) {
            try{
                response = await fetch("/web-preview/preview-ccstar-update/assets/data/project.json")
            } catch(error){
                console.error("Topology and Back Up data fetch failed: " + error)
            }
        }

        this.data = await response.json()

        this.search.initialize()

        return this.data
    }
    update_data = () => {

        let new_filtered_data = this.search.filter_data(this.data)

        if(JSON.stringify(this.filtered_data) != JSON.stringify(new_filtered_data)){
            this.filtered_data = new_filtered_data
            this.update_page_data()
        }
    }
    update_page_data = () => {
        if(this.mode == "mobile"){
            this.card_display.update(Object.values(this.filtered_data))
        } else {
            this.table.update(Object.values(this.filtered_data))
        }
    }
    update_width = async () => {
        let new_mode = window.innerWidth < 576 ? "mobile" : "desktop";
        if( new_mode != this.mode){
            this.mode = new_mode
            this.wrapper.remove_children()
            if(this.mode == "mobile"){
                await this.card_display.initialize()
            } else {
                await this.table.initialize()
            }
            this.update_data()
        }
    }
}

const project_page = new ProjectPage()
