// This is run on all the pages

// Compute parent heights that have absolute children
const update_heights = () => {
    let child_watchers = document.getElementsByClassName("watch-child-height")

    for(const node of child_watchers){
        node.style.height = node.getElementsByClassName("watch-parent-height")[0].offsetHeight + "px"
    }
}

[].forEach.call(document.getElementsByTagName("img"),function(el){
    el.addEventListener("load",function(e){
        update_heights()
    });
});

window.addEventListener("resize", update_heights)
update_heights()