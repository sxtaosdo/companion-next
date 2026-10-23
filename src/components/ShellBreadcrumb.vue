<!-- Adapted from Cool-admin Vue 8.x route-nav.vue (MIT); see src/login/COOL-ADMIN-LICENSE.txt.
     Display hierarchy only: upstream breadcrumbs do not configure navigation. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { breadcrumbLabels } from '../domain/shell-navigation'
const route=useRoute(), labels=computed(()=>breadcrumbLabels(route))
</script>
<template><el-breadcrumb class="shell-breadcrumb breadcrumb" separator="/" aria-label="当前位置"><el-breadcrumb-item v-for="(label,index) in labels" :key="index" :class="{'parent-crumb':index<labels.length-1}">{{label}}</el-breadcrumb-item></el-breadcrumb></template>
<style scoped>.shell-breadcrumb{line-height:1.5;min-width:0}@media(max-width:600px){.parent-crumb{display:none}}</style>
