import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VisualAssetSlot from '../VisualAssetSlot.vue'

beforeEach(() => {
  window.localStorage.clear()
})

describe('VisualAssetSlot (Test 23)', () => {
  it('zeigt zunächst die unaufdringliche "lokal laden"-Meldung, kein erfundener Platzhalter', () => {
    const wrapper = mount(VisualAssetSlot, { props: { assetId: 'testfolie-1-5', sourceLabel: 'Marketinginstrumente (1.5)' } })
    expect(wrapper.text()).toContain('Originalabbildung lokal laden')
    expect(wrapper.text()).toContain('Marketinginstrumente (1.5)')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('zeigt das Bild nach lokaler Auswahl als object URL an, ohne localStorage zu berühren', async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem')
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    const wrapper = mount(VisualAssetSlot, { props: { assetId: 'testfolie-1-5', sourceLabel: 'Testfolie' } })

    const file = new File([new Uint8Array([1, 2, 3])], 'slide.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    expect(createObjectURLSpy).toHaveBeenCalledWith(file)
    expect(wrapper.find('img').attributes('src')).toBe('blob:mock-url')
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
