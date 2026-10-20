from pathlib import Path
p=Path('D:/code/shidai3/P8000/companion-next/src/domain/product-information.ts');raw=p.read_bytes()
pairs=[
 ('完整业务迁移未完成','Vue迁移与宿主业务集成分别验收'),
 ('新前端尚未接入该编辑链路，不能直接改写工程序列化文件。','旧后台在这里提供帮助、复制与工具入口；场景编辑仍由原CLI/MCP和Creator序列化链路处理，Vue迁移不另造场景编辑器，也不直接改写工程序列化文件。'),
 ('分项安装部分已验 · 客户端配置未验','Vue安装/登记契约已接 · 宿主集成另列'),
 ('configureCodex=true的01/11及真实五客户端持久配置仍未验，不能把202或复制文本当作配置成功。','四种选项的Vue确认、参数与完成展示通过隔离合同验证；configureCodex=true的01/11及真实客户端持久配置属于尚未补齐的宿主集成证据，不作为Vue迁移前置条件，也不能把202或复制文本当作配置成功。'),
]
for a,b in pairs:
 assert raw.count(a.encode())==1,a
 raw=raw.replace(a.encode(),b.encode())
rows=raw.splitlines(keepends=True)
needles=[b.encode() for a,b in pairs]
rows=[r.replace(b'\r\n',b'\n') if any(n in r for n in needles) else r for r in rows]
p.write_bytes(b''.join(rows))
print('Corrected exact scope statements; retained historic business acceptance facts')
