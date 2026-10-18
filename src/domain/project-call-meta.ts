import type { CallLatest } from './companion-browser'
/** Original call-meta relative display; invalid data is never an invented duration. */
export function formatCallAge(at:string,now=Date.now()):string {
 const time=Date.parse(at);if(!Number.isFinite(time))return '时间未记录'
 const elapsed=Math.max(0,now-time);if(elapsed<60000)return '刚刚'
 const minutes=Math.floor(elapsed/60000);if(minutes<60)return `${minutes}分钟前`
 const hours=Math.floor(minutes/60);if(hours<24)return minutes%60===0?`${hours}小时前`:`${hours}小时${minutes%60}分钟前`
 return `${Math.floor(hours/24)}天前`
}
export function formatProjectCallMeta(call:CallLatest|undefined,now=Date.now()):string {
 if(!call)return '调用：暂无'
 const start=Date.parse(call.startedAt);if(!Number.isFinite(start))return `调用：${call.operationNameZh} 时间未记录`
 if(call.status==='running')return `调用：${call.operationNameZh} ${Math.max(0,Math.floor(now-start))}ms`
 if(typeof call.durationMs!=='number'||!Number.isFinite(call.durationMs)||call.durationMs<0)return `调用：${call.operationNameZh} 耗时未记录 · ${formatCallAge(call.startedAt,now)}开始`
 const duration=Math.floor(call.durationMs),finished=new Date(start+duration)
 return `调用：${call.operationNameZh} ${duration}ms ${Number.isFinite(finished.getTime())?formatCallAge(finished.toISOString(),now):'完成时间未记录'}`
}
