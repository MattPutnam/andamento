<script setup lang="ts">
import { withBase } from "vitepress";
import { patterns, slug, specCode } from "../../examples/patterns";

const groups = [...new Set(patterns.map((p) => p.group))].map((g) => ({ name: g, items: patterns.filter((p) => p.group === g) }));
</script>

<template>
  <div v-for="g in groups" :key="g.name">
    <h2 :id="g.name.toLowerCase().replace(/[^a-z]+/g, '-')">{{ g.name }}</h2>
    <div class="ex-gallery">
      <figure v-for="p in g.items" :key="p.title" class="ex-pattern">
        <img :src="withBase(`/examples/patterns-${slug(p)}.svg`)" :alt="`${p.title} pattern`" loading="lazy" />
        <figcaption>
          <strong>{{ p.title }}</strong>
          <code>{{ specCode(p.spec) }}</code>
          <span v-html="p.note.replace(/`([^`]+)`/g, '<code>$1</code>')" />
        </figcaption>
      </figure>
    </div>
  </div>
</template>
