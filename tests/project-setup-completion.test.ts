import {describe,it,expect} from 'vitest'
import {buildSetupCompletionPrompt} from '../src/domain/project-setup'
describe('original completion usage prompt',()=>{
 it.each([undefined,''])('uses original missing-name fallback %s',name=>expect(buildSetupCompletionPrompt(name)).toBe('使用 当前工程的 Cocos Creator MCP MCP 检查连接，确认工程身份后等待我的修改要求。禁止操作其他 Creator 工程。'))
 it('keeps the original valid backend name exactly',()=>expect(buildSetupCompletionPrompt('cocos-creator-game-abcd1234')).toBe('使用 cocos-creator-game-abcd1234 MCP 检查连接，确认工程身份后等待我的修改要求。禁止操作其他 Creator 工程。'))
 it.each([null,1,' bad','x\ny','x; run','x<iframe>','x\u202e','x'.repeat(257)])('declines malformed returned MCP identity %j',name=>expect(buildSetupCompletionPrompt(name)).toBeNull())
})
