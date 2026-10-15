/**
 * Count Component
 *
 * Fills an element with a given id with a count value.
 *
 * @param id - The id of the element to fill
 * @param count - The count value to display
 * @param maxHeight - The maximum height of the count element
 */
const Count = (id, count, maxHeight = undefined) => {

	// If maxHeight is not defined, check if it is set in the CSS
	if (maxHeight === undefined) {
		const style = getComputedStyle(document.getElementById(id));
		maxHeight = style.maxHeight !== 'none' ? parseFloat(style.maxHeight) : 99999999; // Default to 50px if not set
	}

	const node = document.getElementById(id)

	const countNode = document.createElement("span")

	if (node) {
		countNode.textContent = count.toLocaleString()
		node.appendChild(countNode)
	}

	let diff = node.clientWidth - countNode.getBoundingClientRect().width
	let newDiff = diff
	while(newDiff > 0 && newDiff <= diff && countNode.getBoundingClientRect().height < maxHeight) {
		diff = node.clientWidth - countNode.getBoundingClientRect().width
		countNode.style.fontSize = (parseFloat(getComputedStyle(countNode).fontSize) + 1) + "px"
		newDiff = node.clientWidth - countNode.getBoundingClientRect().width
	}

	// Iterate back one step to ensure the text fits
	countNode.style.fontSize = (parseFloat(getComputedStyle(countNode).fontSize) - 1) + "px"

	node.classList.add("d-table", "text-center")
	countNode.classList.add("d-table-cell", "align-middle")
}

export default Count;