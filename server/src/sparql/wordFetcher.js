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
    const bindings = data.results.bindings

    // If the query selects both label and description, return objects
    if (bindings.length > 0 && bindings[0].label && bindings[0].description !== undefined) {
        return bindings.map(binding => ({
            label: binding.label?.value,
            description: binding.description?.value || ''
        })).filter(item => item.label)
    }

    // Otherwise, return array of the specified field
    return bindings
        .map(binding => binding[field]?.value)
        .filter(Boolean)
}

function buildQuery(category) {
    // Reusable filter snippet: must have an English Wikipedia article + minimum sitelinks
    // Raise MIN_SITELINKS for stricter results (10 = decent, 20 = well-known, 50 = famous)
    const popularityFilter = `
        ?item wikibase:sitelinks ?sitelinks .
        FILTER(?sitelinks >= 10)
        # Must have an English Wikipedia article
        ?article schema:about ?item ;
                 schema:inLanguage "en" ;
                 schema:isPartOf <https://en.wikipedia.org/> .
    `;

    const queries = {

        animals: `
            SELECT ?item ?label ?description WHERE {
              ?item wdt:P31 wd:Q16521 ;
                    wdt:P105 wd:Q7432 .
              ?item rdfs:label ?label .
              FILTER(LANG(?label) = "en")
              FILTER(!REGEX(?label, "\\\\("))
              OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
              ?item wikibase:sitelinks ?sitelinks .
              FILTER(?sitelinks >= 10)
              # Must have an English Wikipedia article
              ?article schema:about ?item ;
                 schema:inLanguage "en" ;
                 schema:isPartOf <https://en.wikipedia.org/> .
            }
            LIMIT 25`,

        countries: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q6256 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        cities: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q515 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                # Only cities with a population recorded (removes ghost towns, etc.)
                ?item wdt:P1082 ?population .
                FILTER(?population >= 100000)
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        fruit: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q3314483 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        vegetables: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q11004 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        sports: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q31629 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        instruments: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q34379 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        planets: `
            SELECT ?item ?label ?description WHERE {
                { ?item wdt:P31 wd:Q634. } UNION { ?item wdt:P31 wd:Q2. }
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        professions: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q28640 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        drinks: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q40050 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        summer: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q46970 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        vehicles: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q42889 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        colors: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q1075 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        buildings: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q41176 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,

        insects: `
            SELECT ?item ?label ?description WHERE {
                ?item wdt:P31 wd:Q1390 .
                ?item rdfs:label ?label .
                FILTER(LANG(?label) = "en")
                FILTER(!REGEX(?label, "\\\\("))
                OPTIONAL { ?item schema:description ?description. FILTER(LANG(?description) = "en") }
                ${popularityFilter}
            }
            ORDER BY DESC(?sitelinks)
            LIMIT 50`,
    };


    return queries[category] ?? null
}