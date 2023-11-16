const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

async function initialize_ospool_report () {
    try{
        let response = await fetch("https://osg-htc.org/ospool-data/data/daily_reports/latest.json")
        let json = await response.json()

        let dataDate = new Date(json['date'])
        let dateString = `${months[dataDate.getUTCMonth()]} ${dataDate.getUTCDate()}`
        document.getElementById("ospool-date").textContent = dateString
        document.getElementById("ospool-site-date").textContent = dateString

        counter("ospool-jobs", json['num_uniq_job_ids'], 20)
        counter("ospool-file-transfers", json['total_files_xferd'], 20)
        counter("ospool-core-hours", json['all_cpu_hours'], 20)
        counter("ospool-users", json['num_users'], 20)

        counter("ospool-site-jobs", json['num_uniq_job_ids'], 20)
        counter("ospool-sites", json['num_institutions'], 20)
    } catch(e) {
        document.getElementById("ospool-statistics-display").hidden = true
    }
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