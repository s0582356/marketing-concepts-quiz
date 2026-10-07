import { describe, expect, it } from 'vitest'
import { shuffledIndices } from '../shuffle.js'

describe('shuffledIndices', () => {
  it('liefert immer eine vollständige Permutation der Original-Indizes', () => {
    for (let run = 0; run < 200; run++) {
      expect([...shuffledIndices(4)].sort()).toEqual([0, 1, 2, 3])
    }
    expect(shuffledIndices(0)).toEqual([])
    expect(shuffledIndices(1)).toEqual([0])
  })

  it('ist mit injiziertem Zufall deterministisch', () => {
    const sequence = [0.1, 0.9, 0.5]
    const make = () => { let i = 0; return () => sequence[i++ % sequence.length] }
    expect(shuffledIndices(4, make())).toEqual(shuffledIndices(4, make()))
  })

  it('bindet die richtige Antwort strukturell an keine Position (Test 26)', () => {
    // Ausgangslage wie in den Fragenbanken: richtige Antwort steht im JSON
    // IMMER auf Original-Index 0. Über viele Läufe muss sie an allen vier
    // angezeigten Positionen ungefähr gleich häufig landen.
    const runs = 20000
    const positionCounts = [0, 0, 0, 0]
    for (let run = 0; run < runs; run++) positionCounts[shuffledIndices(4).indexOf(0)]++

    // Erwartung 25 % je Position; Toleranz +-3 Prozentpunkte liegt bei n=20000
    // weit über 9 Standardabweichungen - kein flakiger Test.
    positionCounts.forEach((count) => {
      expect(count / runs).toBeGreaterThan(0.22)
      expect(count / runs).toBeLessThan(0.28)
    })
  })

  it('erzeugt alle 24 Reihenfolgen von vier Optionen', () => {
    const seen = new Set()
    for (let run = 0; run < 5000; run++) seen.add(shuffledIndices(4).join(''))
    expect(seen.size).toBe(24)
  })
})
