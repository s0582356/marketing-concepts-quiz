// Zentrale Lernbibliotheken-Schicht: mehrere private JSON-Dateien auf einmal
// laden, inhaltsbasiert als MC-Fragenbank oder Trainingseinheiten-Bank
// erkennen und getrennt in einer Registry halten. Bank-Identität ist der
// kryptographische Content-Fingerprint (SHA-256 der Dateibytes), NICHT der
// Dateiname - die privaten Marketing-JSONs besitzen kein eingebettetes
// Bank-ID-Feld (anders als packageId in der PWL-App) und werden dafür nicht
// verändert. Der Dateiname ist reines Anzeige-/Alias-Metadatum:
//   - gleicher Inhalt + gleicher Name       -> eine Bank (Key kollidiert)
//   - gleicher Inhalt + anderer Name        -> eine Bank, bestehender
//                                              Anzeigename bleibt erhalten
//   - anderer Inhalt + gleicher Name        -> zwei getrennte Banken (Keys
//                                              unterscheiden sich); kein
//                                              stilles Überschreiben
//   - anderer Inhalt + anderer Name         -> zwei getrennte Banken
// Ohne Migration der JSON-Dateien lässt sich "dieselbe logische Bank, jetzt
// aktualisiert" nicht sicher von "zufällige Namenskollision" unterscheiden -
// ein erneuter Import unter gleichem Namen aber anderem Inhalt ersetzt die
// bestehende Bank deshalb bewusst NICHT mehr automatisch, sondern bleibt als
// zusätzliche, technisch unterscheidbare Bank erhalten (sichtbar an
// steigender Banken-/Fragenzahl in der Statusanzeige).
import { fingerprintFile, hashText } from './fingerprint.js'
import { validateMcQuestions, looksLikeMcQuestions } from './mcQuestionValidator.js'
import { TRAINING_METHODS, validateTrainingUnits } from '../methodtrainer/trainingUnits.js'

function looksLikeTrainingUnits(data) {
  return Array.isArray(data)
    && data.length > 0
    && data.every((entry) => entry && typeof entry === 'object' && TRAINING_METHODS.includes(entry.method))
}

export function classifyLibraryFile(parsedData) {
  if (looksLikeTrainingUnits(parsedData)) {
    return { type: 'trainingUnits', units: validateTrainingUnits(parsedData) }
  }
  if (looksLikeMcQuestions(parsedData)) {
    return { type: 'mc', questions: validateMcQuestions(parsedData) }
  }
  throw new Error('Unbekanntes JSON-Format: weder MC-Fragen noch Trainingseinheiten erkannt.')
}

// Liest mehrere Dateien parallel, validiert jede einzeln und trennt Erfolge
// von Fehlern - eine defekte Datei blockiert die anderen gültigen Dateien nie.
// `existingFingerprints` (optional): Fingerprints bereits in der Registry
// geladener Banken (aus einem früheren Importvorgang) - wird zusätzlich zu
// Duplikaten *innerhalb* dieser Auswahl geprüft, damit ein später erneut
// ausgewählter, inhaltlich bereits bekannter Datei-Inhalt korrekt als
// Duplikat gemeldet wird statt seine Fragen nochmals in den Pool zu mergen.
export async function readLibraryFiles(files, existingFingerprints = new Set()) {
  const results = await Promise.all([...files].map(async (file, index) => {
    try {
      const [text, fingerprint] = await Promise.all([file.text(), fingerprintFile(file)])
      const parsed = JSON.parse(text)
      const classified = classifyLibraryFile(parsed)
      return { index, fileName: file.name, fingerprint, ...classified }
    } catch (error) {
      return { index, fileName: file.name, error: error.message || 'Datei konnte nicht gelesen werden.' }
    }
  }))

  const mcBanks = []
  const trainingUnitBanks = []
  const errors = []
  const duplicates = []
  const seenFingerprints = new Set(existingFingerprints)

  results.sort((left, right) => left.index - right.index).forEach((result) => {
    if (result.error) {
      errors.push({ fileName: result.fileName, reason: result.error })
      return
    }
    if (seenFingerprints.has(result.fingerprint)) {
      duplicates.push(result.fileName)
      return
    }
    seenFingerprints.add(result.fingerprint)

    if (result.type === 'mc') {
      mcBanks.push({ fileName: result.fileName, fingerprint: result.fingerprint, questions: result.questions })
    } else {
      trainingUnitBanks.push({ fileName: result.fileName, fingerprint: result.fingerprint, units: result.units })
    }
  })

  return { mcBanks, trainingUnitBanks, errors, duplicates }
}

// Fügt importierte Banken in die Registry ein. Schlüssel ist der Content-
// Fingerprint (kanonische technische Identität), NICHT der Dateiname:
//   - unbekannter Fingerprint  -> neue Bank wird angelegt
//   - bekannter Fingerprint    -> derselbe Inhalt ist bereits geladen; der
//                                 bestehende Eintrag (inkl. seines
//                                 ursprünglichen Anzeigenamens) bleibt
//                                 bestehen statt dupliziert oder umbenannt zu
//                                 werden
// Zwei Banken mit unterschiedlichem Inhalt aber gleichem Dateinamen erhalten
// unterschiedliche Fingerprints und landen deshalb unter unterschiedlichen
// Keys - keine der beiden wird still überschrieben.
export function addLibraryBanks(banksByFingerprint, importedBanks) {
  return importedBanks.reduce((registry, bank) => {
    const existing = registry[bank.fingerprint]
    return {
      ...registry,
      [bank.fingerprint]: existing ? { ...bank, fileName: existing.fileName } : bank,
    }
  }, { ...banksByFingerprint })
}

// Sortiert Banken für einen deterministischen Merge-Pool ausschließlich nach
// Content-Fingerprint - NICHT nach Anzeigename. Der Dateiname ist reines
// Alias-Metadatum (siehe Kopfkommentar) und darf die Poolreihenfolge nicht
// beeinflussen: Quiz und Mixed Exam speichern rohe Positions-Indizes in den
// gemergten Pool (runQuestionIndices/poolIndices) und lösen sie nach einem
// Reload ausschließlich über den Library-Set-Fingerprint wieder auf. Der
// Set-Fingerprint hängt selbst nur von den (sortierten) Bank-Fingerprints ab,
// nicht von Dateinamen - identische Bank-Inhalte unter geänderten Dateinamen
// (z. B. eine umbenannte Kopie derselben Datei) müssen deshalb zwingend
// denselben Merge-Pool in derselben Reihenfolge ergeben, sonst zeigen
// gespeicherte Indizes nach dem Reimport auf andere Fragen/Einheiten als
// ursprünglich gespeichert (Codex Delta Review, Finding M-1).
function sortedBanks(banksByFingerprint) {
  return Object.values(banksByFingerprint).sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
}

export function mergeMcQuestions(mcBanksByFingerprint) {
  return sortedBanks(mcBanksByFingerprint).flatMap((bank) => bank.questions)
}

export function mergeTrainingUnits(trainingUnitBanksByFingerprint) {
  return sortedBanks(trainingUnitBanksByFingerprint).flatMap((bank) => bank.units)
}

// Rein technischer Kombi-Fingerprint aus den Fingerprints der aktuell
// geladenen MC-Banken (das sind bereits die Registry-Keys) - kein Frage-/
// Antworttext, kompatibel mit dem bestehenden SHA-256-Format des
// Fortschrittsspeichers (progressStorage.js).
export async function combinedMcFingerprint(mcBanksByFingerprint) {
  const parts = Object.keys(mcBanksByFingerprint).sort()
  return hashText(parts.join('|'))
}

// Analog zu combinedMcFingerprint, für die separat gehaltene Trainingseinheiten-
// Registry - eigene, von der MC-Bank-Identität unabhängige technische Identität
// für den Methodentrainer-Resume (siehe learningProgress.js).
export async function combinedTrainingFingerprint(trainingUnitBanksByFingerprint) {
  const parts = Object.keys(trainingUnitBanksByFingerprint).sort()
  return hashText(parts.join('|'))
}
