from pathlib import Path
import json,hashlib,re
W=Path(__file__).parent
R=Path('D:/code/shidai3/P8000/companion-next')
I=Path('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion')
sha=lambda b:hashlib.sha256(b).hexdigest()
mp=I/'companion-daemon.js.map'; bundle=I/'companion-daemon.js'
m=json.loads(mp.read_bytes())
out={'bundleSha256':sha(bundle.read_bytes()),'mapSha256':sha(mp.read_bytes()),'sources':{}}
for suffix in ['companion/cursor-configurator.ts','companion/codex-configurator.ts','companion/http-server.ts','companion-daemon.ts']:
 matches=[i for i,n in enumerate(m['sources']) if n.endswith(suffix)]
 assert len(matches)==1,(suffix,len(matches))
 source=m['sourcesContent'][matches[0]]
 (W/Path(suffix).name).write_text(source,encoding='utf-8',newline='\n')
 lines=source.splitlines()
 needles=['const command =','const args =','creatorAiPath: context.creatorAiPath','registerMcp: async','tail === "mcp/register"','matchesManagedConfig(currentText','function matchesManagedConfig','function sameEntry','input.creatorAiPath','nodePath','process.execPath']
 rows=[{'line':i+1,'text':line.strip()} for i,line in enumerate(lines) if any(n in line for n in needles)]
 out['sources'][suffix]={'sha256':sha(source.encode()),'lines':rows}
(W/'installed-source-audit.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,indent=2))
