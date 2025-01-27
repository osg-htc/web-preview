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