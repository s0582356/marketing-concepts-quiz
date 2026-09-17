import { describe, expect, it } from 'vitest'
import { fingerprintFile } from '../fingerprint.js'

function jsonFile(name, data) {
  return new File([JSON.stringify(data)], name, { type: 'application/json' })
}

describe('fingerprintFile: kanonische Content-Identität (Codex MAJOR_FIX-Grundlage)', () => {
  it('liefert für identische Bytes einen identischen Fingerprint', async () => {
    const data = [{ question: 'Stabil?', options: ['A', 'B'], correctAnswer: 'A' }]
    const first = await fingerprintFile(jsonFile('a.json', data))
    const second = await fingerprintFile(jsonFile('a.json', data))
    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it('liefert für identische Bytes unter einem anderen Dateinamen denselben Fingerprint - der Dateiname beeinflusst die Identität nicht', async () => {
    const data = [{ question: 'Stabil?', options: ['A', 'B'], correctAnswer: 'A' }]
    const asA = await fingerprintFile(jsonFile('basics.json', data))
    const asB = await fingerprintFile(jsonFile('basics_kopie_anderer_name.json', data))
    expect(asA).toBe(asB)
  })

  it('liefert für unterschiedliche Bytes einen unterschiedlichen Fingerprint', async () => {
    const first = await fingerprintFile(jsonFile('a.json', [{ question: 'A?', options: ['A', 'B'], correctAnswer: 'A' }]))
    const second = await fingerprintFile(jsonFile('a.json', [{ question: 'B?', options: ['A', 'B'], correctAnswer: 'A' }]))
    expect(first).not.toBe(second)
  })
})
