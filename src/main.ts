import { agentHandoffProvider } from './agent-handoff-integration'
import { createPreviewActionsProvider } from './adapters/preview-actions'
import { registerPreviewActionsProvider } from './preview-actions-integration'
import { createLogToolsProvider } from './adapters/log-tools'
import { registerLogToolsProvider } from './log-tools-integration'
import { createAiJobActionsProvider } from './adapters/ai-job-actions'
import { registerAiJobActionsProvider } from './ai-job-actions-integration'
import { createAiTaskCreationProvider } from './adapters/ai-task-creation'
import { registerAiTaskCreationProvider } from './ai-task-creation-integration'
import { createAiJobsReadProvider } from './adapters/ai-jobs-read'
import { registerAiJobsReadProvider } from './ai-jobs-read-integration'
import { createProjectSetupProvider } from './adapters/project-setup'
import { createLocalServiceOperationsProvider } from './adapters/local-service-operations'
import { registerLocalServiceOperationsProvider } from './local-service-operations-integration'
import { createToolPresetWriteProvider } from './adapters/tool-presets-write'
import { registerToolPresetWriteProvider } from './tool-presets-write-integration'
import { registerProjectSetupProvider } from './project-setup-integration'
import { createCreatorOperationsProvider } from './adapters/creator-operations'
import { isCompanionWorkspaceHost, registerCreatorOperationsProvider } from './creator-operations-integration'
import { createKnowledgeConversationProvider } from './adapters/knowledge-conversation'
import { isCompanionKnowledgeChatHost, registerKnowledgeConversationProvider } from './knowledge-conversation-integration'
import { createAiReferenceUploadProvider } from './adapters/ai-reference-upload'
import { registerAiReferenceUploadProvider } from './ai-reference-upload-integration'
import { createAiResourceSaveProvider } from './adapters/ai-resource-save'
import { isCompanionConfigEditHost, registerAiResourceSaveProvider } from './ai-resource-save-integration'
import { createAiResourceReadProvider } from './adapters/ai-resource-read'
import { registerAiResourceReadProvider } from './ai-resource-read-integration'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { createHostedImageReviewProvider } from './adapters/image-review'
import { registerImageReviewProvider } from './image-review-integration'
import { createKnowledgeReadProvider } from './adapters/knowledge-read'
import { registerKnowledgeReadProvider } from './knowledge-read-integration'
import { createToolPresetReadProvider } from './adapters/tool-presets-read'
import { registerToolPresetReadProvider } from './tool-presets-read-integration'
import { createCompanionEventProvider } from './adapters/companion-events'
import { createCompanionBrowserProvider } from './adapters/companion-browser'
import { isCompanionReadHost, registerCompanionBrowserProvider } from './companion-browser-integration'
// Only explicitly identified local builds register these providers. The normal workspace reads on project-page entry; other builds retain manual connection.
const knowledgeChatHost = isCompanionKnowledgeChatHost(import.meta.env.MODE,window.location)
const configEditorHost = isCompanionConfigEditHost(import.meta.env.MODE,window.location)
const normalWorkspaceHost = isCompanionWorkspaceHost(import.meta.env.MODE,window.location)
const passiveReadHost = isCompanionReadHost(import.meta.env.MODE,window.location)
if (passiveReadHost || normalWorkspaceHost || configEditorHost || knowledgeChatHost) {
  // Normal workspace exposes the approved existing capabilities; readonly keeps
  // its passive boundary. Loopback never replaces session or per-action consent.
  if (normalWorkspaceHost) {
    agentHandoffProvider.value={writeText:async text=>{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(text)},open:url=>window.location.assign(url)}
    registerPreviewActionsProvider(createPreviewActionsProvider({fetch:window.fetch.bind(window)}))
    registerLogToolsProvider(createLogToolsProvider({fetch:window.fetch.bind(window)}))
    registerAiJobsReadProvider(createAiJobsReadProvider({fetch:window.fetch.bind(window)}))
    registerAiJobActionsProvider(createAiJobActionsProvider({fetch:window.fetch.bind(window)}))
    registerAiTaskCreationProvider(createAiTaskCreationProvider({fetch:window.fetch.bind(window)}))
    registerCreatorOperationsProvider(createCreatorOperationsProvider({fetch:window.fetch.bind(window)}))
    registerProjectSetupProvider(createProjectSetupProvider({fetch:window.fetch.bind(window)}))
    registerLocalServiceOperationsProvider(createLocalServiceOperationsProvider({fetch:window.fetch.bind(window)}))
    registerToolPresetWriteProvider(createToolPresetWriteProvider({fetch:window.fetch.bind(window)}))
  }
  if (configEditorHost || normalWorkspaceHost) {
    registerAiResourceSaveProvider(createAiResourceSaveProvider({fetch:window.fetch.bind(window)}))
    registerAiReferenceUploadProvider(createAiReferenceUploadProvider({fetch:window.fetch.bind(window)}))
  }
  if (knowledgeChatHost || normalWorkspaceHost) registerKnowledgeConversationProvider(createKnowledgeConversationProvider({fetch:window.fetch.bind(window)}))
  registerAiResourceReadProvider(createAiResourceReadProvider({fetch:window.fetch.bind(window),referencePreview:!passiveReadHost}))
  registerToolPresetReadProvider(createToolPresetReadProvider({fetch:window.fetch.bind(window)}))
  // Knowledge status runs CLI / sync probes, including the model-only page.
  if (!passiveReadHost) registerKnowledgeReadProvider(createKnowledgeReadProvider({fetch:window.fetch.bind(window)}))
  registerCompanionBrowserProvider(createCompanionBrowserProvider({fetch:window.fetch.bind(window),runtimeProbes:!passiveReadHost,dashboardDiscovery:!normalWorkspaceHost}),createCompanionEventProvider({createEventSource:path=>new EventSource(path)}),normalWorkspaceHost?{projectEntry:'read'}:{})
} else if (!['companion-readonly','companion-workspace','companion-config-editor','companion-knowledge-chat'].includes(import.meta.env.MODE) && window.location.protocol === 'http:' && window.location.hostname === '127.0.0.1' && /^\/companion\/(?:index\.html)?$/.test(window.location.pathname)) {
  registerImageReviewProvider(createHostedImageReviewProvider(window.fetch.bind(window)))
}
createApp(App).use(createPinia()).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
