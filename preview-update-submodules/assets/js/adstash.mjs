/**
 * A collection of functions for uniform queries to the adstash ES endpoint
 */
import ElasticSearchQuery, {ADSTASH_ENDPOINT, ADSTASH_SUMMARY_INDEX, DATE_RANGE} from "./elasticsearch-v1.js";

export async function getLatestOSPoolOverview() {
    let json = undefined
    let d = new Date()
    d.setUTCHours(0,0,0,0)
    while (!json || json['numJobs'] == 0) {
        d.setUTCDate(d.getUTCDate() - 1)
        json = await getInstitutionsOverview(d.getTime(), d.getTime())
        json['date'] = d
    }
    return json
}

export const getInstitutionsOverview = async (startTime = DATE_RANGE['oneYearAgo'], endTime = DATE_RANGE['now']) => {
	const elasticSearch = new ElasticSearchQuery(ADSTASH_SUMMARY_INDEX, ADSTASH_ENDPOINT)

	let usageQueryResult = await elasticSearch.search({
		size: 0,
		query: {
			range: {
				Date: {
                    gte: startTime,
					lte: endTime
				}
			}
		},
		"aggs": {
			"NumInstitutions": {
				"terms": {
					"field": "ResourceInstitution.name.keyword",
					"size": 10000
				}
			},
			"NumProjects": {
				"terms": {
					"field": "ProjectName.keyword",
					"size": 10000
				}
			},
			"NumMajorFieldOfScience": {
				"terms": {
					"field": "MajorFieldOfScience.keyword",
					"size": 10000
				}
			},
			"NumBroadFieldOfScience": {
				"terms": {
					"field": "BroadFieldOfScience.keyword",
					"size": 10000
				}
			},
			"NumDetailedFieldOfScience": {
				"terms": {
					"field": "DetailedFieldOfScience.keyword",
					"size": 10000
				}
			},
			"NumJobs": {
				"sum": {
					"field": "NumJobs"
				}
			},
			"FileTransferCount": {
				"sum": {
					"field": "FileTransferCount"
				}
			},
			"ByteTransferCount": {
				"sum": {
					"field": "ByteTransferCount"
				}
			},
			"CpuHours": {
				"sum": {
					"field": "CpuHours"
				}
			},
			"GpuHours": {
				"sum": {
					"field": "GpuHours"
				}
			},
			"OSDFFileTransferCount": {
				"sum": {
					"field": "OSDFFileTransferCount"
				}
			},
			"OSDFByteTransferCount": {
				"sum": {
					"field": "OSDFByteTransferCount"
				}
			}
		}
	})

	let data = usageQueryResult.aggregations

	try {
		// Simplify the data keys
		return {
			numInstitutions: data['NumInstitutions']['buckets'].length,
			numJobs: data['NumJobs']['value'],
			cpuHours: data['CpuHours']['value'],
			gpuHours: data['GpuHours']['value'],
			fileTransferCount: data['FileTransferCount']['value'],
			byteTransferCount: data['ByteTransferCount']['value'],
			osdfFileTransferCount: data['OSDFFileTransferCount']['value'],
			osdfByteTransferCount: data['OSDFByteTransferCount']['value'],
			numProjects: data['NumProjects']['buckets'].length,
			numMajorFieldOfScience: data['NumMajorFieldOfScience']['buckets'].length,
			numBroadFieldOfScience: data['NumBroadFieldOfScience']['buckets'].length,
			numDetailedFieldOfScience: data['NumDetailedFieldOfScience']['buckets'].length,
		}
	} catch(e){
		console.log(e)
	}

	return {}
}

export const getInstitutions = async (startTime = DATE_RANGE['oneYearAgo'], endTime = DATE_RANGE['now']) => {
	const elasticSearch = new ElasticSearchQuery(ADSTASH_SUMMARY_INDEX, ADSTASH_ENDPOINT)

	let usageQueryResult = await elasticSearch.search({
		size: 0,
		query: {
			range: {
				Date: {
          gte: startTime,
          lte: endTime
				}
			}
		},
		"aggs": {
			"bucket": {
				"terms": {
					"field": "ResourceInstitution.name.keyword",
					"size": 10000
				},
				"aggs": {
					"NumProjects": {
						"terms": {
							"field": "ProjectName.keyword",
							"size": 10000
						}
					},
					"NumMajorFieldOfScience": {
						"terms": {
							"field": "MajorFieldOfScience.keyword",
							"size": 10000
						}
					},
					"NumBroadFieldOfScience": {
						"terms": {
							"field": "BroadFieldOfScience.keyword",
							"size": 10000
						}
					},
					"NumDetailedFieldOfScience": {
						"terms": {
							"field": "DetailedFieldOfScience.keyword",
							"size": 10000
						}
					},
					"NumJobs": {
						"sum": {
							"field": "NumJobs"
						}
					},
					"FileTransferCount": {
						"sum": {
							"field": "FileTransferCount"
						}
					},
					"ByteTransferCount": {
						"sum": {
							"field": "ByteTransferCount"
						}
					},
					"CpuHours": {
						"sum": {
							"field": "CpuHours"
						}
					},
					"GpuHours": {
						"sum": {
							"field": "GpuHours"
						}
					},
					"OSDFFileTransferCount": {
						"sum": {
							"field": "OSDFFileTransferCount"
						}
					},
					"OSDFByteTransferCount": {
						"sum": {
							"field": "OSDFByteTransferCount"
						}
					},
					"CommonFields": {
						"top_hits": {
							"_source": {
								"includes": RESOURCE_COMMON_FIELDS
							},
							"size": 1
						}
					}
				}
			}
		}
	})

	let buckets = usageQueryResult.aggregations.bucket.buckets

	try {
		// Simplify the data keys
		return buckets.reduce((p, v) => {
			p[v['key']] = {
				institutionName: v['key'],
				numJobs: v['NumJobs']['value'],
				cpuHours: v['CpuHours']['value'],
				gpuHours: v['GpuHours']['value'],
				fileTransferCount: v['FileTransferCount']['value'],
				byteTransferCount: v['ByteTransferCount']['value'],
				osdfFileTransferCount: v['OSDFFileTransferCount']['value'],
				osdfByteTransferCount: v['OSDFByteTransferCount']['value'],
				numProjects: v['NumProjects']['buckets'].length,
				numMajorFieldOfScience: v['NumMajorFieldOfScience']['buckets'].length,
				numBroadFieldOfScience: v['NumBroadFieldOfScience']['buckets'].length,
				numDetailedFieldOfScience: v['NumDetailedFieldOfScience']['buckets'].length,
				institutionState: getFromCommonField(v, "ResourceInstitution", "state"),
				institutionIpedsWebsiteAddress: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "website_address"),
				institutionIpedsHistoricallyBlackCollegeOrUniversity: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "historically_black_college_or_university"),
				institutionIpedsTribalCollegeOrUniversity: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "tribal_college_or_university"),
				institutionCarnegieClassification2025: getFromCommonField(v, "ResourceInstitution", "carnegie_metadata", "classification2025"),
			}
			return p
		}, {})
	} catch(e){
		console.log(e)
	}

	return {}
}

export const getProjects = async (startTime = DATE_RANGE['oneYearAgo'], endTime = DATE_RANGE['now']) => {
	const elasticSearch = new ElasticSearchQuery(ADSTASH_SUMMARY_INDEX, ADSTASH_ENDPOINT)

	let usageQueryResult = await elasticSearch.search({
		size: 0,
		query: {
			range: {
				Date: {
          gte: startTime,
          lte: endTime
				}
			}
		},
		"aggs": {
			"bucket": {
				"terms": {
					"field": "ProjectName.keyword",
					"size": 10000
				},
				"aggs": {
					"NumJobs": {
						"sum": {
							"field": "NumJobs"
						}
					},
					"FileTransferCount": {
						"sum": {
							"field": "FileTransferCount"
						}
					},
					"ByteTransferCount": {
						"sum": {
							"field": "ByteTransferCount"
						}
					},
					"CpuHours": {
						"sum": {
							"field": "CpuHours"
						}
					},
					"GpuHours": {
						"sum": {
							"field": "GpuHours"
						}
					},
					"OSDFFileTransferCount": {
						"sum": {
							"field": "OSDFFileTransferCount"
						}
					},
					"OSDFByteTransferCount": {
						"sum": {
							"field": "OSDFByteTransferCount"
						}
					},
					"CommonFields": {
						"top_hits": {
							"_source": {
								"includes": PROJECT_COMMON_FIELDS
							},
							"size": 1
						}
					}
				}
			}
		}
	})

	let buckets = usageQueryResult.aggregations.bucket.buckets

	try {
		// Simplify the data keys
		return buckets.reduce((p, v) => {
			p[v['key']] = {
				projectName: v['key'],
				numJobs: v['NumJobs']['value'],
				cpuHours: v['CpuHours']['value'],
				gpuHours: v['GpuHours']['value'],
				fileTransferCount: v['FileTransferCount']['value'],
				byteTransferCount: v['ByteTransferCount']['value'],
				osdfFileTransferCount: v['OSDFFileTransferCount']['value'],
				osdfByteTransferCount: v['OSDFByteTransferCount']['value'],
				broadFieldOfScience: getFromCommonField(v, 'BroadFieldOfScience'),
				majorFieldOfScience: getFromCommonField(v, 'MajorFieldOfScience'),
				detailedFieldOfScience: getFromCommonField(v, 'DetailedFieldOfScience'),
				projectInstitutionName: getFromCommonField(v, 'ProjectInstitution', 'name'),
				projectInstitutionIpedsWebsiteAddress: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'website_address'),
				projectInstitutionIpedsHistoricallyBlackCollegeOrUniversity: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'historically_black_college_or_university'),
				projectInstitutionIpedsTribalCollegeOrUniversity: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'tribal_college_or_university'),
				projectInstitutionState: getFromCommonField(v, 'ProjectInstitution', 'state'),
				projectEpscorState: EPSCOR_STATES.includes(getFromCommonField(v, 'ProjectInstitution', 'state'))
			}
			return p
		}, {})
	} catch(e){
		console.log(e)
	}

	return {}
}
export const getInstitutionOverview = async (institutionName) => {
	const elasticSearch = new ElasticSearchQuery(ADSTASH_SUMMARY_INDEX, ADSTASH_ENDPOINT)

	let usageQueryResult = await elasticSearch.search({
		size: 0,
		query: {
			bool: {
				filter: [
					{
						range: {
							Date: {
								lte: DATE_RANGE['now'],
								gte: DATE_RANGE['oneYearAgo']
							}
						},
					},
					{
						term: {
							["ResourceInstitution.name.keyword"]: institutionName,
						}
					}
				]
			}
		},
		"aggs": {
			"agg": {
				"terms": {
					"field": "ProjectName.keyword",
					"size": 10000
				},
				"aggs": {
					"NumJobs": {
						"sum": {
							"field": "NumJobs"
						}
					},
					"FileTransferCount": {
						"sum": {
							"field": "FileTransferCount"
						}
					},
					"ByteTransferCount": {
						"sum": {
							"field": "ByteTransferCount"
						}
					},
					"CpuHours": {
						"sum": {
							"field": "CpuHours"
						}
					},
					"GpuHours": {
						"sum": {
							"field": "GpuHours"
						}
					},
					"OSDFFileTransferCount": {
						"sum": {
							"field": "OSDFFileTransferCount"
						}
					},
					"OSDFByteTransferCount": {
						"sum": {
							"field": "OSDFByteTransferCount"
						}
					},
					"CommonFields": {
						"top_hits": {
							"_source": {
								"includes": PROJECT_COMMON_FIELDS
							},
							"size": 1
						}
					}
				}
			}
		}
	})

	let buckets = usageQueryResult.aggregations.agg.buckets

	try {
		return buckets.reduce((p, v) => {
			p[v['key']] = {
				projectName: v['key'],
				numJobs: v['NumJobs']['value'],
				cpuHours: v['CpuHours']['value'],
				gpuHours: v['GpuHours']['value'],
				fileTransferCount: v['FileTransferCount']['value'],
				byteTransferCount: v['ByteTransferCount']['value'],
				osdfFileTransferCount: v['OSDFFileTransferCount']['value'],
				osdfByteTransferCount: v['OSDFByteTransferCount']['value'],
				broadFieldOfScience: getFromCommonField(v, 'BroadFieldOfScience'),
				majorFieldOfScience: getFromCommonField(v, 'MajorFieldOfScience'),
				detailedFieldOfScience: getFromCommonField(v, 'DetailedFieldOfScience'),
				projectInstitutionName: getFromCommonField(v, 'ProjectInstitution', 'name'),
				projectInstitutionIpedsWebsiteAddress: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'website_address'),
				projectInstitutionIpedsHistoricallyBlackCollegeOrUniversity: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'historically_black_college_or_university'),
				projectInstitutionIpedsTribalCollegeOrUniversity: getFromCommonField(v, 'ProjectInstitution', 'ipeds_metadata', 'tribal_college_or_university'),
				projectInstitutionState: getFromCommonField(v, 'ProjectInstitution', 'state'),
				projectEpscorState: EPSCOR_STATES.includes(getFromCommonField(v, 'ProjectInstitution', 'state'))
			}
			return p
		}, {})
	} catch(e){
		console.log(e)
	}

	return {}
}

export const getProjectOverview = async (projectName) => {
	const elasticSearch = new ElasticSearchQuery(ADSTASH_SUMMARY_INDEX, ADSTASH_ENDPOINT)

	let usageQueryResult = await elasticSearch.search({
		size: 0,
		query: {
			bool: {
				filter: [
					{
						range: {
							Date: {
								lte: DATE_RANGE['now'],
								gte: DATE_RANGE['oneYearAgo']
							}
						},
					},
					{
						term: {
							["ProjectName.keyword"]: projectName,
						}
					}
				]
			}
		},
		"aggs": {
			"agg": {
				"terms": {
					"field": "ResourceInstitution.name.keyword",
					"size": 10000
				},
				"aggs": {
					"NumJobs": {
						"sum": {
							"field": "NumJobs"
						}
					},
					"FileTransferCount": {
						"sum": {
							"field": "FileTransferCount"
						}
					},
					"ByteTransferCount": {
						"sum": {
							"field": "ByteTransferCount"
						}
					},
					"CpuHours": {
						"sum": {
							"field": "CpuHours"
						}
					},
					"GpuHours": {
						"sum": {
							"field": "GpuHours"
						}
					},
					"OSDFFileTransferCount": {
						"sum": {
							"field": "OSDFFileTransferCount"
						}
					},
					"OSDFByteTransferCount": {
						"sum": {
							"field": "OSDFByteTransferCount"
						}
					},
					"CommonFields": {
						"top_hits": {
							"_source": {
								"includes": RESOURCE_COMMON_FIELDS
							},
							"size": 1
						}
					}
				}
			}
		}
	})

	let buckets = usageQueryResult.aggregations.agg.buckets

	try {
		return buckets.reduce((p, v) => {
			p[v['key']] = {
				projectName: v['key'],
				numJobs: v['NumJobs']['value'],
				cpuHours: v['CpuHours']['value'],
				gpuHours: v['GpuHours']['value'],
				fileTransferCount: v['FileTransferCount']['value'],
				byteTransferCount: v['ByteTransferCount']['value'],
				osdfFileTransferCount: v['OSDFFileTransferCount']['value'],
				osdfByteTransferCount: v['OSDFByteTransferCount']['value'],
				institutionState: getFromCommonField(v, "ResourceInstitution", "state"),
				institutionIpedsWebsiteAddress: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "website_address"),
				institutionIpedsHistoricallyBlackCollegeOrUniversity: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "historically_black_college_or_university"),
				institutionIpedsTribalCollegeOrUniversity: getFromCommonField(v, "ResourceInstitution", "ipeds_metadata", "tribal_college_or_university"),
				institutionCarnegieClassification2025: getFromCommonField(v, "ResourceInstitution", "carnegie_metadata", "classification2025"),
			}
			return p
		}, {})
	} catch(e){
		console.log(e)
	}

	return {}
}

const EPSCOR_STATES = [
	"AL", // Alabama
	"AK", // Alaska
	"AR", // Arkansas
	"DE", // Delaware
	"GU", // Guam
	"HI", // Hawaii
	"ID", // Idaho
	"IA", // Iowa
	"KS", // Kansas
	"KY", // Kentucky
	"LA", // Louisiana
	"ME", // Maine
	"MS", // Mississippi
	"MT", // Montana
	"NE", // Nebraska
	"NV", // Nevada
	"NH", // New Hampshire
	"NM", // New Mexico
	"ND", // North Dakota
	"OK", // Oklahoma
	"PR", // Puerto Rico
	"RI", // Rhode Island
	"SC", // South Carolina
	"SD", // South Dakota
	"VI", // U.S. Virgin Islands
	"VT", // Vermont
	"WV", // West Virginia
	"WY"  // Wyoming
];

const PROJECT_COMMON_FIELDS = [
	"MajorFieldOfScience",
	"BroadFieldOfScience",
	"DetailedFieldOfScience",
	"ProjectInstitution.name",
	"ProjectInstitution.state",
	"ProjectInstitution.ipeds_metadata.website_address",
	"ProjectInstitution.ipeds_metadata.historically_black_college_or_university",
	"ProjectInstitution.ipeds_metadata.tribal_college_or_university",
]

const RESOURCE_COMMON_FIELDS = [
	"ResourceInstitution.name",
	"ResourceInstitution.state",
	"ResourceInstitution.ipeds_metadata.website_address",
	"ResourceInstitution.ipeds_metadata.historically_black_college_or_university",
	"ResourceInstitution.ipeds_metadata.tribal_college_or_university",
  "ResourceInstitution.ipeds_metadata.website_address",
	"ResourceInstitution.carnegie_metadata.classification2025"
]

const getFromCommonField = (data, ...field) => {
	const commonKeys = ['CommonFields', 'hits', 'hits', 0, '_source']
	return recurseObject(data, ...commonKeys, ...field);
}

const recurseObject = (obj, ...path) => {
	return path.reduce((o, key) => {
		if (o && o.hasOwnProperty(key)) {
			return o[key];
		}
		return undefined;
	}, obj);
}

[
	"American Museum of Natural History",
	"Arizona State University",
	"California Institute of Technology",
	"California State University, San Bernardino",
	"Carleton College",
	"Center for Research and Advanced Studies of the National Polytechnic Institute",
	"Clemson University",
	"Colgate University",
	"College of New Jersey",
	"Duke University",
	"Fermi National Accelerator Laboratory",
	"Florida Agricultural and Mechanical University",
	"Florida International University",
	"Florida State University",
	"Franklin & Marshall College",
	"Fullerton College",
	"George Washington University",
	"Georgia Institute of Technology",
	"Georgia State University",
	"Great Plains Network",
	"Harrisburg University of Science and Technology",
	"Humboldt State University",
	"Indiana University",
	"Jackson State University",
	"Kansas State University",
	"Kent State University",
	"Lafayette College",
	"Langston University",
	"Lehigh University",
	"Louisiana State University",
	"Louisiana State University Health Sciences Center New Orleans",
	"Massachusetts Green High Performance Computing Center",
	"Michigan State University",
	"Montana State University",
	"Nevada System of Higher Education",
	"New Mexico State University",
	"New York University",
	"North Carolina State University",
	"Old Dominion University",
	"Oral Roberts University",
	"Pennsylvania State University",
	"Portland State University",
	"Purdue University West Lafayette",
	"Rhodes College",
	"San Diego State University",
	"Southern Illinois University Edwardsville",
	"Swarthmore College",
	"Syracuse University",
	"São Paulo State University",
	"Tennessee Technological University",
	"Texas Advanced Computing Center",
	"Tufts University",
	"Universidade Estadual Paulista (Unesp)",
	"University of Alabama",
	"University of Alabama in Huntsville",
	"University of Arkansas at Little Rock",
	"University of California, Merced",
	"University of California, Riverside",
	"University of California, San Diego",
	"University of Chicago",
	"University of Cincinnati",
	"University of Colorado Boulder",
	"University of Colorado Denver",
	"University of Connecticut",
	"University of Hawaii System",
	"University of Illinois Chicago",
	"University of Illinois Urbana-Champaign",
	"University of Illinois at Chicago",
	"University of Maine System",
	"University of Michigan",
	"University of Michigan–Ann Arbor",
	"University of Missouri",
	"University of Montana",
	"University of Nebraska System",
	"University of Nebraska–Lincoln",
	"University of North Dakota",
	"University of Notre Dame",
	"University of Puerto Rico-Mayaguez",
	"University of South Dakota",
	"University of Southern California",
	"University of Tennessee at Chattanooga",
	"University of Utah",
	"University of Washington",
	"University of Wisconsin-Eau Claire",
	"University of Wisconsin-La Crosse",
	"University of Wisconsin-Madison",
	"University of Wisconsin-Milwaukee",
	"University of Wisconsin–Eau Claire",
	"University of Wisconsin–La Crosse",
	"University of Wisconsin–Madison",
	"University of Wisconsin–Milwaukee",
	"University of Wyoming",
	"Villanova University",
	"Wayne State University",
	"Wichita State University"
]