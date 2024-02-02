## Welcome to the OSG

- [How to add to this Website](#deployment)
- [Using Github for Development](#using-github-for-development)
- [Pushing Changes to Production](#pushing-changes-to-production)

This repository contains the source code of the OSG website; it is not the public facing site.

The real webpage for the OSG is <https://www.opensciencegrid.org>.

# Deployment

To have your changes merged into master you must create a PR and get one review. If you don't have anyone in mind you can request _@CannonLock_ and he will review it the next morning.

### What We Do

The OSG facilitates access to distributed high throughput computing for research in the US.
The resources accessible through the OSG are contributed by the community, organized by the OSG, and governed by the OSG consortium.
In the last 12 months, we have provided more than 1.2 billion CPU hours to researchers across a wide variety of projects.

To see the breadth of the OSG impact, [explore our accounting portal](https://gracc.opensciencegrid.org).

### Submit Locally, Run Globally

Researchers can submit batch jobs from their home institution - or OSG-provided submit points - in order to access their local resources and expand
elastically out to the OSG, leverage the distributed nature of our consortium.

### Sharing Is Key

*Sharing is a core principle of the OSG.*  Over 100 million CPU hours delivered on the OSG in the past year were opportunistic: they would have remained on but idle
if it wasn't for the OSG. Sharing allows individual researchers to access larger computing resources and large organizations to keep their utilization high.

### Resource Providers

The OSG consists of computing and storage elements at over 100 individual sites spanning the United States.
These sites, primarily at universities and national labs, range in size from a few hundred to tens of thousands of CPU cores.

### The OSG Software Stack

The OSG provides an integrated software stack to enable high throughput computing; [visit our technical documents website for information](docs/).

### Find Us!

Are you a user wanting more computing resources?

Are you a resource provider wanting to join our collaboration?

If so, find us at the [support desk](https://support.opensciencegrid.org).

## Internal Documentation

### Using Github for Development

1. Create a Branch from master with 'preview-' at the start of the branch name
  - For instance 'preview-helloworld'
2. Push this branch to the repo at https://github.com/path-cc/path-cc.github.io.git
  - If you created the branch on github it is already there!
4. Populate the changes that you want to see
5. Preview the changes that you have made at https://path-cc.io/web-preview/<branch-name\>/ 
  - For this instance https://path-cc.io/web-preview/preview-helloworld/
6. When you are happy with the changes create a PR into master

### Using Local Computer for Developement

To make changes to the website clone the files and run the below line to run the container. 
```
docker run -it -p 8002:8000 -v $PWD:/app -w /app ruby:2.8 /bin/bash
```
In the container run the below line to build the website. 
```
bundle install
bundle exec jekyll serve --watch --config _config.yml -H 0.0.0.0 -P 8000
```
After the build is complete the website will be available at [http://0.0.0.0:8000/](http://0.0.0.0:8000/)
    
### Pushing Changes to Production

The production websites (https://opensciencegrid.org/, https://osg-htc.org) are built automatically by GitHub Pages from the **master** branch.

To make changes to the website, use the following workflow:

1.  Submit a pull request with website updates to the `master` branch (the default) and request a review.
    - Any reviews with visual changes can be handled more quickly if you provide a [preview instance](#using-github-for-development)
1.  Upon approval you can view the changes at https://opensciencegrid.org/ and https://osg-htc.org

### Adding To the Team Page

The [team page](https://opensciencegrid.org/about/team) provides an overview of those working on the OSG.  It's important to keep this updated to reflect the evolving nature of the OSG.  To add yourself to this page, [create a pull request](https://help.github.com/articles/about-pull-requests/) (using the standard GitHub workflow) with the following:

* A short config file about yourself, [following this example](https://github.com/opensciencegrid/opensciencegrid.github.io/blob/master/_data/people/bbockelm.yml).  Make sure to include your *name*, *shortname* (typically either your GitHub ID as in `bbockelm` or *Firstname-Lastname* as in `Brian-Bockelman`), *institution*, *website*, and *photo*.  If you are an area coordinator or have some other named role, you can fill in *title*.
* Upload a headshot of yourself into the `assets/images/team` directory.  Name it in the form `assets/images/team/Firstname-Lastname.jpg`; in this case, the corresponding value of the *photo* tag in your config file will be `/assets/images/team/Firstname-Lastname.jpg`.
* If you are a member of the executive team, then add your shortname tag to the [organization file](https://github.com/opensciencegrid/opensciencegrid.github.io/blob/master/_data/orgs/exec-team.yml), `_data/orgs/exec-team.yml`.
