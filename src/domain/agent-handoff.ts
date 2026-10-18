export type HandoffAgent = 'cursor' | 'codex'
/** Same fixed local protocols and 8000-character fallback as the old Companion. */
export function agentHandoffUrl(agent:HandoffAgent,text:string):{url:string;clipboardOnly:boolean}{
 if(!['cursor','codex'].includes(agent)||typeof text!=='string'||!text.trim())throw Error('invalid handoff')
 const base=agent==='cursor'?'cursor://anysphere.cursor-deeplink/prompt?text=':'codex://new?prompt='
 const url=base+encodeURIComponent(text),clipboardOnly=url.length>8000
 return {url:clipboardOnly?base+encodeURIComponent('请先粘贴剪贴板中的完整文本，确认目标工程和任务后再开始。'):url,clipboardOnly}
}
