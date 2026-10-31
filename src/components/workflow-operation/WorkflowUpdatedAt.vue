<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'

const props = defineProps<{value?: string | null}>()
const now = ref(Date.now())
const timestamp = computed(() => {
  if (!props.value || !props.value.trim()) return null
  const parsed = Date.parse(props.value)
  return Number.isFinite(parsed) ? parsed : null
})
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) =>
  `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const text = computed(() => {
  if (timestamp.value === null) return '未提供'
  const age = Math.max(0, now.value - timestamp.value)
  if (age < 60_000) return '刚刚'
  if (age < 3_600_000) return `${Math.floor(age / 60_000)}分钟前`
  if (age < 86_400_000) return `${Math.floor(age / 3_600_000)}小时前`
  if (age < 604_800_000) return `${Math.floor(age / 86_400_000)}天前`
  return localDate(new Date(timestamp.value))
})

const title = computed(() => {
  if (timestamp.value === null) return undefined
  const date = new Date(timestamp.value)
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const absolute = Math.abs(offset)
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
})

watch(() => props.value, () => { now.value = Date.now() }, {flush: 'sync'})
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => { now.value = Date.now() }, 1_000)
})
onUnmounted(() => {
  if (timer !== undefined) clearInterval(timer)
})
</script>

<template><span :title="title">{{ text }}</span></template>
