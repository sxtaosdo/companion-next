from pathlib import Path
R=Path('D:/code/shidai3/P8000/companion-next')
p=R/'src/views/MigrationView.vue';s=p.read_text(encoding='utf-8')
before='<p>目标是保留旧功能，只改变布局与交互。下面的缺口是待完成工作，不表示允许删掉旧功能。</p>'
after='<p>目标是保留旧功能，只改变布局与交互。Vue 页面迁移与继承的宿主业务状态分别核对；页面接线不代表业务通过，外部服务未重跑也不自动表示页面未迁移。</p>'
assert s.count(before)==1;s=s.replace(before,after)
before='功能接线与真实操作验收分别列出，不以页面或目录保存代替完整业务完成。'
after='页面、交互和接口合同迁移与真实业务验收分别列出，不以页面或目录保存代替完整业务完成。'
assert s.count(before)==1;s=s.replace(before,after)
before='<section class="panel information-card"><h3>完成判定</h3><p>取得当前菜单、帮助和协议清单 → 每项映射原入口 / 新入口 / 数据与写入合同 → 保留原交互与权限 → 测试失败、中断和恢复 → 在真实旧版环境逐项对照验收。未通过前不删除或替换原 Windows Companion。</p><p>涉及真实配置、服务启动、文件写入与引擎执行的功能，必须沿用已核原合同，不能靠新增一个按钮判作已迁移。</p></section>'
after='<section class="panel information-card migration-verification-boundaries"><h3>前端迁移判定</h3><p>对照原入口与新入口、按钮、导航、参数、返回状态和错误反馈；确认取消、重复点击、中断和返回后的状态。分页、安装组合和失败回执可以用隔离数据验证前端合同，并注明证据范围，不能只靠新增一个按钮判作已迁移。</p><h3>宿主与真实集成状态</h3><p>前端合同通过不代表宿主、外部客户端或模型服务全部可用。Vue 迁移不要求启动 Cursor、发送真实 Agent 对话或重复运行模型才能通过；这些独立能力的真实证据与技术问题另行记录。真实配置、服务启动、文件写入与引擎执行继续沿用原合同和用户限制。未取得替换所需证据前不删除或替换原 Windows Companion。</p></section>'
assert s.count(before)==1;s=s.replace(before,after)
p.write_text(s,encoding='utf-8',newline='\n')
print('Updated only MigrationView validation boundary copy')
