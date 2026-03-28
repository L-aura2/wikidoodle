import { fetchWordsForCategory } from './wordFetcher.js'

const woorden = await fetchWordsForCategory('dieren')
console.log(woorden)