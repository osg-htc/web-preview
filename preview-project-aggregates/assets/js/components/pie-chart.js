import {Chart, registerables} from 'https://cdn.jsdelivr.net/npm/chart.js@4.3.2/+esm'

Chart.register(...registerables);

const getOrCreateLegendList = (chart, id) => {
	const legendContainer = document.getElementById(id);
	let listContainer = legendContainer.querySelector('ul');

	if (!listContainer) {
		listContainer = document.createElement('ul');
		listContainer.style.display = 'flex';
		listContainer.style.flexDirection = 'column';
		listContainer.style.margin = 0;
		listContainer.style.padding = 0;
		listContainer.style.height = `${chart.canvas.height}px`;
		listContainer.style.overflowY = 'auto';

		legendContainer.appendChild(listContainer);
	}

	return listContainer;
};

const htmlLegendPlugin = {
	id: 'htmlLegend',
	afterUpdate(chart, args, options) {
		const ul = getOrCreateLegendList(chart, options.containerID);

		// Remove old legend items
		while (ul.firstChild) {
			ul.firstChild.remove();
		}

		// Reuse the built-in legendItems generator
		const items = chart.options.plugins.legend.labels.generateLabels(chart);

		items.forEach(item => {
			const li = document.createElement('li');
			li.style.alignItems = 'center';
			li.style.cursor = 'pointer';
			li.style.display = 'flex';
			li.style.flexDirection = 'row';
			li.style.marginLeft = '10px';
			li.style.paddingBottom = '2px'

			li.onclick = () => {
				const {type} = chart.config;
				if (type === 'pie' || type === 'doughnut') {
					// Pie and doughnut charts only have a single dataset and visibility is per item
					chart.toggleDataVisibility(item.index);
				} else {
					chart.setDatasetVisibility(item.datasetIndex, !chart.isDatasetVisible(item.datasetIndex));
				}
				chart.update();
			};

			// Color box
			const boxSpan = document.createElement('span');
			boxSpan.style.background = item.fillStyle;
			boxSpan.style.borderColor = item.strokeStyle;
			boxSpan.style.borderWidth = item.lineWidth + 'px';
			boxSpan.style.display = 'inline-block';
			boxSpan.style.flexShrink = 0;
			boxSpan.style.height = '20px';
			boxSpan.style.marginRight = '10px';
			boxSpan.style.width = '20px';

			// Text
			const textContainer = document.createElement('p');
			textContainer.style.color = item.fontColor;
			textContainer.style.margin = 0;
			textContainer.style.padding = 0;
			textContainer.style.fontSize = ".8rem"
			textContainer.style.textDecoration = item.hidden ? 'line-through' : '';

			const text = document.createTextNode(item.text);
			textContainer.appendChild(text);

			li.appendChild(boxSpan);
			li.appendChild(textContainer);
			ul.appendChild(li);

			ul.style.height = `${chart.canvas.style.height}`;
		});
	}
};

export class PieChart {
	constructor(id, data) {
		this.id = id
		this.data = data

		this.createHtmlElements()

		this.createGraph()
	}

	createHtmlElements() {

		let parent = document.getElementById(this.id);
		parent.className = 'row gx-0';

		this.canvasContainer = document.createElement('div');
		this.canvasContainer.className = "col-md-8 col-12"

		this.canvas = document.createElement('canvas');
		this.canvas.id = `canvas-${this.id}`;

		this.canvasContainer.appendChild(this.canvas);

		this.legend = document.createElement('div');
		this.legend.id = `legend-${this.id}`;
		this.legend.className = "col-md-4 col-12"


		parent.appendChild(this.canvasContainer);
		parent.appendChild(this.legend);
	}

	async createGraph() {
		new Chart(this.canvas, {
			type: 'pie',
			data: {
				labels: this.data['labels'],
				datasets: [{
					label: '# of Jobs',
					data: this.data['data'],
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				plugins: {
					htmlLegend: {
						// ID of the container to put the legend in
						containerID: `legend-${this.id}`
					},
					legend: {
						display: false
					}
				}
			},
			plugins: [htmlLegendPlugin],
		});
	}
}