"""dot workspace UI smoke. Uses local Chromium; no Windows, Creator or Bridge."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import os
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.test-artifacts'
OUT.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/'
checks = []
errors = []
requests = []
def record(name):
    checks.append(name)
def shot(page, name):
    page.screenshot(path=str(OUT / name), full_page=True)
def no_overflow(page, name):
    dims = page.evaluate('({viewport:innerWidth,document:document.documentElement.scrollWidth})')
    assert dims['document'] <= dims['viewport'], f'{name} overflow: {dims}'
    record(f'{name}: no horizontal overflow')

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'], env={**os.environ, 'HOME':'/tmp/companion-next-browser-home', 'XDG_CONFIG_HOME':'/tmp/companion-next-browser-config'})
        page = browser.new_page(viewport={'width':1440,'height':1080}, device_scale_factor=1)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: requests.append(r.url))
        page.goto(url, wait_until='networkidle')
        expect(page.get_by_role('heading', name='工作台已就绪，等待连接项目')).to_be_visible()
        expect(page.get_by_role('heading', name='P1060 · 暗黑')).to_have_count(0)
        record('default disconnected with no fixtures')
        shot(page, '01-disconnected-desktop.png')
        page.get_by_role('button', name='查看示例工作台').click()
        expect(page.get_by_role('heading', name='P1060 · 暗黑')).to_be_visible()
        expect(page.get_by_text('正在浏览示例资料', exact=True)).to_be_visible()
        record('explicit demo mode with persistent source label')
        shot(page, '02-demo-overview-desktop.png')
        page.get_by_role('link', name='游戏资源', exact=True).click()
        expect(page.get_by_text('本次生成资源', exact=True)).to_be_visible()
        expect(page.locator('.resource-row')).to_have_count(5)
        expect(page.get_by_role('checkbox', name='选择主按钮底图')).to_be_disabled()
        page.get_by_role('checkbox', name='选择灵魂石图标').check()
        expect(page.get_by_text('已选 1 项 · 尚未提交任何生成任务', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='生成所选（未接通）')).to_be_disabled()
        page.get_by_role('textbox', name='搜索资源').fill('金币')
        expect(page.locator('.resource-row')).to_have_count(1)
        page.get_by_role('textbox', name='搜索资源').fill('')
        no_overflow(page, 'desktop resources')
        shot(page, '03-demo-resources-desktop.png')
        record('resource search, selection, Owner protection and disabled generation')
        page.get_by_role('button', name='编辑本地草稿', exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        shot(page, '04-local-spec-dialog.png')
        width = page.get_by_role('spinbutton', name='画布宽度')
        width.fill('1080'); width.press('Tab')
        for label in ['风格样板', '文字与按钮', '弹窗层级', '基础画布']:
            page.get_by_role('tab', name=label, exact=True).click()
        page.get_by_role('button', name='保存本地草稿', exact=True).click()
        expect(page.get_by_role('dialog')).to_have_count(0)
        expect(page.locator('.spec-summary')).to_contain_text('1080 × 1672')
        expect(page.locator('.spec-summary')).to_contain_text('草稿未批准')
        record('four-tab unified dialog and local draft save')
        page.get_by_role('combobox', name='当前项目').click()
        page.get_by_role('option', name='P4060 · 蚂蚁').click()
        expect(page.locator('.spec-summary')).to_contain_text('750 × 1334')
        expect(page.locator('.resource-row')).to_have_count(0)
        page.get_by_role('combobox', name='当前项目').click()
        page.get_by_role('option', name='P1060 · 暗黑').click()
        expect(page.locator('.spec-summary')).to_contain_text('1080 × 1672')
        record('project-isolated drafts and resources')
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('heading', name='工作台已就绪，等待连接项目')).to_be_visible()
        page.get_by_role('button', name='查看示例工作台').click()
        expect(page.locator('.spec-summary')).to_contain_text('1080 × 1672')
        record('reload is disconnected; explicit reopen restores only local draft')
        for step in ['项目规范','资源规划','生成素材','视觉审阅','导入绑定','运行验收']:
            page.locator('.resource-steps').get_by_role('button', name=step).click()
            expect(page.locator('.resource-steps button.active')).to_contain_text(step)
            if step == '视觉审阅':
                shot(page, '05-demo-visual-review.png')
                expect(page.get_by_role('button', name='批准所选（未接通）')).to_be_disabled()
            if step == '导入绑定':
                shot(page, '06-demo-delivery.png')
                expect(page.get_by_role('button', name='导入与绑定（未接通）')).to_be_disabled()
            if step == '运行验收':
                expect(page.get_by_text('当前没有 Creator / Bridge 实机运行证据，不生成“已通过”结论。')).to_be_visible()
                expect(page.get_by_role('button', name='运行并验收（未接通）')).to_be_disabled()
        record('six stages navigate with separate, unverified delivery and runtime evidence')
        page.get_by_role('link', name='服务状态', exact=True).click()
        expect(page.locator('.service-card')).to_have_count(3)
        expect(page.locator('.service-card .el-tag').first).to_contain_text('未验证')
        shot(page, '07-demo-services.png')
        page.get_by_role('link', name='版本与边界', exact=True).click()
        expect(page.get_by_role('heading', name='Windows 冻结版 · v142')).to_be_visible()
        record('service unknown states and explicit version boundary')
        mobile = browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        mobile.on('pageerror', lambda e: errors.append(str(e)))
        mobile.on('request', lambda r: requests.append(r.url))
        mobile.goto(url, wait_until='networkidle')
        no_overflow(mobile, 'mobile disconnected')
        mobile.get_by_role('button', name='查看示例工作台').click()
        no_overflow(mobile, 'mobile overview')
        mobile.get_by_role('button', name='打开导航').click()
        mobile.get_by_role('link', name='游戏资源', exact=True).click()
        no_overflow(mobile, 'mobile resources')
        shot(mobile, '08-demo-resources-mobile.png')
        mobile.get_by_role('button', name='编辑本地草稿', exact=True).click()
        no_overflow(mobile, 'mobile spec dialog')
        shot(mobile, '09-local-spec-dialog-mobile.png')
        record('390px mobile navigation, resources and modal')
        assert not errors, f'Browser page errors: {errors}'
        assert all(u.startswith(url) or u.startswith('data:') for u in requests), f'External requests: {requests}'
        assert not any('/api/' in u for u in requests), 'Unexpected live API request'
        record('zero page errors, external requests or live API calls')
        browser.close()
finally:
    server.shutdown()
report = {'environment':'dot workspace Chromium; independent local production build; no Windows/Creator/Bridge', 'checks':checks, 'pageErrors':errors, 'requestCount':len(requests), 'liveApiRequests':0, 'screenshots':sorted(x.name for x in OUT.glob('*.png'))}
(OUT / 'browser-smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
