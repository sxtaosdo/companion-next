import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

// Imported by the root's authenticated browser runner; no top-level I/O/browser launch.
export async function runPresetScenario({ page, context, baseUrl, fixtureIds, proofDir }) {
  const id = value => typeof value === 'string' ? value : value?.id;
  const projectA = id(fixtureIds.projectA), projectB = id(fixtureIds.projectB), presetId = id(fixtureIds.presetId);
  assert.match(projectA, /^[a-f0-9]{16}$/); assert.match(projectB, /^[a-f0-9]{16}$/); assert.notEqual(projectA, projectB);
  assert.match(presetId, /^[A-Za-z0-9_-]+$/); assert(!['core', 'full'].includes(presetId));
  const origin = new URL(baseUrl).origin;
  assert.equal(origin, 'http://127.0.0.1:32180');
  assert.equal(page.context(), context);
  const proof = { fixtureIds: { projectA, projectB, presetId }, writes: [], blocked: [], controlledFault: [], controlledDelay: [], steps: [] };
  const bounded = async (pending, label) => {
    let timer;
    try { return await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after 15000 ms`)), 15000); })]); }
    finally { clearTimeout(timer); }
  };
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const panel = () => page.getByTestId('tool-preset-write-panel');
  const button = name => panel().getByRole('button', { name, exact: true });
  const ready = async name => { await button(name).waitFor(); await page.waitForFunction(name => [...document.querySelectorAll('[data-testid="tool-preset-write-panel"] button')].some(b => b.textContent.trim() === name && !b.disabled), name); };
  const pick = async (name, label) => {
    await page.getByRole('combobox', { name, exact: true }).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")]').click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  let permitPatch = false, mode = '', held = null, arrived = null, toolsFault = null;
  const events = [];
  const handler = async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.origin !== origin) { proof.blocked.push({ method, path: url.pathname, reason: 'foreign-origin' }); return route.abort(); }
    if (method !== 'GET' && method !== 'HEAD') {
      if (permitPatch && method === 'PATCH' && url.pathname === `/api/tool-presets/${presetId}` && !url.search) {
        permitPatch = false;
        const body = request.postDataJSON();
        assert(Object.keys(body).every(key => ['name', 'baseProfile', 'enabled', 'disabled'].includes(key)));
        proof.writes.push({ method, path: url.pathname });
        const response = await route.fetch();
        proof.writes.at(-1).actualUpstreamStatus = response.status();
        arrived.resolve(); await held.promise;
        return route.fulfill({ response }).catch(() => {});
      }
      proof.blocked.push({ method, path: url.pathname, reason: 'unapproved-write' }); return route.abort();
    }
    if (url.pathname === '/api/tool-presets') events.push({ mode, projectId: url.searchParams.get('projectId') });
    if (mode === 'refresh-aba' && url.pathname === '/api/tools') {
      const response = await route.fetch(); arrived.resolve(); await held.promise;
      return route.fulfill({ response }).catch(() => {});
    }
    if (mode === 'readback-single-failure' && url.pathname === '/api/tools') {
      await toolsFault.promise;
      proof.controlledFault.push({ method: 'GET', path: '/api/tools', operation: 'route.abort(failed)', naturalFailure: false });
      return route.abort('failed');
    }
    if (mode === 'readback-single-failure' && url.pathname === '/api/tool-presets') {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      arrived.resolve(); await held.promise;
      return route.fulfill({ response }).catch(() => {});
    }
    return route.continue();
  };
  await mkdir(proofDir, { recursive: true });
  await page.route('**/api/**', handler);
  try {
    // Read-only discovery; fixtures and snapshots are owned/validated by root.
    const projectsResponse = await context.request.get(`${origin}/api/projects`);
    assert.equal(projectsResponse.status(), 200);
    const projectsRaw = await projectsResponse.json();
    const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw.projects;
    const a = projects.find(p => p.id === projectA), b = projects.find(p => p.id === projectB);
    assert(a?.name && b?.name, 'Both root-owned registered fixtures must exist');
    const presetsResponse = await context.request.get(`${origin}/api/tool-presets?projectId=${projectA}`);
    assert.equal(presetsResponse.status(), 200);
    const presetsRaw = await presetsResponse.json();
    const presets = Array.isArray(presetsRaw) ? presetsRaw : presetsRaw.presets;
    const preset = presets.find(p => p.id === presetId);
    assert(preset && !preset.builtIn, 'Explicit root-owned custom preset must exist');
    await page.goto(`${origin}/next/index.html#/projects`, { waitUntil: 'domcontentloaded' });
    await page.getByText(a.name, { exact: true }).first().waitFor();
    await page.goto(`${origin}/next/index.html#/help?topic=tools&project=${projectA}`, { waitUntil: 'domcontentloaded' });
    await ready('为当前工程确认分配预览范围');
    await pick('只读预览预设', `${preset.name}（自定义 / 基于${preset.baseProfile}）`);

    await panel().getByRole('textbox', { name: '正式预设新名称', exact: true }).fill(`${preset.name.slice(0, 30)}-cancel`);
    await button('改名并确认').click();
    const review = () => page.getByRole('region', { name: '本次工具预设持久化确认', exact: true });
    assert((await review().innerText()).includes(presetId));
    await review().locator('label.el-checkbox').click();
    assert.equal(await review().locator('input[type="checkbox"]').isChecked(), true);
    await review().getByRole('button', { name: '取消本次确认', exact: true }).click();
    assert.equal(await review().count(), 0); assert.equal(proof.writes.length, 0);
    proof.steps.push({ name: 'cancel-confirmation', passed: true, writes: 0 });

    mode = 'refresh-aba'; held = deferred(); arrived = deferred();
    await button('显式刷新目录和预设').click(); await bounded(arrived.promise, `${mode || 'preset-write'} route arrival`);
    await pick('工具范围工程', b.name); await pick('工具范围工程', a.name);
    held.resolve(); await page.waitForTimeout(250);
    assert.equal(events.filter(e => e.mode === 'refresh-aba').length, 0, 'Old refresh must not issue a preset GET after project changes');
    proof.controlledDelay.push({ path: '/api/tools', purpose: 'hold actual upstream response across project A→B→A' });
    proof.steps.push({ name: 'refresh-project-aba-no-followup', passed: true });

    mode = ''; await button('显式刷新目录和预设').click(); await ready('为当前工程确认分配预览范围');
    await pick('只读预览预设', `${preset.name}（自定义 / 基于${preset.baseProfile}）`);
    await panel().getByRole('textbox', { name: '正式预设新名称', exact: true }).fill(`${preset.name.slice(0, 28)}-race`);
    await button('改名并确认').click(); assert((await review().innerText()).includes(presetId));
    await review().locator('label.el-checkbox').click();
    assert.equal(await review().locator('input[type="checkbox"]').isChecked(), true);
    held = deferred(); arrived = deferred(); permitPatch = true;
    await review().getByRole('button', { name: '确认并写入宿主一次', exact: true }).click(); await bounded(arrived.promise, `${mode || 'preset-write'} route arrival`);
    await pick('工具范围工程', b.name); await pick('工具范围工程', a.name);
    held.resolve(); await page.waitForTimeout(150);
    assert((await panel().innerText()).includes('UNKNOWN')); assert.equal(proof.writes.length, 1);
    assert.equal(proof.writes[0].actualUpstreamStatus, 200);
    proof.controlledDelay.push({ path: `/api/tool-presets/${presetId}`, purpose: 'hold actual PATCH response across project change; mutation may have completed' });
    proof.steps.push({ name: 'temporary-rename-late-response-unknown', passed: true });

    mode = 'readback-single-failure'; held = deferred(); arrived = deferred(); toolsFault = deferred();
    await button('回读核对上次操作').click(); await bounded(arrived.promise, `${mode || 'preset-write'} route arrival`); toolsFault.resolve();
    await panel().getByText('显式回读未完成；原操作结果保持不变，未自动重试写入。', { exact: true }).waitFor();
    assert.equal(await button('回读核对上次操作').isDisabled(), true);
    assert.equal(await button('显式刷新目录和预设').isDisabled(), true);
    proof.steps.push({ name: 'failed-tools-pending-presets-retains-busy', passed: true, controlledFault: true });
    await page.screenshot({ path: join(proofDir, 'preset-readback-held.png') });
    held.resolve(); await ready('回读核对上次操作');
    assert((await panel().innerText()).includes('UNKNOWN')); assert.equal(proof.writes.length, 1);
    proof.steps.push({ name: 'readback-settles-without-clearing-unknown', passed: true });
    assert.deepEqual(proof.blocked, []);
    proof.passed = true;
    return proof;
  } catch (error) {
    proof.error = String(error?.message ?? error); proof.passed = false;
    throw error;
  } finally {
    held?.resolve(); toolsFault?.resolve(); permitPatch = false;
    await page.unroute('**/api/**', handler);
    await writeFile(join(resolve(proofDir), 'preset-scenario-proof.json'), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  }
}
