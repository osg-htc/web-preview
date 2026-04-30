# Presentations
Used to store metadata for CHTC presentations

## Example

```yaml
---
title: "Title"
presenter: "Presenter(s) Name"
event: "Example Event Name"
date: 2025-07-24
publish_on:
  - path
  - osg

description: |
  This is a example submission.
  
youtube_video_id: "g1PN21vWB-Q" # If the YouTube video ID is present, it will always use the YouTube thumbnail.
image: # optional                 If there is no YouTube video ID, it will use the image for the thumbnail.
    path: "https://raw.githubusercontent.com/CHTC/events/main/images/trust-webinar-preview.png"
    alt: Webinar preview image

keywords:
  - example
  - keyword

links:
  - name: Presentation Slides
    value: https://drive.google.com
---
```
