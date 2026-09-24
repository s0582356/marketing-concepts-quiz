<script setup>
// Rendert einen Master-Lernmentor-Textabschnitt (learningPhase.masterContent
// oder question.masterExcerpt) sicher lokal - kein v-html, keine externe
// Netzwerkabhängigkeit. [ABBILDUNG: ...]-Marker werden an ihrer Stelle durch
// den passenden VisualAssetSlot ersetzt, sofern ein visualAsset vorhanden ist.
import { computed } from 'vue'
import { parseInline, parseMasterContent } from './masterContentParser.js'
import VisualAssetSlot from './VisualAssetSlot.vue'

const props = defineProps({
  content: { type: String, default: '' },
  visualAssets: { type: Array, default: () => [] },
})

const blocks = computed(() => parseMasterContent(props.content))

// Ordnet [ABBILDUNG: ...]-Marker der Reihe nach den vorhandenen visualAssets
// des Topics zu (der Goldstandard enthält aktuell höchstens einen Marker pro
// Topic) - der rohe Mastertext selbst bleibt unverändert, nur die Anzeige
// ersetzt den Textmarker durch den Bild-Slot.
const visualAssetByBlockIndex = computed(() => {
  const map = new Map()
  let assetCursor = 0
  blocks.value.forEach((block, index) => {
    if (block.type === 'visualAsset') {
      map.set(index, props.visualAssets[assetCursor] ?? null)
      assetCursor++
    }
  })
  return map
})

function headingTag(level) {
  return `h${Math.min(6, Math.max(2, level))}`
}
</script>

<template>
  <div class="master-content">
    <template v-for="(block, index) in blocks" :key="index">
      <component :is="headingTag(block.level)" v-if="block.type === 'heading'">{{ block.text }}</component>

      <p v-else-if="block.type === 'paragraph'">
        <template v-for="(segment, sIndex) in parseInline(block.text)" :key="sIndex">
          <strong v-if="segment.type === 'bold'">{{ segment.text }}</strong>
          <em v-else-if="segment.type === 'italic'">{{ segment.text }}</em>
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>

      <ul v-else-if="block.type === 'list'">
        <li v-for="(item, iIndex) in block.items" :key="iIndex">
          <template v-for="(segment, sIndex) in parseInline(item)" :key="sIndex">
            <strong v-if="segment.type === 'bold'">{{ segment.text }}</strong>
            <em v-else-if="segment.type === 'italic'">{{ segment.text }}</em>
            <template v-else>{{ segment.text }}</template>
          </template>
        </li>
      </ul>

      <div v-else-if="block.type === 'table'" class="master-content-table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="(cell, cIndex) in block.header" :key="cIndex">{{ cell }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rIndex) in block.rows" :key="rIndex">
              <td v-for="(cell, cIndex) in row" :key="cIndex">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <blockquote v-else-if="block.type === 'blockquote'" class="master-content-memo">
        <p v-for="(line, lIndex) in block.lines" :key="lIndex">
          <template v-for="(segment, sIndex) in parseInline(line)" :key="sIndex">
            <strong v-if="segment.type === 'bold'">{{ segment.text }}</strong>
            <em v-else-if="segment.type === 'italic'">{{ segment.text }}</em>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </blockquote>

      <VisualAssetSlot
        v-else-if="block.type === 'visualAsset' && visualAssetByBlockIndex.get(index)"
        :asset-id="visualAssetByBlockIndex.get(index).assetId"
        :source-label="visualAssetByBlockIndex.get(index).sourceLabel"
      />
      <p v-else-if="block.type === 'visualAsset'" class="master-content-visual-fallback">{{ block.label }}</p>
    </template>
  </div>
</template>
