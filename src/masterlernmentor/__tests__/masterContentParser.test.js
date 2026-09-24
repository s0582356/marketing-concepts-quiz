import { describe, expect, it } from 'vitest'
import { parseInline, parseMasterContent } from '../masterContentParser.js'

describe('parseMasterContent', () => {
  it('parst Überschriften mit Level', () => {
    const blocks = parseMasterContent('## 1.1 Der Marketingbegriff\n\n### Definition')
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2, text: '1.1 Der Marketingbegriff' })
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 3, text: 'Definition' })
  })

  it('parst eine Pipe-Tabelle mit Trennzeile (Test 13/23-nah: Tabellen)', () => {
    const blocks = parseMasterContent('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |')
    expect(blocks[0].type).toBe('table')
    expect(blocks[0].header).toEqual(['A', 'B'])
    expect(blocks[0].rows).toEqual([['1', '2'], ['3', '4']])
  })

  it('parst einen mehrzeiligen Blockquote (Merksatz-Box) als eigenen Block', () => {
    const blocks = parseMasterContent('> **SO MERKST DU DIR DAS**\n> Ein Beispieltext.\n> **Merksatz:** *Kurz und knapp.*')
    expect(blocks[0].type).toBe('blockquote')
    expect(blocks[0].lines).toHaveLength(3)
  })

  it('parst eine Liste inkl. eingerückter Fortsetzungszeile als ein Element', () => {
    const blocks = parseMasterContent('- **Punkt eins:** Erster Satz,\n  zweiter Halbsatz auf neuer Zeile.\n- Punkt zwei')
    expect(blocks[0].type).toBe('list')
    expect(blocks[0].items).toHaveLength(2)
    expect(blocks[0].items[0]).toContain('zweiter Halbsatz')
  })

  it('erkennt den [ABBILDUNG: ...]-Marker als eigenen Blocktyp (Test 23: VisualAsset-Slot)', () => {
    const blocks = parseMasterContent('## 1.5 Marketingmix\n\n[ABBILDUNG: Marketinginstrumente und Marketingmix (1.5)]\n\nText danach.')
    const visualBlock = blocks.find((b) => b.type === 'visualAsset')
    expect(visualBlock).toBeDefined()
    expect(visualBlock.label).toContain('Marketinginstrumente')
  })

  it('fasst normale Absätze zusammen', () => {
    const blocks = parseMasterContent('Erster Satz.\nZweiter Satz derselben Zeile.\n\nNeuer Absatz.')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].type).toBe('paragraph')
    expect(blocks[0].text).toBe('Erster Satz. Zweiter Satz derselben Zeile.')
  })

  it('gibt bei leerem Text ein leeres Array zurück, ohne zu crashen', () => {
    expect(parseMasterContent('')).toEqual([])
    expect(parseMasterContent(undefined)).toEqual([])
  })
})

describe('parseInline', () => {
  it('erkennt fett und kursiv getrennt von normalem Text', () => {
    const segments = parseInline('Normal **fett** und *kursiv* Text.')
    expect(segments).toEqual([
      { type: 'text', text: 'Normal ' },
      { type: 'bold', text: 'fett' },
      { type: 'text', text: ' und ' },
      { type: 'italic', text: 'kursiv' },
      { type: 'text', text: ' Text.' },
    ])
  })

  it('gibt reinen Text unverändert als ein Segment zurück', () => {
    expect(parseInline('Nur Text')).toEqual([{ type: 'text', text: 'Nur Text' }])
  })
})
