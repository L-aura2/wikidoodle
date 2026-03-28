const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'



export async function fetchWordsForCategory(category) {
    const query = buildQuery(category)
    if (!query) throw new Error(`Onbekend thema: ${category}`)

    return await runQuery(query)
}

export async function validateCustomTheme(wikidataId) {
    const query = `
        SELECT ?label WHERE {
            ?item wdt:P31 wd:${wikidataId}.
            ?item rdfs:label ?label.
            FILTER(LANG(?label) = "nl")
        }
        LIMIT 30
    `
    const results = await runQuery(query)
    return results // als length >= 25 → geldig
}

export async function fetchHintsForWord(word) {
    const query = `
        SELECT ?description WHERE 
            ?item rdfs:label "${word}"@en.
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
            'User-Agent': 'Wikidoodle/1.0 (wikidoodle@example.com)'
        }
    })

    const data = await response.json()
    return data.results.bindings
        .map(binding => binding[field]?.value)
        .filter(Boolean)
}

function buildQuery(category) {
    const queries = {
        dieren: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q16521.
                ?item wdt:P105 wd:Q7432.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        landen: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q6256.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        steden: `
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
        groenten: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q11004.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        sporten: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q31629.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        muziekinstr: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q34379.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        planeten: `
            SELECT ?label WHERE {
                { ?item wdt:P31 wd:Q634. } UNION { ?item wdt:P31 wd:Q2satellites. }
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        beroepen: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q28640.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        dranken: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q40050.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        zomer: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q46970.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        voertuigen: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q42889.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        kleuren: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q1075.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        gebouwen: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q41176.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
        insecten: `
            SELECT ?label WHERE {
                ?item wdt:P31 wd:Q10850.
                ?item rdfs:label ?label.
                FILTER(LANG(?label) = "en")
            } LIMIT 50`,
    }

    return queries[category] ?? null
}