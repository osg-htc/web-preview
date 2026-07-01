# Events
Repository containing all events for PATh-cc, OSG, and CHTC.

## Formatting

Events are written in Markdown. Here is an example template:

```yaml
---
title: "Event Title"
short_title: "Short Title"
published: true
start_date: YYYY-MM-DD
end_date: YYYY-MM-DD
publish_on:
  - path
  - osg

excerpt:
    Short excerpt of the event.

image:
    path: "https://raw.githubusercontent.com/CHTC/events/main/images/trust-webinar-preview.png"
    alt: Image alt text
banner:
    path: "https://raw.githubusercontent.com/CHTC/events/main/images/trust-banner.png"
    alt: Banner alt text
    credit: Optional credit for the banner image. Feel free to delete.

sidebar: |
    # When
    Date and time of the event.
    # Anything
    You can use any Markdown here, including [links](https://example.com). It just goes in the sidebar.
endblock: |
    ### Credit
    Text for crediting the event.
    ### Anything
    You can use any Markdown here, including [links](https://example.com). It just goes at the end of the article.
    Feel free to delete the entire `endblock:` tag if you don't need it.
---

The article content goes here.
```

## Images

To use an image (either as the thumbnail, banner image, content, etc.) in an event, add it to the `/images` directory. Then, when using the image, use the **direct GitHub URL** to the image.

For the example, `images/trust-banner.png` would be `https://raw.githubusercontent.com/CHTC/events/main/images/trust-banner.png`.

### Prefix:

`https://raw.githubusercontent.com/CHTC/events/main/images/`
