from pathlib import Path
import json, hashlib, difflib, datetime
W=Path(__file__).parent
I=Path('D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((I/'companion-daemon.js.map').read_text(encoding='utf-8'))
base=next(c for n,c in zip(m['sources'],m['sourcesContent']) if n.endswith('codex-configurator.ts'))
(W/'baseline').mkdir(exist_ok=True);(W/'candidate').mkdir(exist_ok=True)
(W/'baseline/codex-configurator.ts').write_bytes(base.encode())
helper='''function matchesTargetTransport(text: string, target: { command: string; args: string[] }, useNode: boolean): boolean {
  const transport = parsedTransport(text);
  if (!transport || transport.args.length !== target.args.length) return false;
  const samePath = (left: string, right: string) => process.platform === "win32"
    ? left.replace(/\\\\/g, "/").toLowerCase() === right.replace(/\\\\/g, "/").toLowerCase()
    : left === right;
  return samePath(transport.command, target.command)
    && transport.args.every((item, index) => useNode && index === 0
      ? samePath(item, target.args[index]!) : item === target.args[index]);
}

'''
candidate=base.replace('function legacyForProject(',helper+'function legacyForProject(',1)
candidate=candidate.replace('const target = { command: input.creatorAiPath, args: ["mcp", "--project", input.projectId] };','const useNode = process.platform === "win32" && /\\.(?:c?js|mjs)$/i.test(input.creatorAiPath);\n  const target = useNode\n    ? { command: process.execPath, args: [input.creatorAiPath, "mcp", "--project", input.projectId] }\n    : { command: input.creatorAiPath, args: ["mcp", "--project", input.projectId] };',1)
candidate=candidate.replace('matchesManagedConfig(initial.text, input.creatorAiPath, input.projectId)) return { ...result, changed: false };','matchesTargetTransport(initial.text, target, useNode)) return { ...result, changed: false };',1)
candidate=candidate.replace('const previous = initial.state === "present" ? legacyForProject(initial.text, input.projectPath) : undefined;','const previous = initial.state === "present"\n    ? legacyForProject(initial.text, input.projectPath)\n      ?? (useNode && matchesManagedConfig(initial.text, input.creatorAiPath, input.projectId)\n        ? reproducibleTransport(initial.text, name) : undefined)\n    : undefined;',1)
old_missing='''return [value.message, value.stderr].some(text => typeof text === "string" && (
    text.trim() === `No MCP server named '${name}' found.`
    || text.trim() === `error: No MCP server named '${name}' found.`
  ));'''
new_missing='''const text = typeof value.stderr === "string" && value.stderr.trim() ? value.stderr : value.message;
  if (typeof text !== "string") return false;
  const lines = text.split(/\\r?\\n/).map(line => line.trim()).filter(Boolean);
  const missing = (line: string) => line === `No MCP server named '${name}' found.`
    || line === `error: No MCP server named '${name}' found.`
    || line === `Error: No MCP server named '${name}' found.`;
  return lines.some(missing) && lines.every(line => missing(line)
    || line.startsWith('WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir '));'''
assert old_missing in candidate
candidate=candidate.replace(old_missing,new_missing,1)
assert candidate!=base and 'matchesTargetTransport(initial.text, target, useNode)' in candidate
(W/'candidate/codex-configurator.ts').write_bytes(candidate.encode())
(W/'codex-configurator.patch').write_text(''.join(difflib.unified_diff(base.splitlines(True),candidate.splitlines(True),fromfile='a/mcp/src/companion/codex-configurator.ts',tofile='b/mcp/src/companion/codex-configurator.ts')),encoding='utf-8',newline='\n')
info={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'daemonSha256':sha(I/'companion-daemon.js'),'daemonMapSha256':sha(I/'companion-daemon.js.map'),'cliSha256':sha(I/'creator-ai.js'),'baselineSourceSha256':sha(W/'baseline/codex-configurator.ts'),'candidateSourceSha256':sha(W/'candidate/codex-configurator.ts'),'sourceLocator':next(n for n in m['sources'] if n.endswith('codex-configurator.ts')),'scope':'OFFLINE_CANDIDATE_ONLY_NO_DEPLOYMENT','realGlobalConfigBefore':{str(p):sha(p) for p in [Path('C:/Users/33272/.codex/config.toml'),Path('C:/Users/33272/.cursor/mcp.json')]}}
(W/'baseline.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({k:v for k,v in info.items() if k!='realGlobalConfigBefore'}))
