const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Resolve the JSON relative to this module's own URL so it works both in
// production (baseurl '') and under the preview baseurl (/web-preview/<branch>).
// This file lives at <baseurl>/assets/js/pages/, the data at <baseurl>/assets/data/.
const DATA_URL = new URL("../../data/alphafold-caching.json", import.meta.url);

/**
 * Animate a number from 0 up to endValue inside the element with the given id.
 *
 * @param id The id of the element to populate
 * @param endValue The final value to count up to
 * @param numIncrements How many steps to take while counting up
 * @param decimals The amount of decimal places to include
 */
let counter = async (id, endValue, numIncrements, decimals=0) => {
    let node = document.getElementById(id)
    if (!node) {
        console.error(`Could not find node with id ${id}`)
        return
    }

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

async function initialize_alphafold_report () {
    try {

        const json = (await fetch(DATA_URL).then(res => res.json()))['data']
        const d = new Date(json['date'])

        document.getElementById("alphafold-date").textContent = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
        counter("alphafold-alignments", json['alignmentsCached'], 20)
        counter("alphafold-proteins", json['uniqueProteins'], 20)
        counter("alphafold-species", json['species'], 20)
        counter("alphafold-community", json['communityContributed'], 20)

    } catch(e) {
        console.error("Error fetching AlphaFold alignment cache statistics: ", e)
    }
}

/**
 * A function to convert large numbers into a < 4 char format, i.e. 100,000 to 100k or 10^^9 to 1b
 *
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


initialize_alphafold_report()
