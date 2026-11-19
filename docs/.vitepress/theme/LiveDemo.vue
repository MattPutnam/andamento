<script setup lang="ts">
import { computed, ref } from "vue";
import { TileLayout, coverStyle } from "@andamento/vue";
import type { LayoutOptions, TilingSpec } from "@andamento/core";
import { photos } from "../../examples/shared";

/** A live `<TileLayout>` (the Vue binding): switch pattern, gap and corners, and watch it animate. */
const props = withDefaults(defineProps<{ count?: number; height?: number }>(), { count: 24, height: 150 });

const tilings: { name: string; spec: TilingSpec; origin?: boolean }[] = [
  { name: "Hexagons", spec: { type: "hexagonal", size: 30, orientation: "pointy" } },
  { name: "Herringbone", spec: { type: "herringbone", length: 64, width: 32 } },
  { name: "Grid", spec: { type: "grid", width: 48, height: 36 } },
  { name: "Cairo", spec: { type: "cairo", size: 46 } },
  { name: "Triangles", spec: { type: "triangular", size: 50 } },
  { name: "Penrose", spec: { type: "penrose", size: 30, variant: "rhombs" }, origin: true },
  { name: "Hats", spec: { type: "hat", size: 34 }, origin: true },
  { name: "Mondrian", spec: { type: "mondrian", minSize: 34, maxSize: 100, splitChance: 0.4, snap: 6, seed: 3 } },
];

const pick = ref(0);
const gap = ref(3);
const radius = ref(4);
const relief = ref(true);
const images = photos(props.count);

const options = computed<LayoutOptions>(() => {
  const t = tilings[pick.value]!;
  return {
    region: { x: 0, y: 0, width: 260, height: props.height },
    tiling: t.spec,
    gap: gap.value,
    margin: gap.value,
    cornerRadius: radius.value,
    ...(t.origin ? { origin: { x: 130, y: props.height / 2 } } : {}),
  };
});
</script>

<template>
  <div class="live-demo">
    <div class="live-controls">
      <div class="live-tilings" role="group" aria-label="Pattern">
        <button v-for="(t, i) in tilings" :key="t.name" :aria-pressed="pick === i" @click="pick = i">{{ t.name }}</button>
      </div>
      <label>Gap <input v-model.number="gap" type="range" min="0" max="10" step="0.5" /></label>
      <label>Corners <input v-model.number="radius" type="range" min="0" max="16" step="1" /></label>
      <label><input v-model="relief" type="checkbox" /> Relief</label>
    </div>
    <TileLayout
      :options="options"
      background="#e9e3d8"
      :relief="relief ? { shadow: 1.5 } : undefined"
      animate
      navigable
      aria-label="Example photos"
      class="live-layout"
    >
      <img v-for="(src, i) in images" :key="i" :src="src" alt="" :style="coverStyle" />
    </TileLayout>
  </div>
</template>

<style scoped>
.live-demo {
  margin: 24px 0;
  padding: 16px;
  border: 1px solid var(--ex-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}
.live-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  align-items: center;
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.live-tilings {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}
.live-tilings button {
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 13px;
  color: var(--vp-c-text-1);
}
.live-tilings button[aria-pressed="true"] {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
}
.live-controls label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.live-layout {
  border-radius: 10px;
  overflow: hidden;
}
</style>
