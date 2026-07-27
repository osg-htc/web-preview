class UpdateTextField {

	constructor(dataGetter, node) {
		this.node = node
		this.dataGetter = dataGetter
		this.update()
	}

	update = async () => {
		let data = await this.dataGetter()
		this.node.textContent = data.toString()
	}
}

export default UpdateTextField;
