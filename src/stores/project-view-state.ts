import {ref} from 'vue'
import {defineStore} from 'pinia'
// UI-only app-session state; no credentials or backend operation is cached.
export const useProjectViewState=defineStore('project-view-state',()=>({query:ref(''),filter:ref('all')}))
