<!-- Adapted from Cool-admin Vue 8.x login/components/pic-captcha.vue, MIT. See COOL-ADMIN-LICENSE.txt. -->
<script setup lang="ts">
defineProps<{ image: string; loading: boolean; disabled?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
</script>
<template>
  <button class="pic-captcha" type="button" aria-label="刷新图片验证码" title="点击刷新验证码" :disabled="loading || disabled" @click="emit('refresh')">
    <img v-if="image" :src="image" alt="图片验证码"/>
    <span v-else>{{ loading ? '加载中…' : '刷新验证码' }}</span>
  </button>
</template>
<style scoped>
.pic-captcha { display:flex; align-items:center; justify-content:center; flex:0 0 130px; height:45px; width:130px; border:0; padding:0; border-radius:6px; background:#f3f1fa; color:#594185; cursor:pointer; }
.pic-captcha img { display:block; width:100%; max-height:45px; object-fit:contain; }
.pic-captcha:disabled { cursor:default; opacity:.65; }
.pic-captcha:focus-visible { outline:2px solid #7660bf; outline-offset:2px; }
</style>
