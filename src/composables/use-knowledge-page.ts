import { onBeforeUnmount, onDeactivated } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { knowledgePageFor } from '../domain/knowledge-navigation'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { useKnowledgeAgentStore } from '../stores/knowledge-agent'

/** Shared session-only lifecycle. Entering a page never dispatches a read or model operation. */
export function useKnowledgePageLifecycle() {
  const read=useKnowledgeReadStore(),chat=useKnowledgeConversationStore(),agent=useKnowledgeAgentStore(),route=useRoute()
  function leaveFamily(){chat.suspend();agent.suspend()}
  // Retain completed reads/drafts across route tabs; approvals and in-flight operations are never replayed.
  onBeforeRouteLeave(to=>{
    read.cancelReads()
    if(!knowledgePageFor(to))leaveFamily()
  })
  onBeforeRouteUpdate((to,from)=>{
    if(knowledgePageFor(from)&&!knowledgePageFor(to)){read.cancelReads();leaveFamily()}
  })
  onDeactivated(()=>{read.cancelReads();if(!knowledgePageFor(route))leaveFamily()})
  onBeforeUnmount(()=>{
    read.cancelReads()
    if(!knowledgePageFor(route))leaveFamily()
  })
}
