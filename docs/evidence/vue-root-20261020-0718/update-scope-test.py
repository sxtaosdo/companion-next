from pathlib import Path
R=Path('D:/code/shidai3/P8000/companion-next')
p=R/'src/domain/product-information.ts';raw=p.read_bytes()
old="{ id: 'calls', title: '调用记录与进行中详情', status: '实时读取已接 · 实机待验', detail: '调用统计 / 最近摘要、全部与失败、每页50与更多、结果摘要、实时合并和会话重置已接源码。重连重新核对快照，但无事件回放，不能保证断线完整性；实际宿主待验。不重放调用。', destination: '/projects?tab=calls' }"
new="{ id: 'calls', title: '调用记录与进行中详情', status: 'Vue分页/详情契约已验 · 自然分页另列', detail: '调用统计、最近摘要、全部/失败、每页50与更多、详情、实时合并及会话重置均保留。隔离页面验证50+1、失败50+16、防重复追加、追加错误恢复及筛选后丢弃旧回执；既有两条自然失败详情已与真实API匹配。生产自然51条第二页仍缺数据，单列集成证据，不作为Vue迁移门槛。不重放调用；无事件回放，不承诺长时断线完整性。', destination: '/projects?tab=calls' }"
assert raw.count(old.encode())==1;raw=raw.replace(old.encode(),new.encode());rows=raw.splitlines(keepends=True);p.write_bytes(b''.join(r.replace(b'\r\n',b'\n') if new.encode() in r else r for r in rows))
p=R/'tests/help-about-navigation.test.ts';raw=p.read_bytes()
pairs=[
('marks missing old functionality explicitly instead of treating Picker or static help as completed migration','separates Vue contract coverage from unverified host integration instead of equating a button with business completion'),
('实时读取已接 · 实机待验','Vue分页/详情契约已验 · 自然分页另列'),
('分项安装部分已验 · 客户端配置未验','Vue安装/登记契约已接 · 宿主集成另列'),
('configureCodex=true的01/11及真实五客户端持久配置仍未验','configureCodex=true的01/11及真实客户端持久配置属于尚未补齐的宿主集成证据'),
]
for a,b in pairs:
 assert raw.count(a.encode())==1,a
 raw=raw.replace(a.encode(),b.encode())
rows=raw.splitlines(keepends=True);needles=[b.encode() for a,b in pairs];p.write_bytes(b''.join(r.replace(b'\r\n',b'\n') if any(n in r for n in needles) else r for r in rows))
print('Updated only current scope evidence statements and their affected assertion')
