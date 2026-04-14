/**
 * This file is imported on all pages.
 */

document.querySelectorAll('.dropdown-menu a').forEach(function(element) {
    const siblingSubmenu = element.nextElementSibling;
    if(siblingSubmenu && siblingSubmenu.classList.contains('dropdown-submenu')) {
        element.addEventListener('click', function (e) {
            // prevent opening link if link needs to open dropdown
            e.preventDefault();
            e.stopPropagation();

            // Close any other open submenus
            const openSubmenus = document.querySelectorAll('a.dropdown-item.dropdown-toggle');
            openSubmenus.forEach((submenu) => {
                if (submenu !== element) {
                    submenu.classList.remove('show');
                    submenu.nextElementSibling.classList.remove('show'); // Hide the submenu
                    submenu.ariaExpanded = 'false';
                }
            });
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

/**
 * Simple hash function to hash a string to a number.
 */
function generateStringHash(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }

    return hash;
}

/**
 * Fill in badge colors based on tag text.
 */
function fillBadgeColors() {
    const badges = document.querySelectorAll(".tag-badge");
    badges.forEach(badge => {
        const tagText = badge.textContent.trim();
        let hue = generateStringHash(tagText) % 360;
        if (hue >= 60 && hue <= 140) {
            hue = (hue + 80) % 360; // avoid ugly colors
        }

        badge.style.backgroundColor = `hsl(${hue}, 70%, 40%)`;
        badge.style.color = "#fff";
    });
}

fillBadgeColors();
