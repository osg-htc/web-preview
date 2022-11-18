let counter = async (id, endValue, numIncrements) => {
    let node = document.getElementById(id)
    let startValue = parseInt(node.innerText)

    let valueArray = [...Array(numIncrements).keys()].map((value, index) => {
        return Math.floor(endValue * (Math.sqrt((index+1)/numIncrements)))
    })

    let index = 0;
    let interval = setInterval(() => {
        if (index >= valueArray.length) {
            clearInterval(interval)
        } else {
            node.textContent = valueArray[index].toLocaleString()
        }
        index += 1;
    }, 50)
}

async function initialize_ospool_report () {
    try{
        let response = await fetch("https://osg-htc.org/ospool-data/data/daily_reports/latest.json")
        let json = await response.json()

        document.getElementById("ospool-date").textContent = json['date']

        counter("ospool-jobs", json['num_uniq_job_ids'], 20)
        counter("ospool-file-transfers", json['total_files_xferd'], 20)
        counter("ospool-core-hours", json['all_cpu_hours'], 20)
        counter("ospool-users", json['num_users'], 20)
        counter("ospool-projects", json['num_projects'], 20)
    } catch(e) {
        document.getElementById("ospool-statistics-display").hidden = true
    }





}

initialize_ospool_report()