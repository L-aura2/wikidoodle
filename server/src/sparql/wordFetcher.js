const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

export async function fetchWordsForCategory(category) {
    const query = buildQuery(category)
    if (!query) throw new Error(`Unknown theme: ${category}`)

    return await runQuery(query)
}

export async function validateCustomTheme(wikidataId) {
    const query = `
        SELECT ?label WHERE {
            ?item wdt:P31 wd:${wikidataId}.
            ?item rdfs:label ?label.
            FILTER(LANG(?label) = "en")
        }
        LIMIT 30
    `
    const results = await runQuery(query)
    return results // if length >= 25 → valid
}

export async function fetchHintsForWord(word) {
    const query = `
        SELECT ?description WHERE {
            ?item rdfs:label ?label.
            FILTER(LCASE(?label) = LCASE("${word}"))
            ?item schema:description ?description.
            FILTER(LANG(?description) = "en")
        }
        LIMIT 3
    `
    return await runQuery(query, 'description')
}

async function runQuery(query, field = 'label') {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/sparql-results+json',
            'User-Agent': 'Wikidoodle/1.0 (https://github.com/L-aura2/wikidoodle; laura.debaets2@student.odisee.be)',
        }
    })


    if (!response.ok) {
        throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/sparql-results+json')) {
        throw new Error(`Unexpected response format: ${contentType}`)
    }


    const data = await response.json()
    return data.results.bindings
        .map(binding => binding[field]?.value)
        .filter(Boolean)
}
// export async function searchWikidataConcept(term) {
//     const query = `
//         SELECT ?item ?itemLabel WHERE {
//             ?item rdfs:label "${term}"@en.
//             SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
//         }
//         LIMIT 5
//     `
//
//     const results = await runQueryFull(query)
//     return results
// }
//
function buildQuery(category) {
    const queries = {
        animals: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q16521.
                ?item wdt:P105 wd:Q7432.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        countries: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q6256.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        cities: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q515.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        fruit: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q3314483.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        vegetables: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q11004.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        sports: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q31629.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        instruments: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q34379.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        planets: `
            SELECT ?label WHERE {
                { ?item wdt:P31 wd:Q634. } UNION { ?item wdt:P31 wd:Q2. }
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        professions: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q28640.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        drinks: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q40050.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        summer: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q46970.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        vehicles: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q42889.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        colors: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q1075.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        buildings: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q41176.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        insects: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q10850.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
    }

    return queries[category] ?? null
}