/**
 * This file is imported on all pages.
 */

document.querySelectorAll('.dropdown-menu a').forEach(function(element) {
	let nextEl = element.nextElementSibling;
	if(nextEl && nextEl.classList.contains('dropdown-submenu')) {
		element.addEventListener('click', function (e) {
			// prevent opening link if link needs to open dropdown
			e.preventDefault();
			e.stopPropagation();
		});
	}
})

/**
 * Finds all the elements with '.fade-in' and fades them in as they are scrolled onto the screen.
 */
const fadeInElements = document.querySelectorAll('.fade-in');

// Add a fade-in-active class so we know js is running
fadeInElements.forEach(element => {
	element.classList.add('fade-in-active');
});

// Run the following function when the element is scrolled into view
const fadeInOptions = {
	threshold: 1,
	rootMargin: "0px 0px 0px 0px"
};
const fadeInObserver = new IntersectionObserver((entries, observer) => {
	entries.forEach(entry => {
		if (entry.isIntersecting) {
			entry.target.classList.add('fade-in-visible');
		}
	});
}, fadeInOptions);
fadeInElements.forEach(element => {
	fadeInObserver.observe(element);
});

/** Add a function that checks if the element #reverse-fade-in is hovered and if so reverse it */
const touchScreen = matchMedia('(hover: none)').matches;
const reverseFadeInElement = document.querySelector('#reverse-fade-in');
if (reverseFadeInElement && !touchScreen) {
	reverseFadeInElement.addEventListener('mouseover', () => {
		fadeInElements.forEach(element => {
			element.classList.remove('fade-in-visible');
		});
	});
	reverseFadeInElement.addEventListener('mouseout', () => {
		fadeInElements.forEach(element => {
			if (element.classList.contains('fade-in-active')) {
				element.classList.add('fade-in-visible');
			}
		});
	});
}

// Add a function that enables tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
