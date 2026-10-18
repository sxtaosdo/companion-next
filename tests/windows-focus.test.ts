import { describe, expect, it, vi } from 'vitest'
import { focusWindowsPid } from '../host/windows-focus'
describe('Windows focus acknowledgement', () => {
 it('does not dispatch an invalid PID', async () => {
  const run=vi.fn()
  for(const pid of [0,-1,NaN,1.5,2147483648]) await expect(focusWindowsPid(pid,run)).rejects.toThrow('Invalid Creator PID')
  expect(run).not.toHaveBeenCalled()
 })
 it('accepts only requested PID actually foreground and detached', async () => {
  await expect(focusWindowsPid(42,async()=>JSON.stringify({targetPid:42,foregroundPid:42,verified:true,detached:true}))).resolves.toBeUndefined()
 })
 it.each([
  {targetPid:42,foregroundPid:41,verified:false,detached:true},
  {targetPid:41,foregroundPid:41,verified:true,detached:true},
  {targetPid:42,foregroundPid:42,verified:true,detached:false},
  {targetPid:42,foregroundPid:42,verified:true},
 ])('rejects unverified receipt %j', async receipt => {
  await expect(focusWindowsPid(42,async()=>JSON.stringify(receipt))).rejects.toThrow()
 })
 it('rejects empty/invalid transport output', async () => {
  for(const s of ['', 'PRIVATE DIAGNOSTIC', 'null', '[]']) await expect(focusWindowsPid(42,async()=>s)).rejects.toThrow()
 })
 it('propagates rejected native invocation', async () => {
  await expect(focusWindowsPid(42,async()=>{throw Error('native rejected')})).rejects.toThrow('native rejected')
 })
})
