<script setup lang="ts">
import Figure from "./Figure.vue";
/** A row of example pictures, side by side. */
defineProps<{ items: { name: string; caption?: string }[]; columns?: number }>();
</script>

<template>
  <div class="ex-figures" :style="{ '--ex-columns': columns ?? items.length }">
    <Figure v-for="f in items" :key="f.name" :name="f.name" :caption="f.caption" />
  </div>
</template>
