import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
const require=createRequire('D:/code/shidai3/P8000/companion-next/package.json'),ts=require('typescript'),W=dirname(fileURLToPath(import.meta.url));
const options={strict:true,noEmit:true,noUncheckedIndexedAccess:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:['node'],typeRoots:['D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules/@types']};
const program=ts.createProgram([join(W,'candidate/codex-configurator.ts')],options),diagnostics=ts.getPreEmitDiagnostics(program);
const receipt={strict:true,noUncheckedIndexedAccess:true,diagnostics:diagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})),passed:diagnostics.length===0};
await writeFile(join(W,'typecheck.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(diagnostics.length)process.exitCode=1;
