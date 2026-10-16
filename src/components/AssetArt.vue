<script setup lang="ts">
import type { ResourceItem } from '../domain/contracts'
defineProps<{ kind: ResourceItem['illustration']; large?: boolean }>()
</script>
<template>
  <div class="asset-art" :class="{ large }" aria-hidden="true">
    <svg v-if="kind === 'gem'" viewBox="0 0 120 120"><defs><linearGradient id="gem-fill" x2="1" y2="1"><stop stop-color="#c7d4f1"/><stop offset="1" stop-color="#717998"/></linearGradient></defs><path d="m60 16 28 20 10 44-38 29-37-29 10-43z" fill="url(#gem-fill)" stroke="#dbe4ff" stroke-width="2"/><path d="m60 16 4 39 24-19M33 37l31 18 34 25M23 80l41-25-4 54M64 55l-31-18" fill="none" stroke="#e1e8ff" stroke-width="1.5"/><path d="m43 66 16-12-9 27z" fill="#f5f8ff"/><path d="m43 113 17 6 17-6" fill="none" stroke="#bea066" stroke-width="2"/></svg>
    <svg v-else-if="kind === 'coin'" viewBox="0 0 120 120"><circle cx="60" cy="60" r="43" fill="#b58d40" stroke="#ead293" stroke-width="4"/><circle cx="60" cy="60" r="34" fill="#cfa756" stroke="#8e6c34" stroke-width="2"/><path d="m60 29 8 23 24 1-19 15 6 24-19-14-20 14 7-24-20-15 25-1z" fill="#f4da92" stroke="#8e6c34" stroke-width="2"/></svg>
    <svg v-else-if="kind === 'sword'" viewBox="0 0 120 120"><path d="m81 12 13 19-44 54-16-16z" fill="#b6c9e5" stroke="#e1eafa" stroke-width="2"/><path d="M83 24 43 72" stroke="#70829e" stroke-width="3"/><path d="m30 72 11 9-21 25-8-8z" fill="#978463"/><path d="m24 64 32 28" stroke="#c9ad61" stroke-width="7"/><circle cx="16" cy="105" r="7" fill="#c9ad61"/></svg>
    <svg v-else-if="kind === 'button'" viewBox="0 0 120 120"><rect x="10" y="41" width="100" height="39" rx="8" fill="#414a60" stroke="#9aa8bd" stroke-width="3"/><rect x="16" y="47" width="88" height="26" rx="4" fill="none" stroke="#b99d64"/><circle cx="60" cy="60" r="4" fill="#d6bb7b"/><path d="M20 60h20m40 0h20" stroke="#95a5be" stroke-width="2"/></svg>
    <svg v-else-if="kind === 'panel'" viewBox="0 0 120 120"><rect x="27" y="10" width="67" height="100" rx="9" fill="#424c63" stroke="#9aa6bf" stroke-width="3"/><rect x="33" y="18" width="55" height="84" rx="5" fill="none" stroke="#b09b69" stroke-width="1.5"/><path d="M42 38h35M42 50h35M42 62h26" stroke="#8492ac" stroke-width="2"/><path d="M50 91h20" stroke="#c4ad71" stroke-width="3"/></svg>
    <svg v-else viewBox="0 0 120 120"><rect x="30" y="30" width="60" height="60" rx="12" fill="none" stroke="#9fa9c4" stroke-width="2" stroke-dasharray="4 4"/><path d="M45 60h30M60 45v30" stroke="#9fa9c4" stroke-width="2"/></svg>
    <span v-if="large" class="art-caption">矢量占位 · 示例</span>
  </div>
</template>
