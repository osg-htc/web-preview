import {CollaborationGlobe} from "./components/globe.js";
import {Collaborations} from "../js/organization-page.js";

const main = async () => {
    const collaborations = new Collaborations()
    await collaborations.initializeASYNC()

    const collaboration = collaborations['IGWN']

    const globe = new CollaborationGlobe("globe", collaboration)
}

main()