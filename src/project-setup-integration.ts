import { shallowRef } from 'vue'
import type { ProjectSetupProvider } from './domain/project-setup'
export const projectSetupProvider=shallowRef<ProjectSetupProvider|null>(null)
export function registerProjectSetupProvider(provider:ProjectSetupProvider){projectSetupProvider.value=provider}
