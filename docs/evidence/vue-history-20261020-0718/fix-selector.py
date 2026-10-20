from pathlib import Path
import shutil
w=Path(__file__).parent
shutil.copyfile(w/'vitest-result.json',w/'vitest-first-attempt.json')
p=Path('D:/code/shidai3/P8000/companion-next/tests/call-history-page-migration.test.ts')
s=p.read_text(encoding='utf-8')
before="wrapper!.findAllComponents({name:'ElSelect'}).find(s=>s.attributes('aria-label')==='调用记录筛选')!"
assert s.count(before)==2
p.write_text(s.replace(before,"wrapper!.findAllComponents({name:'ElSelect'})[1]!"),encoding='utf-8',newline='\n')
