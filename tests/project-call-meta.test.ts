import { describe,it,expect } from 'vitest'
import { formatCallAge,formatProjectCallMeta } from '../src/domain/project-call-meta'
const now=Date.parse('2026-10-18T12:00:00Z')
describe('original recent-call age and duration display',()=>{
 it.each([[59000,'刚刚'],[60000,'1分钟前'],[3600000,'1小时前'],[3660000,'1小时1分钟前'],[86400000,'1天前']] as const)('formats age %s', (age,text)=>{expect(formatCallAge(new Date(now-age).toISOString(),now)).toBe(text)})
 it('shows running milliseconds and clamps future start without a request',()=>{const base={id:'r',operationNameZh:'场景',status:'running' as const};expect(formatProjectCallMeta({...base,startedAt:new Date(now-1234).toISOString()},now)).toBe('调用：场景 1234ms');expect(formatProjectCallMeta({...base,startedAt:new Date(now+1000).toISOString()},now)).toBe('调用：场景 0ms')})
 it('calculates completed age from start plus actual reported duration',()=>{expect(formatProjectCallMeta({id:'r',operationNameZh:'场景',status:'success',startedAt:new Date(now-60100).toISOString(),durationMs:100},now)).toBe('调用：场景 100ms 1分钟前')})
 it('does not invent zero duration when it was not recorded',()=>{const text=formatProjectCallMeta({id:'r',operationNameZh:'场景',status:'failed',startedAt:new Date(now).toISOString()},now);expect(text).toContain('耗时未记录');expect(text).not.toContain('0ms')})
 it('handles unavailable and out-of-calendar data without throwing',()=>{expect(formatProjectCallMeta(undefined,now)).toBe('调用：暂无');expect(formatProjectCallMeta({id:'r',operationNameZh:'场景',status:'success',startedAt:'invalid'},now)).toContain('时间未记录');expect(formatProjectCallMeta({id:'r',operationNameZh:'场景',status:'success',startedAt:new Date(now).toISOString(),durationMs:Number.MAX_SAFE_INTEGER},now)).toContain('完成时间未记录')})
})
