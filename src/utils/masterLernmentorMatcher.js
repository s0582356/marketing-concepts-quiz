// Rein lokale, heuristische Erkennung, welche coreConcepts/optionalConcepts in
// einer frei getippten Antwort ungefähr vorkommen - KEINE KI/Cloud-API, KEINE
// exakte Klausurkorrektur. Dient ausschließlich als Lernhilfe (siehe
// Aufgabenstellung Abschnitt 17/18): grobes Erkennen von Kernpunkten, keine
// Bewertung, keine Note, kein Prozentwert einer "Richtigkeit".
//
// wordingMatchRequired=false wird respektiert, indem nie auf exakte
// Zeichenkettengleichheit geprüft wird, sondern auf Wortüberlappung
// (inkl. einfacher Nachsilzen-Toleranz für deutsche Flexionsformen).

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
  'und', 'oder', 'mit', 'von', 'zu', 'zum', 'zur', 'im', 'in', 'am', 'an', 'auf', 'für', 'ist',
  'sind', 'wird', 'werden', 'als', 'auch', 'bzw', 'sowie', 'sich', 'ein', 'nicht', 'kein',
  'durch', 'bei', 'über', 'unter', 'nach', 'vor', 'aus', 'dass', 'wie', 'so', 'nur', 'sehr',
])

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[.,;:!?()„"“”'’„»«\/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function significantWords(text) {
  return normalize(text)
    .split(' ')
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
}

// Sehr einfache Toleranz für deutsche Flexionsformen (Plural, Fälle,
// Verbendungen) - vergleicht die ersten 4 Zeichen bei ausreichend langen
// Wörtern statt exakter Gleichheit. Kein echter Stemmer, aber genug für eine
// Lernhilfe, die "erkannt vs. nicht erkannt" statt einer Note anzeigt.
function wordsMatch(a, b) {
  if (a === b) return true
  if (a.length >= 4 && b.length >= 4) return a.slice(0, 4) === b.slice(0, 4)
  return false
}

function phraseMatchesText(phrase, userWords) {
  const phraseWords = significantWords(phrase)
  if (phraseWords.length === 0) return false
  const matchedCount = phraseWords.filter((phraseWord) => userWords.some((userWord) => wordsMatch(phraseWord, userWord))).length
  const ratio = matchedCount / phraseWords.length
  return phraseWords.length === 1 ? matchedCount === 1 : ratio >= 0.6
}

function conceptMatches(concept, userWords) {
  const phrases = [concept.label, ...(concept.acceptedPhrases || [])]
  return phrases.some((phrase) => phraseMatchesText(phrase, userWords))
}

// Prüft eine Freitextantwort gegen eine einzelne Master-Lernmentor-Frage.
// Gibt nie ein binäres "richtig/falsch" zurück, sondern erkannte/nicht
// erkannte Konzepte getrennt für core/optional, plus neutrale Hinweistexte.
export function checkAnswer(question, userAnswerText) {
  const userWords = significantWords(userAnswerText)
  const hasAnswer = userWords.length > 0

  const coreResults = (question.coreConcepts || []).map((concept) => ({
    ...concept,
    matched: hasAnswer && conceptMatches(concept, userWords),
  }))
  const optionalResults = (question.optionalConcepts || []).map((concept) => ({
    ...concept,
    matched: hasAnswer && conceptMatches(concept, userWords),
  }))

  const matchedCoreCount = coreResults.filter((c) => c.matched).length
  const requirements = question.responseRequirements || {}
  const flexibility = question.answerFlexibility || {}

  // HARTE TRENNUNG (Codex Technical Red Team, Finding M-01): `minimumItems`,
  // `minimumExamples` und `minimumExamplesPerGroup` sind Anforderungen an den
  // FRAGEWORTLAUT (z.B. "nennen Sie 7 Punkte") - keine Aussage über die Anzahl
  // vorhandener `coreConcepts`-Objekte. Ein CoreConcept kann mehrere fachliche
  // Elemente zusammenfassen, daher ist coreConcepts.length oft kleiner als
  // minimumItems. Diese Felder werden deshalb NIE mit matchedCoreCount
  // verglichen, sondern ausschließlich als neutrale Selbstabgleich-Hinweise
  // ausgegeben - der Matcher kann nicht zuverlässig zählen, wie viele
  // semantisch verschiedene Punkte/Beispiele der Nutzer genannt hat, und
  // behauptet deshalb nie eine erkannte Anzahl für diese Felder.
  const notes = []
  if (requirements.minimumItems) {
    notes.push(`Die Aufgabenstellung verlangt mindestens ${requirements.minimumItems} Punkt${requirements.minimumItems === 1 ? '' : 'e'}/Element${requirements.minimumItems === 1 ? '' : 'e'}. Prüfe, ob du diese Anzahl vollständig genannt hast.`)
  }
  if (requirements.minimumExamples) {
    notes.push(`Die Aufgabenstellung verlangt mindestens ${requirements.minimumExamples} Beispiel${requirements.minimumExamples === 1 ? '' : 'e'}. Prüfe, ob du diese Anzahl genannt hast.`)
  }
  if (requirements.minimumExamplesPerGroup) {
    notes.push(`Die Aufgabenstellung verlangt mindestens ${requirements.minimumExamplesPerGroup} Beispiel${requirements.minimumExamplesPerGroup === 1 ? '' : 'e'} je Gruppe.`)
  }
  if (flexibility.equivalentOwnExamplesAllowed) {
    notes.push('Eigenes Beispiel bitte selbst mit der Musterlösung / dem Master abgleichen - ein eigenes, gleichwertiges Beispiel zählt auch dann, wenn es nicht wörtlich hier erkannt wurde.')
  }

  return {
    hasAnswer,
    coreConcepts: coreResults,
    optionalConcepts: optionalResults,
    matchedCoreCount,
    totalCoreCount: coreResults.length,
    // Ausschließlich gegen die tatsächlich vorhandenen coreConcepts ausgewertet
    // (nie gegen minimumItems) - siehe Kommentar oben.
    requiresAllCoreConcepts: Boolean(requirements.requiresAllCoreConcepts),
    allCoreConceptsMatched: coreResults.length === 0 || matchedCoreCount === coreResults.length,
    notes,
  }
}
