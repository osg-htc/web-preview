import ElasticSearchQuery, {ENDPOINT, DATE_RANGE, SUMMARY_INDEX, OSPOOL_FILTER} from "/assets/js/elasticsearch-v1.js";
import {
    GraccDisplay,
    locale_int_string_sort,
    string_sort,
    hideNode,
    sortByteString,
    formatBytes, byteStringToBytes
} from "/assets/js/util.js";
import {PieChart} from "/assets/js/components/pie-chart.js";

let counter = async (id, endValue, numIncrements, decimals=0) => {
    let node = document.getElementById(id)

    let valueArray = [...Array(numIncrements).keys()].map((value, index) => {
        return Math.floor(endValue * (Math.sqrt((index+1)/numIncrements)))
    })

    let index = 0;
    let interval = setInterval(() => {
        if (index >= valueArray.length) {
            clearInterval(interval)
        } else {
            node.textContent = int_to_small_format(valueArray[index], decimals)
        }
        index += 1;
    }, 50)
}


/**
 * A node wrapping the project information break down
 */
class ProjectDisplay{
    constructor(parentNode) {
        this.parentNode = parentNode
        this.display_modal = new bootstrap.Modal(parentNode, {
            keyboard: true
        })
        this.parentNode.addEventListener("hidden.bs.modal", () => {
            const url = new URL(window.location.href);
            url.searchParams.delete("repository")
            history.pushState({}, '', url)
        })
    }

    setUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set("repository", this.id)
        history.pushState({}, '', url)
    }

    updateTextValue(className, value){
        [...this.parentNode.getElementsByClassName(className)].forEach(x => {
            x.innerHTML = value;
        });
    }

    updateBigNumberValue(id, value, label = null){
        const node = document.getElementById(id)

        // Check that the data exists
        if (!value) {

            // If you can see the parent
            if (!node.parentNode.parentNode.classList.contains("d-none")) {
                // If the value is empty, hide the parent
                node.parentNode.parentNode.classList.add("d-none")
            }

            return
        }

        // If there is a label swap it
        if (label) {
            node.nextElementSibling.innerText = label
        }

        node.innerText = value
        node.parentNode.parentNode.classList.remove("d-none")

    }

    update({
       description,
       organization,
       dataVisibility,
       size,
       bytesXferd,
       url,
       fieldOfScience,
       numberOfDatasets,
       rank,
       inProgress,
       display,
       name,
       namespace,
       oneYearReads,
       publicObject,
       organizationUrl,
       repositoryUrl,
       id
    }) {
        this.id = id
        this.name = name;
        this.organization = organization;
        this.description = description;
        this.fieldOfScience = fieldOfScience;

        this.updateTextValue("data-name", name);
        this.updateTextValue("data-fieldOfScience", fieldOfScience);
        this.updateTextValue("data-description", description);
        this.updateTextValue("data-organization", organization)

        // If there is a organizationURL then make it a link
        if(organizationUrl) {
            this.updateTextValue("data-organization", `<a href="${organizationUrl}" target="_blank">${organization}</a>`)
        }

        // If there is a dataRepostioryUrl then make it a link
        if(repositoryUrl) {
            this.updateTextValue("data-organization-url", `<a class="btn btn-secondary" href="${repositoryUrl['url']}" target="_blank">${repositoryUrl["label"] || "View Datasets"}</a>`)
        }

        // If there is a publicObject then update those pieces
        document.getElementById("data-public-object").style.display = publicObject ? "block" : "none"
        document.getElementById("data-pelican-download").innerText = `pelican object get osdf://${publicObject} ./`
        document.getElementById("data-browser-download").href = `https://osdf-director.osg-htc.org${publicObject}`

        // Update the big value numbers
        let [readsValue, readsLabel] = formatBytes(oneYearReads, true)?.split(" ") || [null, null]
        if (oneYearReads < 1000000000) {
            readsValue = null
            readsLabel = null
        }
        this.updateBigNumberValue("oneYearReads", readsValue, readsLabel);

        this.updateBigNumberValue("numberOfDatasets", numberOfDatasets?.toLocaleString());

        let [sizeValue, sizeLabel] = formatBytes(size, true)?.split(" ") || [null, null]
        this.updateBigNumberValue("size", sizeValue, sizeLabel);

        // If all the values are empty, hide the parent
        if (!sizeValue && !readsValue && !numberOfDatasets) {
            document.getElementById("oneYearReads").parentNode.parentNode.parentNode.parentNode.classList.add("d-none")
        } else {
            document.getElementById("oneYearReads").parentNode.parentNode.parentNode.parentNode.classList.remove("d-none")
        }


        this.setUrl();
        this.display_modal.show();
    }
}

class Table {
    constructor(wrapper, data_function, updateProjectDisplay){
        this.grid = undefined
        this.data_function = data_function
        this.wrapper = wrapper
        this.updateProjectDisplay = updateProjectDisplay
        this.columns = [
            {
                id: "id",
                name: "ID",
                hidden: true
            },  {
                id: 'name',
                name: 'Name',
                sort: { compare: string_sort },
                formatter: (cell) => gridjs.html(`${cell}<i class="bi bi-box-arrow-up-right ms-2 mb-2"></i>`),
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            }, {
                id: 'organization',
                name: 'Organization',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            },  {
                id: 'fieldOfScience',
                name: 'Field Of Science',
                sort: { compare: string_sort },
                attributes: {
                    className: "gridjs-th gridjs-td pointer gridjs-th-sort text-start"
                }
            },  {
                id: 'organizationUrl',
                name: '',
                formatter: (cell, row, _) => {

                    const id = row["_cells"][0]['data']
                    const data = this.data_function()[id]

                    // If there is a dataRepostioryUrl then make it a link
                    if(data?.["repositoryUrl"]){
                        return gridjs.html(`<a class="btn btn-secondary" href="${data["repositoryUrl"]["url"]}" target="_blank" onclick="event.stopPropagation()">${data["repositoryUrl"]["label"] || "View Datasets"}</a>`)
                    }

                    return gridjs.html(`<a class="btn btn-outline-dark" href="${data["organizationUrl"]}" target="_blank" onclick="event.stopPropagation()">Learn More</a>`)
                },
                sort: false,
                attributes: {
                    className: "m-0"
                },
                width: "124px"
            },
        ]

        let table = this;
        this.grid =  new gridjs.Grid({
            columns: table.columns,
            search: true,
            className: {
                container: "",
                table: "table table-hover",
                td: "pointer",
                paginationButton: "mt-2 mt-sm-0"
            },
            data: () => {


                const order = (d) => {
                    return d?.rank * 100 + !!d?.publicObject * 10 + !!d?.size * 1 + !!d?.oneYearReads * 1 + !!d?.numberOfDatasets * 1
                }

                const data = Object.values(table.data_function())

                return data.sort((a, b) => order(b) - order(a))

            },
            pagination: {
                enabled: true,
                limit: 15
            },
            width: "970px",
            style: {
                td: {
                    'text-align': 'right'
                }
            }
        }).render(table.wrapper);
        this.grid.on('rowClick', this.row_click);
    }
    update = async () => {
        let table = this
        this.grid.updateConfig({
            data: Object.values(table.data_function()).sort((a, b) => b.jobs - a.jobs)
        }).forceRender();
    }
    row_click = async (PointerEvent, e) => {
        let data = await this.data_function()
        let row_name = e["cells"][0].data
        let project = data[row_name]
        this.updateProjectDisplay(project)
    }
}

class DataManager {
    constructor(filters, consumerToggles, errorNode) {
        this.filters = filters ? filters : {}
        this.consumerToggles = consumerToggles ? consumerToggles : []
        this.errorNode = errorNode ? errorNode : document.getElementById("error")
        this.error = undefined
    }

    toggleConsumers = () => {
        this.consumerToggles.forEach(f => f())
    }

    addFilter = (name, filter) => {
        this.filters[name] = filter
        this.toggleConsumers()
    }

    getData = () => {

        let data = {
            
                "Gluex": {
                    
                        
                            description: "\n<p><a href=\"http://www.gluex.org\">GlueX</a> is an experiment at the Thomas Jefferson National Accelerator\nFacility (JLab) in Newport News, Virginia, that studies how particles called mesons behave\nto learn more about the strong force—the force that holds atomic nuclei together. The dataset\nfrom GlueX comes from millions of collisions between high-energy photons and protons.  GlueX\nuses the OSDF to distribute inputs to its data simulations and is exploring using OSDF for\nreprocessing.</p>\n\n<p>GlueX is supported by the US Department of Energy.</p>\n",
                        
                    
                        
                            organization: "Jefferson National Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "GlueX" ,
                        
                    
                        
                            namespace: ["/gluex","/Gluex"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 215894157976 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://www.jlab.org" ,
                        
                    
                        
                            repositoryUrl: {"url":"http://www.gluex.org"} ,
                        
                    
                },
            
                "IceCubePass3": {
                    
                        
                            description: "<p>The <strong>IceCube repository</strong> integrates data from the <a href=\"https://icecube.wisc.edu\"><em>IceCube Neutrino Observatory</em></a>,\na cubic-kilometer detector embedded deep in Antarctic ice near the South Pole. IceCube records when high-energy\nneutrinos interact with the ice.</p>\n\n<p>Using over 5,000 optical sensors deployed between 1,450 and 2,450 meters below the surface, the observatory\ncaptures detailed information about these events, including their timing, location, and intensity. The data\nis used to study cosmic neutrinos and the astrophysical phenomena that produce them, such as <strong>black holes</strong>,\n<strong>supernovae</strong>, and <strong>gamma-ray bursts</strong>.</p>\n\n<p>The IceCube collaboration is supported by <a href=\"https://icecube.wisc.edu/collaboration/funding/\">multiple funding agencies</a> including\nthe <a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=2042807\">NSF</a>.  The dataset is maintained by the\nWisconsin Icecube Particle Astrophysics Center.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 600000000000000 ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: 2 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "IceCubePass3" ,
                        
                    
                        
                            organizationUrl: "https://wipac.wisc.edu/" ,
                        
                    
                        
                            namespace: ["/IceCubePass3"] ,
                        
                    
                        
                            thirtyDayReads: null ,
                        
                    
                        
                            oneYearReads: null ,
                        
                    
                },
            
                "VDC-PUBLIC": {
                    
                        
                            description: "<p>Experiments related to the Virtual Data Collaboratory at the Scientific\nComputing and Imaging Institute at the University of Utah.</p>\n\n<p>These cyberinfrastructure experiments include activities like running automated\nworkflows on the OSPool triggered on alerts from the <a href=\"https://www.earthscope.org/\">EarthScope Consortium</a>.</p>\n",
                        
                    
                        
                            organization: "University of Utah" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Virtual Data Collaboratory" ,
                        
                    
                        
                            namespace: ["/VDC/PUBLIC"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 12609677166 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://www.utah.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://par.nsf.gov/servlets/purl/10187417"} ,
                        
                    
                },
            
                "aws-opendata": {
                    
                        
                            description: "<p><strong><a href=\"https://aws.amazon.com/opendata/\">AWS Open Data</a></strong> hosts\npublicly accessible datasets covering areas such as earth science, climate,\ngenomics, machine learning, transportation, and economics. The collection\nincludes contributions from a range of organizations, including government\nagencies, academic institutions, and private companies.</p>\n\n<p>There are currently nearly <strong>700 datasets</strong>, totaling over <strong>100 petabytes of data</strong>.</p>\n\n<p>Browse the full catalog at the <strong><a href=\"https://registry.opendata.aws\">Registry of Open Data on AWS</a></strong>.</p>\n\n<p>The AWS Open Data datasets are publicly accessible and are integrated with the OSDF, allowing\nusers to stage the data closer to nationally-funded computing resources via the OSDF’s\nhardware infrastructure.  This enables fusion between AWS Open Data and other data sources\naccessible via the OSDF.</p>\n",
                        
                    
                        
                            organization: "Amazon Web Services, Inc." ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies." ,
                        
                    
                        
                            numberOfDatasets: 690 ,
                        
                    
                        
                            rank: 10 ,
                        
                    
                        
                            inprogress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Amazon Web Services Open Data" ,
                        
                    
                        
                            namespace: ["/aws-opendata/us-east-1","/aws-opendata/us-west-1","/aws-opendata/us-west-2"] ,
                        
                    
                        
                            thirtyDayReads: null ,
                        
                    
                        
                            oneYearReads: null ,
                        
                    
                        
                            organizationUrl: "https://aws.amazon.com/opendata/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://registry.opendata.aws/","label":"Dataset Catalog"} ,
                        
                    
                        
                            publicObject: "/aws-opendata/us-east-1/tcga-2-open/01063b4e-5a0d-4f11-8061-f8fd9a5f2fa5/5e3fd2aa-e0dd-4fe8-9944-05bba5d6bd91.FPKM.txt.gz" ,
                        
                    
                },
            
                "caida-protected": {
                    
                        
                            description: "<p>The Center for Applied Internet Data Analysis (CAIDA) runs an “Network Telescope”, collecting\npackets sent to a cross-section of the public Internet similarly to how a telescope collects stray\nlight.</p>\n\n<p>This dataset is made available to scientists attempting to understand how activity, such as malware,\nis moving across the Internet.</p>\n\n<p>The CAIDA integration with OSDF aims to stage the most recent subset of the recorded data to be\nmade available for large-scale analysis.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Center for Applied Internet Data Analysis" ,
                        
                    
                        
                            namespace: ["/caida/protected"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 0 ,
                        
                    
                        
                            organizationUrl: "https://www.caida.org/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://catalog.caida.org/search?query=types=dataset","label":"Dataset Catalog"} ,
                        
                    
                },
            
                "chtc-specialprojects": {
                    
                        
                            description: "<p>Staging data for CHTC collaborations with University of\nWisconsin-Madison research groups. Currently serving data\nspecifically for the Joao Dorea group.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin-Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 78000000000000 ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Agriculture, Agriculture Operations, and Related Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "CHTC Staging for Campus Collaborations" ,
                        
                    
                        
                            namespace: ["/chtc/specialprojects"] ,
                        
                    
                        
                            thirtyDayReads: 5286894039594 ,
                        
                    
                        
                            oneYearReads: 5339965187224643 ,
                        
                    
                        
                            organizationUrl: "https://dorealab.cals.wisc.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":null} ,
                        
                    
                },
            
                "chtc": {
                    
                        
                            description: "<p>The Center for High Throughput Computing (CHTC), established in 2006, aims to\nbring the power of High Throughput Computing to all fields of research, and to\nallow the future of HTC to be shaped by insight from all fields.</p>\n\n<p>Beyond technologies and innovation and HTC through projects like\n<a href=\"https://htcondor.org\">HTCondor</a>, the CHTC operates general purpose clusters for\nthe UW-Madison campus.  CHTC allows researchers to stage their research data\nto an object store connected to the OSDF and then process and analyze the data using\nthe OSDF with on-campus resources or the <a href=\"https://osg-htc.org/ospool\">OSPool</a>.</p>\n\n<p>This data is organized as “working datasets” representing running workloads, not\npermanent scientific outputs.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 445115415442995 ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "CHTC Researcher Data" ,
                        
                    
                        
                            namespace: ["/chtc","/chtc/specialprojects"] ,
                        
                    
                        
                            thirtyDayReads: 118701425179211 ,
                        
                    
                        
                            oneYearReads: 5341756039548910 ,
                        
                    
                        
                            organizationUrl: "https://wisc.edu" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://chtc.cs.wisc.edu/"} ,
                        
                    
                },
            
                "eic": {
                    
                        
                            description: "<p>The Electron-Ion Collider is a proposed facility being built at\nthe Brookhaven National Laboratory.  Experiments at the facility\ninclude the ePIC detector.  The computing for EIC is a joint collaboration\nwith the <a href=\"https://www.jlab.org/eic\">Jefferson National Lab</a>; the datasets\nconnected to the OSDF include input files and other information necessary\nto help with simulations of the detector’s behavior.</p>\n",
                        
                    
                        
                            organization: "Jefferson National Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Electron-Ion Collider Simulations" ,
                        
                    
                        
                            namespace: ["/eic"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 4120 ,
                        
                    
                        
                            organizationUrl: "https://www.jlab.org/eic" ,
                        
                    
                        
                            repositoryUrl: {"url":null} ,
                        
                    
                },
            
                "envistor": {
                    
                        
                            description: "<p>The South Florida region is home to nearly 10 million people, and the population is growing. The region faces several challenges,\nsuch as rising sea levels and flooding, harmful algae blooms, water contamination, and wildlife habit loss, which affects the economy\nand the welfare of its population. Florida International University (FIU) runs the EnviStor project, which is a centrally managed,\npetabyte-scale storage system that is also a clearing house for supporting interdisciplinary research and modeling involving both built\nand natural environments in South Florida. EnviStor provides opportunities for students\nand faculty to enhance their knowledge of database management, focusing on interoperability.</p>\n\n<p>The datasets kept in EnviStor can be accessed via the OSDF; work is ongoing to provide new computing workflows and AI-based dataset\ndiscovery that will help users utilize the data.</p>\n\n<p>The EnviStor activity and underlying storage is funded through the <a href=\"https://www.nsf.gov/funding/opportunities/cc-campus-cyberinfrastructure\">NSF Campus Cyberinfrastructure program</a> under\n<a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=2322308\">Award # 2322308</a>.</p>\n",
                        
                    
                        
                            organization: "Florida International University" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Natural Resources and Conservation" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "EnviStor" ,
                        
                    
                        
                            namespace: ["/envistor"] ,
                        
                    
                        
                            thirtyDayReads: 36 ,
                        
                    
                        
                            oneYearReads: 95684864 ,
                        
                    
                        
                            organizationUrl: "https://www.fiu.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://www.cis.fiu.edu/kfscis-professor-awarded-500000-nsf-grant-for-environment/"} ,
                        
                    
                },
            
                "et-gw-PUBLIC": {
                    
                        
                            description: "<p>Simulation data used for the Einstein Telescope Mock Data Challenge.</p>\n\n<p>The <a href=\"https://www.et-gw.eu/\">Einstein Telescope</a> (ET) is a proposed next-generation gravitational wave\nobservatory, aiming to detect gravitational waves with much higher\nsensitivity than either the LIGO or VIRGO instruments.</p>\n\n<p>As part of the studies and the design proposal for the ET instrument, the\nmock data challenge is being run in 2024 and 2025 to better understand how the future data\nmay be distributed and analyzed.  An example tutorial for using the data can\nbe found <a href=\"https://github.com/elenacuoco/ET-MDC-Tutorials\">on GitHub</a>.</p>\n",
                        
                    
                        
                            organization: "UCLouvain" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 6764573491200 ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 3 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Einstein Telescope Simulations" ,
                        
                    
                        
                            namespace: ["/et-gw/PUBLIC"] ,
                        
                    
                        
                            thirtyDayReads: 16372877593 ,
                        
                    
                        
                            oneYearReads: 359946611774579 ,
                        
                    
                        
                            publicObject: "/et-gw/PUBLIC/MDC1/v2/data/E1/E-E1_STRAIN_DATA-1000008192-2048.gwf" ,
                        
                    
                        
                            organizationUrl: "https://www.uclouvain.be/en" ,
                        
                    
                        
                            repositoryUrl: {"url":"http://et-origin.cism.ucl.ac.be/"} ,
                        
                    
                },
            
                "example": {
                    
                        
                            description: "<p>This is a cool description.</p>\n\n<h1 id=\"screeeeeeeeeam\">Screeeeeeeeeam</h1>\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "fdp-hpe": {
                    
                        
                            description: "<p>The <a href=\"https://github.com/Fusion-Data-Platform/fdp\">Fusion Data Platform</a> (FDP) provides\na modern, Python-based data framework for analyzing data from magnetic fusion experiments.</p>\n\n<p>Using data from the <a href=\"https://www.ga.com/magnetic-fusion/diii-d\">DIII-D National Fusion Facility</a>,\nusers can leverage the FDP software to stream data via the OSDF services for their fusion data\nanalysis.</p>\n\n<p>The FDP is funded by the DOE under award\n<a href=\"https://pamspublic.science.energy.gov/WebPAMSExternal/Interface/Common/ViewPublicAbstract.aspx?rv=5b18d4f7-1f1a-4858-b35a-1040e0f1900a&amp;rtc=24&amp;PRoleId=10\">DE-SC0024426</a>.</p>\n",
                        
                    
                        
                            organization: "General Atomics" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "DII-D National Fusion Facility" ,
                        
                    
                        
                            namespace: ["/fdp-hpe","/nrp/fdp"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 553211044 ,
                        
                    
                        
                            organizationUrl: "https://fdp.readthedocs.io/en/latest/user_guide.html" ,
                        
                    
                        
                            repositoryUrl: {"url":null} ,
                        
                    
                },
            
                "gwdata": {
                    
                        
                            description: "<p>Public gravitational wave data from international gravitational wave network,\nincluding data from <a href=\"https://www.ligo.caltech.edu/\">LIGO</a>, <a href=\"https://www.virgo-gw.eu/\">VIRGO</a>,\nand <a href=\"https://gwcenter.icrr.u-tokyo.ac.jp/en/\">KAGRA</a>.  This data can be used\nin the detection and study of black holes throughout the universe.</p>\n\n<p>These datasets are the calibrated readouts from the corresponding interferometers.\nAlso included are mirrors of data analysis products released to Zenodo to\naccompany publications.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 77032444311984 ,
                        
                    
                        
                            objectCount: 1290210 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 70 ,
                        
                    
                        
                            rank: 3 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Gravitational Wave Open Science Center" ,
                        
                    
                        
                            namespace: ["/gwdata"] ,
                        
                    
                        
                            thirtyDayReads: 58523540450000 ,
                        
                    
                        
                            oneYearReads: 368065653158180 ,
                        
                    
                        
                            publicObject: "/gwdata/zenodo/ligo-virgo-kagra/index.txt" ,
                        
                    
                        
                            organizationUrl: "https://gwosc.org/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "icecube-PUBLIC": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            namespace: ["/icecube/PUBLIC"] ,
                        
                    
                        
                            thirtyDayReads: 138632907277119 ,
                        
                    
                        
                            oneYearReads: 8172086399139906 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "icecube": {
                    
                        
                            description: "<p>The <strong>IceCube repository</strong> integrates data from the <a href=\"https://icecube.wisc.edu\"><em>IceCube Neutrino Observatory</em></a>,\na cubic-kilometer detector embedded deep in Antarctic ice near the South Pole. IceCube records when high-energy\nneutrinos interact with the ice.</p>\n\n<p>Using over 5,000 optical sensors deployed between 1,450 and 2,450 meters below the surface, the observatory\ncaptures detailed information about these events, including their timing, location, and intensity. The data\nis used to study cosmic neutrinos and the astrophysical phenomena that produce them, such as <strong>black holes</strong>,\n<strong>supernovae</strong>, and <strong>gamma-ray bursts</strong>.</p>\n\n<p>The IceCube collaboration is supported by <a href=\"https://icecube.wisc.edu/collaboration/funding/\">multiple funding agencies</a> including\nthe <a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=2042807\">NSF</a>.  The dataset is maintained by the\nWisconsin Icecube Particle Astrophysics Center.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "IceCube Neutrino Data" ,
                        
                    
                        
                            namespace: ["/icecube","/icecube/PUBLIC"] ,
                        
                    
                        
                            thirtyDayReads: 139221399022659 ,
                        
                    
                        
                            oneYearReads: 7727299876651540 ,
                        
                    
                        
                            organizationUrl: "https://wipac.wisc.edu" ,
                        
                    
                },
            
                "igwn-cit": {
                    
                        
                            description: "<p>User-managed data by members of the <a href=\"www.ligo.org\">LIGO Scientific Collaboration</a>, the\n<a href=\"https://www.virgo-gw.eu/\">Virgo Collaboration</a>, and the <a href=\"https://gwcenter.icrr.u-tokyo.ac.jp/en/organization\">KAGRA Collaboration</a>.\nThese data are created and used within individual users’ workflows as they analyze gravitational-wave data in order\nto detect black hole collisions and other cosmic phenomena. This origin is hosted at Caltech.</p>\n\n<p>This data is not public; it is in support of in-progress computational workflows.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 31537610933565 ,
                        
                    
                        
                            objectCount: 469323 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 1581 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Caltech Gravitational Wave Data" ,
                        
                    
                        
                            namespace: ["/igwn/cit"] ,
                        
                    
                        
                            thirtyDayReads: 769728653555870 ,
                        
                    
                        
                            oneYearReads: 17688932216985000 ,
                        
                    
                        
                            organizationUrl: "https://www.ligo.caltech.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "igwn-kagra": {
                    
                        
                            description: "<p>Gravitational wave data collected by the <a href=\"https://www.virgo-gw.eu/\">KAGRA interferometer</a>,\na scientific device for detecting gravitational waves in the Gifu prefecture in Japan.  KAGRA\ncollaborates closely with the LIGO detectors in the US to provide more accurate\ndetection of gravitational waves</p>\n\n<p>This is the data not yet released to the public.</p>\n",
                        
                    
                        
                            organization: "University of Tokyo" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 8246337208320 ,
                        
                    
                        
                            objectCount: 59849 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 2 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "KAGRA Gravitational Wave Data" ,
                        
                    
                        
                            namespace: ["/igwn/kagra"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 449373434362 ,
                        
                    
                        
                            organizationUrl: "https://www.u-tokyo.ac.jp/en/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://gwcenter.icrr.u-tokyo.ac.jp/en"} ,
                        
                    
                },
            
                "igwn-ligo": {
                    
                        
                            description: "<p>Gravitational wave data collected by the <a href=\"https://www.ligo.caltech.edu/page/ligos-ifo\">LIGO interferometer</a>\ndetectors in Hanford, Washington and Livingston, Louisiana and hosted by \n<a href=\"https://www.ligo.caltech.edu/\">LIGO Laboratory</a> at Caltech.  Gravitational wave data is used to detect\nblack hole collisions and other cosmic phenomena and is one piece of the NSF’s multi-messenger astronomy\ninitiatives.</p>\n\n<p>This is the data not yet released to the public.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 138805574893272 ,
                        
                    
                        
                            objectCount: 245785 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 12 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "LIGO Gravitational Wave Data" ,
                        
                    
                        
                            namespace: ["/igwn/ligo","/user/ligo"] ,
                        
                    
                        
                            thirtyDayReads: 3894337423325970 ,
                        
                    
                        
                            oneYearReads: 22558599596480200 ,
                        
                    
                        
                            organizationUrl: "https://www.ligo.caltech.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://www.ligo.caltech.edu"} ,
                        
                    
                },
            
                "igwn-shared": {
                    
                        
                            description: "<p>Curated datasets used by members of the <a href=\"www.ligo.org\">LIGO Scientific Collaboration</a>, the\n<a href=\"https://www.virgo-gw.eu/\">Virgo Collaboration</a>, and the <a href=\"https://gwcenter.icrr.u-tokyo.ac.jp/en/organization\">KAGRA Collaboration</a>\nin the combined analysis of data collected from their detectors. These data consist of gravitational-wave\ndata collected at any of the four interferometers but with simulated signals, as well as some other datasets,\nused for data analysis purposes in detecting black hole collisions and other cosmic phenomena as\npart of the NSF’s multi-messenger astronomy initiatives.</p>\n\n<p>These data are not yet released to the public.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 100695746686856 ,
                        
                    
                        
                            objectCount: 1033379 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 5 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "IGWN Shared Gravitational Wave Data" ,
                        
                    
                        
                            namespace: ["/igwn/shared"] ,
                        
                    
                        
                            thirtyDayReads: 4436999054511 ,
                        
                    
                        
                            oneYearReads: 2668375776814160 ,
                        
                    
                        
                            organizationUrl: "https://www.ligo.caltech.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "igwn-test-write": {
                    
                        
                            description: "<p>This is a test repository utilized by staff of the <a href=\"https://www.ligo.caltech.edu/\">LIGO Laboratory</a> at\nCaltech to test new versions ofthe <a href=\"https://pelicanplatform.org/\">Pelican</a> software and configuration, to ensure that upcoming changes\ndo not disrupt ongoing data analysis on any of the production origins. This test origin specifically\ntests the software and configuration of user-managed data analogous to that served in /igwn/cit.</p>\n\n<p>This data is private.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 443967241 ,
                        
                    
                        
                            objectCount: 47 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 2 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "IGWN Write Test" ,
                        
                    
                        
                            namespace: ["/igwn/test-write"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 468 ,
                        
                    
                        
                            organizationUrl: "https://www.ligo.caltech.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "igwn-test": {
                    
                        
                            description: "<p>This is a test namespace utilized by staff of the <a href=\"https://www.ligo.caltech.edu/\">LIGO Laboratory</a> at\nCaltech to test new versions of <a href=\"https://pelicanplatform.org/\">Pelican</a> software and configuration, to ensure that upcoming changes\ndo not disrupt ongoing data analysis on any of the production origins.</p>\n\n<p>This data is private.</p>\n",
                        
                    
                        
                            organization: "California Institute of Technology" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 15322207341 ,
                        
                    
                        
                            objectCount: 1066 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 2 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "IGWN Read Test" ,
                        
                    
                        
                            namespace: ["/igwn/test"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 2101389 ,
                        
                    
                        
                            organizationUrl: "https://www.ligo.caltech.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "igwn-virgo": {
                    
                        
                            description: "<p>Gravitational wave data collected by the <a href=\"https://www.virgo-gw.eu/\">VIRGO interferometer</a>,\na scientific device for detecting gravitational waves near Pisa, Italy.  VIRGO\ncollaborates closely with the LIGO detectors in the US to provide more accurate\ndetection of gravitational waves</p>\n\n<p>This is the data not yet released to the public.</p>\n",
                        
                    
                        
                            organization: "European Gravitational Observatory" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 16106127360000 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 10 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "VIRGO Gravitational Wave Data" ,
                        
                    
                        
                            namespace: ["/igwn/virgo"] ,
                        
                    
                        
                            thirtyDayReads: 269563925490601 ,
                        
                    
                        
                            oneYearReads: 3046944641469200 ,
                        
                    
                        
                            organizationUrl: "https://www.ego-gw.it/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://www.virgo-gw.eu"} ,
                        
                    
                },
            
                "jkb-lab-public": {
                    
                        
                            description: "<p>Jessica Kendall-Bar leads a research group that integrates engineering, data science, ecology, and\nvisual storytelling/public communication to explore the behavior and physiology of marine life.</p>\n\n<p>Her visual data work has appeared in various media platforms—from UC San Diego news to national outlets\nlike The New York Times and The Atlantic—and has contributed to global policy efforts in areas such as\nmarine mammal protection and coral reef recovery.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: "https://www.jessiekb.com/" ,
                        
                    
                        
                            fieldOfScience: "MULTI/INTERDISCIPLINARY STUDIES" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "Jessica Kendall-Bar Lab" ,
                        
                    
                        
                            namespace: ["/jkb-lab-public"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 130362 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://www.jessiekb.com/" ,
                        
                    
                },
            
                "jkb-lab": {
                    
                        
                            description: "<p>Jessica Kendall-Bar leads a research group that integrates engineering, data science, and ecology\nto explore the behavior and physiology of marine life.  The data stored on the OSDF includes high-resolution\nmultimodal data such as video, GPS, and electrophysiology.</p>\n\n<p>The OSDF data is catalogued on the <a href=\"https://nationaldataplatform.org/\">National Data Platform</a>, enabling\ntextual, conceptual, and map-based spatiotemporal search capabilities.</p>\n\n<p>The NDP project is using this dataset as inputs for a data challenge planned for Fall 2025.  It also\npowers an application running on the <a href=\"https://nationalresearchplatform.org/\">National Research Platform</a>\nat <a href=\"https://lifeinthedeep.nrp-nautilus.io/\">https://lifeinthedeep.nrp-nautilus.io/</a>.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 5497558138880 ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Biological and Biomedical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Jessica Kendall-Bar Lab" ,
                        
                    
                        
                            namespace: ["/jkb-lab","/jkb-lab-public"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 1266 ,
                        
                    
                        
                            organizationUrl: "https://ucsd.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://nationaldataplatform.org/ckandata","label":"Dataset Catalog"} ,
                        
                    
                },
            
                "jlab-osdf": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/jlab-osdf"] ,
                        
                    
                        
                            thirtyDayReads: 48830444442602 ,
                        
                    
                        
                            oneYearReads: 50865203251663 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "jlab": {
                    
                        
                            description: "<p>The Jefferson National Laboratory (JLab) operates particle accelerator\nfacilities and associated detectors for experiments like\n<a href=\"https://www.gluex.org/\">GlueX</a>.</p>\n\n<p>JLab connects its storage to the OSDF to allow large-scale data simulation\nand reprocessing on the PATh-operated <a href=\"https://osg-htc.org/services/ospool/\">OSPool resources</a> and JLab-provided\ncapacity.</p>\n",
                        
                    
                        
                            organization: "Jefferson National Laboratory" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "JLab Simulation Datasets" ,
                        
                    
                        
                            namespace: ["/jlab"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 578041482718610 ,
                        
                    
                        
                            organizationUrl: "https://www.jlab.org/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "kennesaw-priv": {
                    
                        
                            description: "<p>This repository enables faculty and students at Kennesaw State University to use their\n<a href=\"https://www.nsf.gov/funding/opportunities/cc-campus-cyberinfrastructure\">NSF Campus Cyberinfrastructure (CC*)</a>\nfunded <a href=\"https://www.kennesaw.edu/research/centers-facilities/center-research-computing/nsf-campus-cyberinfrastructure/data-storage-project.php\">storage</a> (<a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=2430289&amp;HistoricalAwards=false\">Award #2430289</a>)\nwith their local HPC cluster via OSDF.</p>\n",
                        
                    
                        
                            organization: "Kennesaw State University" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Kennesaw State University CC* Storage" ,
                        
                    
                        
                            namespace: ["/kennesaw-priv","/kennesaw"] ,
                        
                    
                        
                            thirtyDayReads: 46 ,
                        
                    
                        
                            oneYearReads: 7708 ,
                        
                    
                        
                            organizationUrl: "https://www.kennesaw.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "kennesaw": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/kennesaw"] ,
                        
                    
                        
                            thirtyDayReads: 1322040 ,
                        
                    
                        
                            oneYearReads: 1322040 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "knightlab": {
                    
                        
                            description: "<p>The Knight Lab uses and develops state-of-the-art computational and experimental\ntechniques to ask fundamental questions about the evolution of the composition of biomolecules,\ngenomes, and communities in different ecosystems, including the complex microbial ecosystems of the human body.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Biological and Biomedical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "UCSD Knight Lab" ,
                        
                    
                        
                            namespace: ["/knightlab"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 258218216565 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://knightlab.ucsd.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "mals": {
                    
                        
                            description: "<p>The MeerKAT Absorption Line Survey (MALS) consists of 1,655 hours of observatory time on the\n<a href=\"https://www.sarao.ac.za/science/meerkat/about-meerkat/\">MeerKAT</a> radio telescope at the South\nAfrican Radio Astronomy Observatory.  The survey aims\nto carry out the most sensitive search of HI and OH absorption lines at 0&lt;z&lt;2,\nthe redshift range over which most of the cosmic evolution in the star formation rate density takes place.</p>\n\n<p>The MALS dataset is replicated to the OSDF to allow collaborators at the <a href=\"https://public.nrao.edu/\">NRAO</a>\nparticipate in the scientific study of the data.</p>\n",
                        
                    
                        
                            organization: "Inter-University Centre for Astronomy and Astrophysics" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 250000000000000 ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "MeerKAT Absorption Line Survey (MALS)" ,
                        
                    
                        
                            namespace: ["/mals"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 0 ,
                        
                    
                        
                            publicObject: "/mals/mals-release.tar.gz" ,
                        
                    
                        
                            organizationUrl: "https://www.iucaa.in/en/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://mals.iucaa.in/"} ,
                        
                    
                },
            
                "mo": {
                    
                        
                            description: "<p>General namespace for University of Missouri OSStore contribution.</p>\n",
                        
                    
                        
                            organization: "University of Missouri" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "University of Missouri OSStore" ,
                        
                    
                        
                            namespace: ["/mo"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 0 ,
                        
                    
                        
                            organizationUrl: "https://missouri.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                        
                            publicObject: "/mo/ftp.bbso.njit.edu" ,
                        
                    
                },
            
                "mu-ahurt-public": {
                    
                        
                            description: "<p>Research in machine learning methods like deep learning neural networks,\ncomputer vision and morphological neural networks.</p>\n",
                        
                    
                        
                            organization: "University of Missouri" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Alex Hurt Lab" ,
                        
                    
                        
                            namespace: ["/mu/ahurt/public"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 970306300 ,
                        
                    
                        
                            organizationUrl: "https://missouri.edu" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://engineering.missouri.edu/faculty/j-alex-hurt/"} ,
                        
                    
                        
                            publicObject: "/mu/ahurt/public/DOTA/train_chipped512/dmp_vis.tar.gz" ,
                        
                    
                },
            
                "nasa-nsdf-climate1": {
                    
                        
                            description: "<p>The <a href=\"https://ecco-group.org/world-of-ecco.htm\">LLC4320 ocean dataset</a> is\nthe product of a 14-month simulation of ocean circulation and dynamics\nusing the Massachusetts Institute of Technology’s General Circulation\nModel on a lat-lon-cap grid. Comprising extensive scalar data such as\ntemperature, salinity, heat flux, radiation, and velocity, the dataset\nexceeds 4 PB and can potentially improve our understanding of global ocean\ncirculation and its role in Earth’s climate system.</p>\n\n<p>In order to make this dataset more accessible and easier to visualize, the\n<a href=\"https://nationalsciencedatafabric.org/\">National Science Data Fabric</a> has\nprocessed the raw data into the <a href=\"https://visus.org/\">ViSUS</a> data format\nusing their <a href=\"https://github.com/sci-visus/OpenVisus\">OpenViSUS</a> toolsuite.</p>\n\n<p>It will be used in the\n<a href=\"https://sciviscontest2026.github.io/\">2026 IEEE SciVis Contest</a> to\ndemonstrate cutting-edge technologies for working with petascale climate\ndata provided by NASA.</p>\n",
                        
                    
                        
                            organization: "University of Utah" ,
                        
                    
                        
                            organizationUrl: "https://www.utah.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://data.nas.nasa.gov/ecco/"} ,
                        
                    
                        
                            fieldOfScience: "Atmospheric Sciences and Meteorology" ,
                        
                    
                        
                            numberOfDatasets: 1 ,
                        
                    
                        
                            name: "OpenViSUS Conversion of NASA's ECCO Project's 1/48° MITgcm Simulation" ,
                        
                    
                        
                            namespace: ["/nasa/nsdf/climate1","/nasa/nsdf/climate2"] ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            publicObject: "/nasa/nsdf/climate1/llc4320/idx/salt/salt_llc4320_x_y_depth.idx" ,
                        
                    
                        
                            size: 957279078711296 ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            thirtyDayReads: 45098988340 ,
                        
                    
                        
                            oneYearReads: 864388563354 ,
                        
                    
                },
            
                "nasa-nsdf-climate3": {
                    
                        
                            description: "<p>The <a href=\"https://data.nas.nasa.gov/geoseccoviz/geoseccovizdata/c1440_llc2160/GEOS/\">NASA C1440-LLC2160 dataset</a>\nis <a href=\"https://www.nas.nasa.gov/SC21/research/project16.html\">the simulation output from research into coupling two models</a>:\na global atmospheric model and a global ocean model that were originally\ndesigned to be run separately. The atmospheric model is a C1440\nconfiguration of the Goddard Earth Observing System (GEOS) atmospheric\nmodel running on a cubed-sphere grid. The global ocean model is an LLC2160\nconfiguration of the MITgcm model that uses a latlon-cap grid. Each model\nwas run for over 10000 hourly timesteps covering over 14 simulation\nmonths. With more than 10000 time steps and multiple scalar fields, it\ntotals approximately 1.8 PB.</p>\n\n<p>In order to make this dataset more accessible and easier to visualize, the\n<a href=\"https://nationalsciencedatafabric.org/\">National Science Data Fabric</a> has\nprocessed the raw data into the <a href=\"https://visus.org/\">ViSUS</a> data format\nusing their <a href=\"https://github.com/sci-visus/OpenVisus\">OpenViSUS</a> toolsuite.</p>\n\n<p>It will be used in the\n<a href=\"https://sciviscontest2026.github.io/\">2026 IEEE SciVis Contest</a> to\ndemonstrate cutting-edge technologies for working with petascale climate\ndata provided by NASA.</p>\n",
                        
                    
                        
                            organization: "University of Utah" ,
                        
                    
                        
                            organizationUrl: "https://nationalsciencedatafabric.org/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://data.nas.nasa.gov/geoseccoviz/"} ,
                        
                    
                        
                            fieldOfScience: "Atmospheric Sciences and Meteorology" ,
                        
                    
                        
                            numberOfDatasets: 1 ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            publicObject: "/nasa/nsdf/climate3/dyamond/GEOS/GEOS_CO2/co2_face_2_depth_52_time_0_10269.idx" ,
                        
                    
                        
                            size: 719098913751040 ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            name: "OpenViSUS Conversion of NASA's C1440-LLC2160 Simulation" ,
                        
                    
                        
                            namespace: ["/nasa/nsdf/climate3"] ,
                        
                    
                        
                            thirtyDayReads: 472358547 ,
                        
                    
                        
                            oneYearReads: 472358547 ,
                        
                    
                },
            
                "ncar": {
                    
                        
                            description: "<p><a href=\"https://ncar.ucar.edu/\">NCAR</a> provides a wide range of atmospheric and Earth system science datasets,\nincluding observational data from airborne and ground-based instruments, outputs from community weather\nmodels, and large-scale reanalysis and simulation data. These datasets support research on weather patterns,\nthe water cycle, and extreme weather events. They are used by researchers, educators, and policymakers\nacross the US.</p>\n\n<p>Integrated with the OSDF is NCAR’s Research Data Archive (RDA), the centrally managed archive of the laboratory’s\natmospheric and Earth system datasets.  When downloading data from the web interface, users are automatically\nredirected to the OSDF cyberinfrastructure.</p>\n\n<p>Example notebooks that analyze data from these datasets can be found in the <a href=\"https://github.com/NCAR/osdf_examples\">NCAR OSDF Examples repository</a> and are part of the <a href=\"https://rda.ucar.edu/resources/ndcc-osdf/\">NCAR effort to utilize the OSDF</a>.</p>\n\n<h3 id=\"visualizations\">Visualizations</h3>\n<p><em>Visualization of climate data over South America on October 10, 2020, using NCAR datasets.</em></p>\n\n<p><img src=\"https://raw.githubusercontent.com/osg-htc/osg-htc.github.io/master/assets/images/South_American_Climate.png\" width=\"600\" height=\"400\" alt=\"Climate over South America on October 10, 2020\" /></p>\n\n<p><br /></p>\n\n<p><em>Visualization of ocean temperature on January 16, 2014.</em></p>\n\n<p><img src=\"https://raw.githubusercontent.com/osg-htc/osg-htc.github.io/master/assets/images/Ocean_Heat.png\" width=\"600\" height=\"400\" alt=\"Ocean heat on January 16, 2014\" /></p>\n\n<p>The integration between NCAR and OSDF is part of the <a href=\"https://ndc-pathfinders.org\">Pathfinders collaboration</a>,\na collaboration between five initiatives aimed at developing science-led pathways through the NSF cyberinfrastructure\nlandscape. This work is funded by NSF award <a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=1852977\">1852977</a>.</p>\n",
                        
                    
                        
                            organization: "NSF National Center for Atmospheric Research" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 2 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "NCAR Research Data Archive" ,
                        
                    
                        
                            namespace: ["/ncar","/ncar-rda"] ,
                        
                    
                        
                            thirtyDayReads: 218481971416683 ,
                        
                    
                        
                            oneYearReads: 264353361185352 ,
                        
                    
                        
                            organizationUrl: "https://ncar.ucar.edu" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://rda.ucar.edu","label":"Dataset Catalog"} ,
                        
                    
                        
                            publicObject: "/ncar/rda/d208000/index.html" ,
                        
                    
                },
            
                "ndp-burnpro3d-auth": {
                    
                        
                            description: "<p>A century of suppressing wildfires has created a dangerous accumulation of flammable vegetation on landscapes,\ncontributing to megafires that risk human life and destroy ecosystems. Prescribed burns can dramatically reduce\nthe risk of large fires that are uncontrollable by decreasing this buildup of fuels. BurnPro3D is a science-driven,\ndecision-support platform to help the fire management community understand risks and tradeoffs quickly and\naccurately when planning and conducting prescribed burns.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Natural Resources and Conservation" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: true ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "BurnPro3D" ,
                        
                    
                        
                            namespace: ["/ndp/burnpro3d-auth"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 9213605566 ,
                        
                    
                        
                            organizationUrl: "https://wifire.ucsd.edu/burnpro3d" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://wifire-data.sdsc.edu/dataset","label":"Dataset Catalog"} ,
                        
                    
                },
            
                "ndp-burnpro3d": {
                    
                        
                            description: "<p>A century of suppressing wildfires has created a dangerous accumulation of flammable vegetation on landscapes,\ncontributing to megafires that risk human life and destroy ecosystems. Prescribed burns can dramatically reduce\nthe risk of large fires that are uncontrollable by decreasing this buildup of fuels. BurnPro3D is a science-driven,\ndecision-support platform to help the fire management community understand risks and tradeoffs quickly and\naccurately when planning and conducting prescribed burns.</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Natural Resources and Conservation" ,
                        
                    
                        
                            numberOfDatasets: 1 ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "BurnPro3D" ,
                        
                    
                        
                            namespace: ["/ndp/burnpro3d"] ,
                        
                    
                        
                            thirtyDayReads: 316964599 ,
                        
                    
                        
                            oneYearReads: 9337358188 ,
                        
                    
                        
                            publicObject: "/ndp/burnpro3d/YosemiteBurnExample/burnpro3d-yosemite-example.csv" ,
                        
                    
                        
                            organizationUrl: "https://wifire.ucsd.edu/burnpro3d" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://wifire-data.sdsc.edu/dataset","label":"Dataset Catalog"} ,
                        
                    
                },
            
                "noaa-fisheries": {
                    
                        
                            description: "<p>NOAA collects and uses active acoustic (or sonar) data for a variety of\nmapping requirements. Water column sonar data focus on the area from near\nthe surface of the ocean to the seafloor. Primary uses of these specific\nsonar data include 3-D mapping of fish schools and other mid-water marine\norganisms; assessing biological abundance; species identification; and\nhabitat characterization. Other uses include mapping underwater gas seeps\nand remotely monitoring undersea oil spills. NCEI archives water column\nsonar data collected by NOAA line offices, academia, industry, and\ninternational institutions.</p>\n",
                        
                    
                        
                            organization: "National Oceanic and Atmospheric Administration" ,
                        
                    
                        
                            organizationUrl: "https://www.noaa.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://www.ncei.noaa.gov/products/water-column-sonar-data"} ,
                        
                    
                        
                            fieldOfScience: "Fishing and Fisheries Sciences and Management" ,
                        
                    
                        
                            numberOfDatasets: 1 ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            publicObject: "/noaa/fisheries-1/noaa-wcsd-pds/data/raw/Henry_B._Bigelow/HB2403/README_HB2403_EK80.md" ,
                        
                    
                        
                            size: 331978855304407 ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            name: "NCEI Water Column Sonar Data" ,
                        
                    
                        
                            namespace: ["/noaa/fisheries-1","/noaa/fisheries-2"] ,
                        
                    
                        
                            thirtyDayReads: null ,
                        
                    
                        
                            oneYearReads: null ,
                        
                    
                },
            
                "nrao-ardg": {
                    
                        
                            description: "<p>Radio astronomy data from the Very Large Array Sky Survey (VLASS).</p>\n\n<p>As written in the <a href=\"https://public.nrao.edu/vlass/\">VLASS homepage</a>,\nVLASS is a survey of the universe through the use of the Very Large\nArray (VLA) in New Mexico. The VLA is one of the most sensitive telescopes\nin the radio band that can provide more sensitive images of the universe\nthan any other radio telescope in the world. This, however, requires processing\nlarge volumes of data and super-computer class computing\nresources. The VLASS is designed to produce a large collection\nof radio data available to wide range of scientists within the astronomical\ncommunity. VLASS’s science goal is to produce a radio, all-sky survey that\nwill benefit the entire astronomical community. As VLASS completes its three\nscans of the sky separated by approximately 32 months, new developments in\ndata processing techniques will allow scientists an opportunity to download data\ninstantly on potentially millions of astronomical radio sources.</p>\n\n<p>The data in this data origin consists of interferometric visibilities stored in \n(<a href=\"https://casa.nrao.edu/Memos/229.html\">Measurement Set (MS)</a>) format. Each\ndataset contains calibrated visibilities for one of the sixteen spectral windows\nof the VLA and covers an area of 4 square degrees (2 degrees x 2 degrees) in the\nsky. All sixteen spectral windows are combined to generate a single image, so that\nthe data contained in this data origin can be used to make images of approximately \n70 regions in the sky, each image covering 4 square degrees. The <a href=\"https://github.com/ARDG-NRAO/LibRA\">LibRA software\npackage</a> is used to transform visibilities to\nimages. The architecture and design considerations for LibRA are shown in <a href=\"https://www.aoc.nrao.edu/~sbhatnag/Talks/For_BrianB.pdf\">this\npresentation</a>.</p>\n\n<p>Teams of scientists at the <a href=\"http://www.nrao.edu\">National Radio Astronomy Observatory\n(NRAO)</a>, Socorro, NM and the Center for High Throughput Computing\n(CHTC) have used the PATh and NRP facilities of the OSG to make the\ndeepest image in the radio band of the Hubble Ultra-deep Field\n(HUDF).  Similarly, the COSMOS HI Large Extra Galactic Survey\n(CHILES)[http://chiles.astro.columbia.edu/] project has 1000 hr of integration with the VLA on the\nCOSMOS field. Imaging the CHILES data using PATh and NRP facilities\ndelivered the deepest radio image of this region of the sky, at an\nunmatched data processing throughput. Similarly to the VLASS data stored in this\ndata origin, the data for HUDF and CHILES is stored in the PATh facility data origin.\nThese recent large scale imaging achievements that were made possible through\nuse of OSG resources are reported in this [NRAO Newsletter article]\n(https://science.nrao.edu/enews/17.3/index.shtml#deepimaging) and <a href=\"https://public.nrao.edu/news/astronomers-study-the-universe-300-times-faster/\">this press\nrelease</a>.</p>\n",
                        
                    
                        
                            organization: "National Radio Astronomy Observatory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 4068193022771 ,
                        
                    
                        
                            objectCount: 36068 ,
                        
                    
                        
                            fieldOfScience: "Astronomy and Astrophysics" ,
                        
                    
                        
                            numberOfDatasets: 15962 ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "NRAO VLASS" ,
                        
                    
                        
                            namespace: ["/nrao-ardg"] ,
                        
                    
                        
                            thirtyDayReads: 16440925390027 ,
                        
                    
                        
                            oneYearReads: 280427321936701 ,
                        
                    
                        
                            organizationUrl: "https://public.nrao.edu/vlass/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                        
                            publicObject: "/nrao-ardg/fmadsen/vlass-32PIMS/data/T23t17/J161533+503000/VLASS2.1.sb38528342.eb38565674.59072.03519471065_split_SPW0.ms.tgz" ,
                        
                    
                },
            
                "nrp-cachetest": {
                    
                        
                            description: "<p>Namespace used by Fabio for ongoing CheckMK testing of NRP caches</p>\n",
                        
                    
                        
                            organization: "University of California, San Diego" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "CheckMK Probe Namespace" ,
                        
                    
                        
                            namespace: ["/nrp/cachetest"] ,
                        
                    
                        
                            thirtyDayReads: 854213001500 ,
                        
                    
                        
                            oneYearReads: 2395013261465260 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "nrp-osdf": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/nrp/osdf"] ,
                        
                    
                        
                            thirtyDayReads: 65536 ,
                        
                    
                        
                            oneYearReads: 1475164654373560 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "nrp-protected-xenon-biggrid-nl": {
                    
                        
                            description: "<p>The <a href=\"https://xenonexperiment.org/\">XENON Dark Matter Project</a> is a scientific\ncollaboration organized around the XENONnT dark matter detector at the INFN\n<a href=\"https://www.lngs.infn.it/en/lngs-overview\">Gran Sasso National Laboratory</a> in\nGran Sasso, Italy.</p>\n\n<p>This repository is used to store data and simulations from the XENONnT experiment\nto aid in its computing workloads.</p>\n",
                        
                    
                        
                            organization: "University of Chicago" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "XENONnT Dark Matter" ,
                        
                    
                        
                            namespace: ["/nrp/protected/xenon-biggrid-nl/"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 152114667948168 ,
                        
                    
                        
                            organizationUrl: "https://www.uchicago.edu/en" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://xenonexperiment.org/"} ,
                        
                    
                },
            
                "nrp-sio": {
                    
                        
                            description: "<p>Scripps Institution of Oceanography scientists conduct fundamental research to\nunderstand and protect the planet, and investigate our oceans, Earth, and atmosphere\nto find solutions to our greatest environmental challenges.</p>\n",
                        
                    
                        
                            organization: "Scripps Institute of Oceanography" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Biological and Biomedical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Scripps Institute of Oceanography" ,
                        
                    
                        
                            namespace: ["/nrp/sio"] ,
                        
                    
                        
                            thirtyDayReads: 38384294620 ,
                        
                    
                        
                            oneYearReads: 38428297113 ,
                        
                    
                        
                            organizationUrl: "https://scripps.ucsd.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "nsdf": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: "Morgridge Institute for Research" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: "https://morgridge.org/research/research-computing/" ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/nsdf"] ,
                        
                    
                        
                            thirtyDayReads: 5692199277 ,
                        
                    
                        
                            oneYearReads: 51536059619 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://morgridge.org/research/research-computing/" ,
                        
                    
                },
            
                "osdf-tutorial": {
                    
                        
                            description: "<p>Datasets for use in OSDF usage tutorials by <a href=\"https://pelicanplatform.org\">Pelican Platform</a> facilitation team.</p>\n\n<p>This repository supports the education and workforce development mission of the\nPelican Project.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 2416 ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "OSDF Tutorial Data" ,
                        
                    
                        
                            namespace: ["/osdf-tutorial"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 62261 ,
                        
                    
                        
                            organizationUrl: "https://wisc.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://github.com/osg-htc/tutorial-osdf-noaa/blob/main/01-get-and-share-objects.ipynb"} ,
                        
                    
                },
            
                "osn-sdsc": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/osn-sdsc"] ,
                        
                    
                        
                            thirtyDayReads: 67371008 ,
                        
                    
                        
                            oneYearReads: 373263780714960 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "ospool-ap20-ap21": {
                    
                        
                            description: "<p>Staging area for <a href=\"https://path-cc.io/\">PATh</a>-operated Access Points located at the University of Chicago.</p>\n\n<p>The PATh project allows researcher teams to stage their research data\nto an object store connected to the OSDF and then process and analyze the data using\nthe OSDF via the <a href=\"https://osg-htc.org/ospool\">OSPool</a>.  Any US-based open science team\ncan utilize the PATh services for distributed High Throughput Computing workflows.</p>\n\n<p>This data is organized as “working datasets” representing running workloads, not\npermanent scientific outputs.</p>\n",
                        
                    
                        
                            organization: "University of Chicago" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 39000000000000 ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "OSPool AP Working Data" ,
                        
                    
                        
                            namespace: ["/ospool/ap20","/ospool/ap21"] ,
                        
                    
                        
                            thirtyDayReads: 2700344994763630 ,
                        
                    
                        
                            oneYearReads: 44089309792954600 ,
                        
                    
                        
                            organizationUrl: "https://www.uchicago.edu/en" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://osg-htc.org/services/ospool/"} ,
                        
                    
                },
            
                "ospool-ap22": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/ospool/ap22"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 91406519414 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "ospool-ap40-data": {
                    
                        
                            description: "<p>Staging area for <a href=\"https://path-cc.io/\">PATh</a>-operated Access Points located at the University of Wisconsin-Madison.</p>\n\n<p>The PATh project allows researcher teams to stage their research data\nto an object store connected to the OSDF and then process and analyze the data using\nthe OSDF via the <a href=\"https://osg-htc.org/ospool\">OSPool</a>.  Any US-based open science team\ncan utilize the PATh services for distributed High Throughput Computing workflows.</p>\n\n<p>This data is organized as “working datasets” representing running workloads, not\npermanent scientific outputs.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 7460424841729 ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: "https://osg-htc.org/services/ospool/" ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "OSPool AP Working Data" ,
                        
                    
                        
                            namespace: ["/ospool/ap40/data"] ,
                        
                    
                        
                            thirtyDayReads: 1529524963342780 ,
                        
                    
                        
                            oneYearReads: 11140957788277200 ,
                        
                    
                        
                            organizationUrl: "https://www.wisc.edu/" ,
                        
                    
                },
            
                "ospool-uc-shared-project": {
                    
                        
                            description: "<p>Staging area for <a href=\"https://path-cc.io/\">PATh</a>-operated collaboration services located at the University of Chicago.</p>\n\n<p>The PATh project allows multi-institutional collaborations to stage their experimental data\nand simulation outputs to an object store connected to the OSDF and then process and analyze the data using\nthe OSDF via the <a href=\"https://osg-htc.org/ospool\">OSPool</a> or other capacity dedicated to their\nexperiment.</p>\n\n<p>This data is organized as “working datasets” representing running workloads, not\npermanent scientific outputs.</p>\n",
                        
                    
                        
                            organization: "University of Chicago" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 193000000000000 ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "PATh Collaboration Services" ,
                        
                    
                        
                            namespace: ["/ospool/uc-shared/project","/ospool/uc-shared/public"] ,
                        
                    
                        
                            thirtyDayReads: 21723475821543 ,
                        
                    
                        
                            oneYearReads: 6775986102458060 ,
                        
                    
                        
                            organizationUrl: "https://www.uchicago.edu/en" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://osg-htc.org/collaboration-support/"} ,
                        
                    
                        
                            publicObject: "/ospool/uc-shared/public/eht/GRMHD_kharma-v3/Ma+0.94_w5/torus.out0.05986.h5" ,
                        
                    
                },
            
                "ospool-uc-shared-public": {
                    
                        
                            description: "<p>Data staging area for OSPool projects with public data</p>\n",
                        
                    
                        
                            organization: "University of Chicago" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 10600000000000 ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: "https://osg-htc.org/services/ospool/" ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "OSPool Public Staging" ,
                        
                    
                        
                            namespace: ["/ospool/uc-shared/public"] ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            thirtyDayReads: 1325265802131560 ,
                        
                    
                        
                            oneYearReads: 2426417531645050 ,
                        
                    
                        
                            organizationUrl: "https://osg-htc.org/services/ospool/" ,
                        
                    
                },
            
                "path-facility-data": {
                    
                        
                            description: "<p>Staging area for data used in the <a href=\"https://path-cc.io/facility/index.html\">PATh Facility</a>.\nThe PATh Facility is a distributed computing resource spanning 5 sites, from San Diego, California\nto Syracuse, New York, that provides NSF-funded researches with compute credits for High Throughput\nComputing workflows.</p>\n\n<p>This repository enables these NSF projects to stage their research data\noutputs to an object store connected to the OSDF and then process and analyze the data using\nthe OSDF via both the PATh Facility computing hardware and the <a href=\"https://osg-htc.org/ospool\">OSPool</a>.</p>\n\n<p>This data is organized as “working datasets” representing active workloads from researchers, not\npermanent scientific outputs.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 13958398725 ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "PATh Facility Researcher Data" ,
                        
                    
                        
                            namespace: ["/path-facility/data"] ,
                        
                    
                        
                            thirtyDayReads: 7134824038133 ,
                        
                    
                        
                            oneYearReads: 1241810445184950 ,
                        
                    
                        
                            organizationUrl: "https://wisc.edu/" ,
                        
                    
                },
            
                "path-facility-projects": {
                    
                        
                            description: "<p>Special projects data in the PATh facility.</p>\n\n<p>To avoid redundancy, focus on <code class=\"language-plaintext highlighter-rouge\">/path-facility/data</code> instead.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin - Madison" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 71762120 ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            namespace: ["/path-facility/projects"] ,
                        
                    
                        
                            thirtyDayReads: 29523415051 ,
                        
                    
                        
                            oneYearReads: 681346253116 ,
                        
                    
                        
                            organizationUrl: "https://wisc.edu" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "pelican-monitoring": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            namespace: ["/pelican/monitoring"] ,
                        
                    
                        
                            thirtyDayReads: 483963111 ,
                        
                    
                        
                            oneYearReads: 6313498957 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "pelicanfacilitation": {
                    
                        
                            description: "<p>A namespace for the <a href=\"https://pelicanplatform.org/\">Pelican Platform</a> facilitation team to use for a variety of facilitation purposes.</p>\n",
                        
                    
                        
                            organization: "University of Wisconsin-Madison" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "Pelican Facilitation Test Data" ,
                        
                    
                        
                            namespace: ["/pelicanfacilitation"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 0 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://wisc.edu" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                        
                            publicObjectUrl: null ,
                        
                    
                },
            
                "pelicanplatform": {
                    
                        
                            description: "<p>Testing and Validation Origin</p>\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            size: 8132 ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: "https://pelicanplatform.org" ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            namespace: ["/pelicanplatform"] ,
                        
                    
                        
                            thirtyDayReads: 61976849721 ,
                        
                    
                        
                            oneYearReads: 9200333527280 ,
                        
                    
                        
                            organizationUrl: "https://pelicanplatform.org" ,
                        
                    
                },
            
                "pnfs-fnalgov-des": {
                    
                        
                            description: "<p>The Dark Energy Survey (DES) will probe the origin of the accelerating universe and help uncover the nature of dark energy\nby measuring the 14-billion-year history of cosmic expansion with high precision. A 570M-pix camera, the DECam, is being\nbuilt for this project and  comprehensive tests were successfully accomplished at Fermilab’s telescope simulator (pictured above).\nAs we countdown to DECam’s first light, workload and excitement increase among our collaborators. Starting in late 2011 and\ncontinuing for five years, DES will survey a large swath of the southern sky out to vast distances in order to provide new clues\nto this most fundamental of questions.</p>\n\n<p>DES uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 136000000000 ,
                        
                    
                        
                            objectCount: 36656 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Dark Energy Survey" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/des"] ,
                        
                    
                        
                            thirtyDayReads: null ,
                        
                    
                        
                            oneYearReads: null ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/des/persistent/stash/gw/ALLWISE_AGN/allwiseagn_v1_082022.dat" ,
                        
                    
                        
                            organizationUrl: "https://www.fnal.gov" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://astro.fnal.gov/the-des-project/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-dune": {
                    
                        
                            description: "<p>The Deep Underground Neutrino Experiment is an international flagship experiment to unlock the mysteries of neutrinos.\nDUNE scientists will paint a clearer picture of the universe and how it works. Their research may even give us the key\nto understanding why we live in a matter-dominated universe — in other words, why we are here at all.</p>\n\n<p>DUNE will pursue three major science goals: find out whether neutrinos could be the reason the universe is made of matter;\nlook for subatomic phenomena that could help realize Einstein’s dream of the unification of forces; and watch for neutrinos\nemerging from an exploding star, perhaps witnessing the birth of a neutron star or a black hole.</p>\n\n<p>DUNE uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 7400000000000 ,
                        
                    
                        
                            objectCount: 1407846 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "DUNE" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/dune"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/dune/persistent/stash/Flux/Supernova/v1/gvkm_nue_spectrum.root" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://lbnf-dune.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-icarus": {
                    
                        
                            description: "<p>The ICARUS neutrino detector measures 65 feet long and weighs 760 tons. It began its life in <a href=\"https://www.lngs.infn.it/en/lngs-overview\">Gran Sasso Laboratory</a> in\nItaly, seeking out elusive particles using pioneering technology. It later spent two years undergoing upgrades at <a href=\"https://cern.ch/\">CERN</a>,\nthe European particle physics laboratory and home of the Large Hadron Collider. It moved to Fermilab in 2017 and was\ninstalled in its detector hall in 2018, where along with the new Cosmic Ray Tagger it forms the far detector for the\nShort-Baseline Neutrino program.</p>\n\n<p>The ICARUS collaboration is investigating signs of physics that may point to a new kind of neutrino called the sterile\nneutrino. Other experiments have made measurements that suggest a departure from the standard three-neutrino model. ICARUS\nis also investigating the various probabilities of a neutrino interacting with different types of matter as well as\nneutrino-related astrophysics topics.</p>\n\n<p>ICARUS uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 32000000000 ,
                        
                    
                        
                            objectCount: 32767 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "ICARUS" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/icarus"] ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://icarus.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-minerva": {
                    
                        
                            description: "<p>MINERvA (Main Injector Neutrino ExpeRiment to study v-A interactions) is the first neutrino experiment in the\nworld to use a high-intensity beam to study neutrino reactions with five different nuclei, creating the first\nself-contained comparison of interactions in different elements. While this type of study has previously been\ndone using beams of electrons, this is a first for neutrinos.</p>\n\n<p>MINERvA is providing the world’s best, high-precision measurements of neutrino interactions on various nuclei,\nin the 1-to 10-GeV energy range. MINERvA’s results are being used as inputs to current and future experiments\nseeking to study neutrino oscillations, or the ability of neutrinos to change their type.</p>\n\n<p>MINERvA uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 34500000000 ,
                        
                    
                        
                            objectCount: 35339 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "MINERvA" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/minerva"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/minerva/persistent/stash/mc_generation_flux/mc-flux/mc/g4numiv6/00/00/00/06/g4numiv6_dk2nu_minervamebar_me000z-200i_0000_0006.root" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://minerva.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-nova": {
                    
                        
                            description: "<p>The NOvA (NuMI Off-axis ve Appearance) experiment is shedding light on one of nature’s most elusive particles: neutrinos.\nSince the late 1990s, physicists have known that neutrinos exhibit a quantum mechanical behavior called oscillations. But\nthis behavior is not predicted by the Standard Model of particle physics. NOvA is working to better understand these strange\nparticles through precision measurements of their oscillation properties.</p>\n\n<p>NOvA uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 10800000000000 ,
                        
                    
                        
                            objectCount: 535751 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "NOVA" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/nova"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/nova/persistent/stash/flux/g4numi/v6r1b/me000z200i/g4numiv6_minervame_me000z200i_0_0005.root" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://novaexperiment.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-sbn": {
                    
                        
                            description: "<p>The international Short-Baseline Neutrino Program at Fermilab examines the properties of neutrinos,\nspecifically how the flavor of a neutrino changes as it moves through space and matter. The program\nemerged from a joint proposal, submitted by three scientific collaborations, to use particle detectors\nto perform sensitive searches for ve appearance and νμ disappearance in the Booster Neutrino Beam. All\nof the detectors are types of liquid-argon time projection chambers, and each contributes to the\ndevelopment of this particle detection technology for the long-baseline Deep Underground Neutrino Experiments\n(DUNE).</p>\n\n<p>SBN uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 761000000000 ,
                        
                    
                        
                            objectCount: 78747 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Short-Baseline Neutrino Program" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/sbn"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/sbn/persistent/stash/physics/beam/GENIE/BNB/standard/v01_00/converted_beammc_icarus_0113.root" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://sbn.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-sbnd": {
                    
                        
                            description: "<p>The <a href=\"https://sbn-nd.fnal.gov/\">Short-Baseline Near Detector</a> (SBND) is a 112-ton active mass liquid argon time projection chamber (LArTPC)\nneutrino detector that sits only 110-m from the target of the Booster Neutrino Beam (BNB) at Fermilab. SBND is\nthe near detector in the Short-Baseline Neutrino Program. ICARUS is the far detector in the program, and\nMicroBooNE ran previously in the same beam.</p>\n\n<p>SBND will record over a million neutrino interactions per year. By providing such a high statistics measurement\nof the un-oscillated content of the BNB, SBND plays a critical role in performing searches for neutrino oscillations\nat the SBN Program. The large data sample will also allow studies of neutrino-argon interactions in the GeV energy\nrange with unprecedented precision. The physics of these interactions is an important element of future neutrino\nexperiments that will employ the LArTPC technology, such as the long-baseline Deep Underground Neutrino Experiment, <a href=\"https://www.dunescience.org/\">DUNE</a>.</p>\n\n<p>SBND uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 503000000000 ,
                        
                    
                        
                            objectCount: 60125 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Short-Baseline Near Detector" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/sbnd"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/sbnd/persistent/stash/fluxFiles/bnb/BooNEtoGSimple/configK-v1/july2023/neutrinoMode/gsimple_april07_baseline_0019_redecay_wkaonwgh.root" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://sbn-nd.fnal.gov/"} ,
                        
                    
                },
            
                "pnfs-fnalgov-uboone": {
                    
                        
                            description: "<p>MicroBooNE is a large 170-ton liquid-argon time projection chamber (LArTPC) neutrino experiment located on the Booster\nneutrino beamline at Fermilab. The experiment first started collecting neutrino data in October 2015.</p>\n\n<p>MicroBooNE investigates the low energy excess events observed by the MiniBooNE experiment, measure a suite of low\nenergy neutrino cross sections, and investigate astro-particle physics.</p>\n\n<p>MicroBooNE uses the OSDF to deliver common data inputs for large-scale simulation jobs distributed across the US.</p>\n",
                        
                    
                        
                            organization: "Fermi National Accelerator Laboratory" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 3500000000000 ,
                        
                    
                        
                            objectCount: 356300 ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "MicroBooNE" ,
                        
                    
                        
                            namespace: ["/pnfs/fnal.gov/usr/uboone"] ,
                        
                    
                        
                            publicObject: "/pnfs/fnal.gov/usr/uboone/persistent/stash/wcp_ups/wcp/releases/tag/v00_10_00/input_data_files/XGB_nue_seed2_0923.xml" ,
                        
                    
                        
                            organizationUrl: "https://fnal.gov/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://microboone.fnal.gov/"} ,
                        
                    
                },
            
                "purdue": {
                    
                        
                            description: "<p>General namespace for Purdue University OSStore contribution.</p>\n",
                        
                    
                        
                            organization: "Purdue University" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "Purdue University OSStore" ,
                        
                    
                        
                            namespace: ["/purdue"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 0 ,
                        
                    
                        
                            organizationUrl: "https://purdue.edu/" ,
                        
                    
                        
                            repositoryUrl: null ,
                        
                    
                },
            
                "routeviews": {
                    
                        
                            description: "<p>The RouteViews dataset provides a map of the Internet, as seen by participating\nsites.  The information, collected from the <a href=\"https://en.wikipedia.org/wiki/Border_Gateway_Protocol\">BGP</a>\ntables of routers, includes both current and historic “snapshots”.  This allows\noperators of major Internet services to detect changes to the map in near-real\ntime and for researchers to understand the historical evolution of the Internet.</p>\n\n<p>The RouteViews dataset is funded by University of Oregon’s\n<a href=\"https://web.archive.org/web/20200428083158/http://antc.uoregon.edu/\">Advanced Network Technology Center</a>,\nand by grants from the <a href=\"https://www.nsf.gov/\">National Science Foundation</a>,\n<a href=\"https://www.cisco.com/\">Cisco Systems</a>, the <a href=\"https://www.darpa.mil/\">Defense Advanced Research Projects Agency</a>,\n<a href=\"https://www.juniper.net/\">Juniper Networks</a>, Sprint Advanced Technology Laboratories,\n<a href=\"https://catchpoint.com/\">Catchpoint</a> and the providers who graciously provide their BGP views.</p>\n",
                        
                    
                        
                            organization: "University of Oregon" ,
                        
                    
                        
                            organizationUrl: "https://www.uoregon.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://www.routeviews.org/routeviews/"} ,
                        
                    
                        
                            fieldOfScience: "Computer Systems Networking and Telecommunications" ,
                        
                    
                        
                            numberOfDatasets: 1 ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            publicObject: "/routeviews/chicago/route-views.chicago/bgpdata/2025.03/RIBS/rib.20250319.0400.bz2" ,
                        
                    
                        
                            size: 113627027734528 ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            thirtyDayReads: 252838517 ,
                        
                    
                        
                            oneYearReads: 252838638 ,
                        
                    
                        
                            name: "RouteViews" ,
                        
                    
                        
                            namespace: ["/routeviews"] ,
                        
                    
                },
            
                "sage-backup": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/sage-backup"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 71571001350 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "sage": {
                    
                        
                            description: "<p>The Sage project provides a platform for AI computing at the edge.  It operates\na nationwide infrastructure of distributed sensors - from urban landscapes to remote\nmountainsides - that collect, process using AI techniques, and aggregate data.</p>\n\n<p>With over 100 Sage nodes deployed across 17 states, including fire-prone regions in\nthe Western U.S., the platform supports rapid-response science and sustained observation\nof ecological systems, agriculture, urban environments, and weather-related hazards.</p>\n\n<p>Sage uploads its data into NSF CC* funded storage systems connected to the OSDF.  Data\naccess requires a Sage account; more information can be found in <a href=\"https://sagecontinuum.org/docs/tutorials/accessing-data\">the Sage documentation</a> and tutorials.</p>\n",
                        
                    
                        
                            organization: "Northwestern University" ,
                        
                    
                        
                            dataVisibility: "private" ,
                        
                    
                        
                            size: 116631128783045 ,
                        
                    
                        
                            fieldOfScience: "Computer and Information Sciences and Support Services" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 1 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "Sage AI at the Edge" ,
                        
                    
                        
                            namespace: ["/sage"] ,
                        
                    
                        
                            organizationUrl: "https://www.northwestern.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://sagecontinuum.org/"} ,
                        
                    
                        
                            thirtyDayReads: null ,
                        
                    
                        
                            oneYearReads: null ,
                        
                    
                },
            
                "spin4d": {
                    
                        
                            description: "<p>The <a href=\"https://ifauh.github.io/SPIN4D/\">SPIn4D project</a> (Spectropolarimetric Inversion in Four Dimensions with Deep Learning)\ndevelops neural networks to help prepare for the huge amount of solar data coming\nfrom the NSF-funded <a href=\"https://nso.edu/telescopes/inouye-solar-telescope/\">Inouye Solar Telescope</a>,\nthe most powerful solar telescope in the world.</p>\n\n<p>SPIn4D’s <a href=\"http://dtn-itc.ifa.hawaii.edu/spin4d/DR1/\">data release one</a> is 109TB of simulated small-scale dynamo\nactions accompanying the project’s first paper.  A <a href=\"https://github.com/ifauh/spin4d-data/blob/main/spin4d-data-exploration.ipynb\">corresponding Jupyter notebook</a>\nillustrates how to access and use the data via the OSDF using the <a href=\"https://pelicanplatform.org\">Pelican</a> clients.\nThe dataset is also <a href=\"https://www.linkedin.com/pulse/ndp-action-astronomical-data-size-national-data-platform-lfwnc/\">accessible</a>\nvia the <a href=\"https://nationaldataplatform.org/\">National Data Platform</a>.</p>\n\n<p>For more information, see the <a href=\"https://pelicanplatform.org/news/2024/12/20/sun-secrets\">accompanying spotlight article</a>.</p>\n",
                        
                    
                        
                            organization: "University of Hawaii-Moana" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: 119846767427584 ,
                        
                    
                        
                            objectCount: null ,
                        
                    
                        
                            fieldOfScience: "Physical Sciences" ,
                        
                    
                        
                            numberOfDatasets: 6 ,
                        
                    
                        
                            rank: 2 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: true ,
                        
                    
                        
                            name: "SPIN4D Data Release 1" ,
                        
                    
                        
                            namespace: ["/uhkoa/SPIN4D-DR1"] ,
                        
                    
                        
                            publicObject: "/uhkoa/SPIN4D-DR1/SPIN4D_SSD_50G_V/subdomain_9.054681" ,
                        
                    
                        
                            organizationUrl: "https://manoa.hawaii.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"http://dtn-itc.ifa.hawaii.edu/spin4d/DR1/"} ,
                        
                    
                },
            
                "ucsd-physics": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/ucsd/physics"] ,
                        
                    
                        
                            thirtyDayReads: 12836138539 ,
                        
                    
                        
                            oneYearReads: 2005778190351 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
                "uhkoa": {
                    
                        
                            description: "<p>The KoaStore repository is a high performance and scalable parallel file system\nstorage solution that can be used by University of Hawai’i faculty and staff.  KoaStore\nwas <a href=\"https://www.hawaii.edu/news/2022/10/21/500k-boosts-data-intensive-research/\">funded</a>\nthrough the <a href=\"\">NSF Campus Cyberinfrastructure</a> program through <a href=\"https://www.nsf.gov/awardsearch/showAward?AWD_ID=2232862\">award #2232862</a>.</p>\n\n<p>KoaStore users provide datasets such as <a href=\"https://ifauh.github.io/SPIN4D/\">SPIN4D</a> accessible\nvia the OSDF.</p>\n",
                        
                    
                        
                            organization: "University of Hawai'i" ,
                        
                    
                        
                            dataVisibility: "public" ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            fieldOfScience: "Multi/Interdisciplinary Studies" ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: "University of Hawai'i KoaStore" ,
                        
                    
                        
                            namespace: ["/uhkoa"] ,
                        
                    
                        
                            thirtyDayReads: 0 ,
                        
                    
                        
                            oneYearReads: 1669909818762 ,
                        
                    
                        
                            publicObject: null ,
                        
                    
                        
                            organizationUrl: "https://www.hawaii.edu/" ,
                        
                    
                        
                            repositoryUrl: {"url":"https://datascience.hawaii.edu/koa-research-storage-service/"} ,
                        
                    
                },
            
                "user-ligo": {
                    
                        
                            description: "\n",
                        
                    
                        
                            organization: null ,
                        
                    
                        
                            dataVisibility: null ,
                        
                    
                        
                            size: null ,
                        
                    
                        
                            bytesXferd: null ,
                        
                    
                        
                            url: null ,
                        
                    
                        
                            fieldOfScience: null ,
                        
                    
                        
                            numberOfDatasets: null ,
                        
                    
                        
                            rank: 0 ,
                        
                    
                        
                            inProgress: false ,
                        
                    
                        
                            display: false ,
                        
                    
                        
                            name: null ,
                        
                    
                        
                            namespace: ["/user/ligo"] ,
                        
                    
                        
                            thirtyDayReads: 26757304214 ,
                        
                    
                        
                            oneYearReads: 149357052994448 ,
                        
                    
                        
                            organizationUrl: null ,
                        
                    
                },
            
        }

        const visibleData = Object.entries(data).reduce((reduced, v) => {
            if(v[1]['display'] && v[1]['name'] ){
                reduced[v[0]] = v[1]
                reduced[v[0]]['id'] = v[0]
            }
            return reduced
        }, {})
        return visibleData
    }

    set error(error){
        if(error){
            this.errorNode.textContent = error
            this.errorNode.style.display = "block"
        } else {
            this.errorNode.style.display = "none"
        }
    }

    /**
     * Filters the original data and returns the remaining data
     * @returns {Promise<*>}
     */
    getFilteredData = () => {
        let filteredData = this.getData()
        for(const filter of Object.values(this.filters)) {
            filteredData = filter(filteredData)
        }
        return filteredData
    }

    reduceByKey = async (key, value) => {
        let data = await this.getFilteredData()
        let reducedData = Object.values(data).reduce((p, v) => {
            if(v[key] in p) {
                p[v[key]] += v[value]
            } else {
                p[v[key]] = v[value]
            }
            return p
        }, {})
        let sortedData = Object.entries(reducedData)
            .filter(([k,v]) => v > 0)
            .map(([k,v]) => {return {label: k, [value]: Math.round(v)}})
            .sort((a, b) => b[value] - a[value])
        return {
            labels: sortedData.map(x => x.label),
            data: sortedData.map(x => x[value])
        }
    }

}

class DataPage{
    constructor() {
        this.initialize()
    }

    /**
     * Initializes the project page objects
     *
     * Easier to do this all in an async environment so I can wait on data grabs
     * @returns {Promise<void>}
     */
    initialize = async () => {
        this.mode = undefined
        this.dataManager = new DataManager()

        let projectDisplayNode = document.getElementById("project-display")
        this.projectDisplay = new ProjectDisplay(projectDisplayNode)

        this.wrapper = document.getElementById("wrapper")
        this.table = new Table(this.wrapper, this.dataManager.getFilteredData, this.projectDisplay.update.bind(this.projectDisplay))
        this.dataManager.consumerToggles.push(this.table.update)

        let urlProject = new URLSearchParams(window.location.search).get('repository')
        if (urlProject) {
            this.projectDisplay.update((this.dataManager.getData()[urlProject]))
        }

        // Update the repository count
        document.getElementById("repository-count").innerText = Object.values(this.dataManager.getData()).length
        counter("connected", Object.values(this.dataManager.getData()).length, 20)
    }
}

const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
})

const project_page = new DataPage()

async function initialize_ospool_report () {
    counter("transferred", 175, 20)
    counter("delivered", 138, 20)
}

/**
 * A function to convert large numbers into a < 4 char format, i.e. 100,000 to 100k or 10^^9 to 1b
 *
 * It would be interesting to find a solution to this that is better than O(N)
 * @param int An integer
 * @param decimals The amount of decimal places to include
 */
function int_to_small_format(int, decimals=0) {
    if(int < 10**3) {
        return int.toFixed(decimals)
    } else if ( int < 10**6 ) {
        return (int / 10**3).toFixed(decimals) + "K"
    } else if ( int < 10**9 ) {
        return (int / 10**6).toFixed(decimals) + "M"
    } else if ( int < 10**12 ) {
        return (int / 10**9).toFixed(decimals) + "B"
    } else {
        return int.toFixed(decimals)
    }
}


initialize_ospool_report()
