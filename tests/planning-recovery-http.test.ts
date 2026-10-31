import {test,expect,vi} from 'vitest'
import {createWorkflowHttpProvider} from '../src/components/workflow-operation/workflow-operation-http'
const receipt={schemaVersion:'planning-restart-recovery-result-v1',workflowId:'goal-a',originalOperationId:'original',state:'verified',meaning:'original-local-transport-ended-by-system-restart',originalEOFClaimed:false}
test('uses original planning request and never dispatches plan/start',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(receipt),{status:200}));const provider=createWorkflowHttpProvider(fetcher as typeof fetch)
 await provider.recoverPlanningTransport!('goal-a',{operationId:'original',expectedRevision:3})
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0]?.[0]).toBe('/api/workflow/operations/goal-a/recover-planning-transport')
})
test.each([{...receipt,originalOperationId:'other'},{...receipt,originalEOFClaimed:true},{...receipt,workflowId:'other'}])('rejects mismatched or fabricated recovery receipt',async result=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(result),{status:200}));const provider=createWorkflowHttpProvider(fetcher as typeof fetch)
 await expect(provider.recoverPlanningTransport!('goal-a',{operationId:'original',expectedRevision:3})).rejects.toMatchObject({outcome:'unknown'});expect(fetcher).toHaveBeenCalledTimes(1)
})
