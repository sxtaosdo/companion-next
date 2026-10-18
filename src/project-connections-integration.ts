import { shallowRef } from 'vue'
import type { ProjectConnectionsProvider } from './domain/project-connections'
/** Normal workspace only; registration itself never executes an operation. */
export const projectConnectionsProvider=shallowRef<ProjectConnectionsProvider|null>(null)
