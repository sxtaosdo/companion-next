import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'

declare const projectOperationLease: unique symbol
/** Opaque identity token. Only the exact object returned by acquire can release it. */
export interface ProjectOperationLease { readonly [projectOperationLease]: true }

/** Same-Pinia mutation exclusion only; this is not a server or cross-tab lock. */
export const useProjectOperationLaneStore = defineStore('project-operation-lane', () => {
  const active = shallowRef<{ readonly lease: ProjectOperationLease; readonly label: string } | null>(null)
  const locked = computed(() => active.value !== null)
  const description = computed(() => active.value?.label ?? '')

  /** label must be a finite, internal action label, never provider/user text. */
  function acquire(label: string): ProjectOperationLease | null {
    if (active.value) return null
    const lease = Object.freeze({}) as ProjectOperationLease
    // Publish the holder atomically before synchronous observers can compete.
    active.value = { lease, label }
    return lease
  }

  function release(lease: ProjectOperationLease): boolean {
    if (!active.value || active.value.lease !== lease) return false
    active.value = null
    return true
  }

  return { locked, description, acquire, release }
})
