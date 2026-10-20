from pathlib import Path
import json,hashlib
R=Path('D:/code/shidai3/P8000/companion-next');W=Path(__file__).parent
p=R/'src/views/HelpView.vue';raw=p.read_bytes()
old=b"function choose(topic: string) { router.push({ path: '/help', query: { topic } }) }"
new=b"""function choose(topic: string) {
  const project = route.query.project
  void router.push({ path: '/help', query: { topic, ...(project === undefined ? {} : { project }) } })
}"""
assert raw.count(old)==1
after=raw.replace(old+b'\r\n',new+b'\n') if old+b'\r\n' in raw else raw.replace(old,new)
p.write_bytes(after)
(W/'source-change.json').write_text(json.dumps({'file':'src/views/HelpView.vue','beforeSha256':hashlib.sha256(raw).hexdigest(),'afterSha256':hashlib.sha256(after).hexdigest(),'changedBehavior':'Preserve only explicit project query through help topic navigation; unknown projects continue through existing rejection; no automatic writes or external handoff'},indent=2)+'\n',encoding='utf-8')
print('Changed only HelpView topic navigation context')
