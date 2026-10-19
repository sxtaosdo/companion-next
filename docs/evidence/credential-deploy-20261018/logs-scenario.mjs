import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Run only against the root-owned isolated, already-authorized page/context. No auth or fixture creation. */
export async function runLogsScenario({ page, context, baseUrl, fixtureIds, proofDir }) {
  if (!Array.isArray(fixtureIds) || fixtureIds.length !== 2 || new Set(fixtureIds).size !== 2 || fixtureIds.some(id => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id))) throw Error('Two distinct task fixture IDs are required');
  const target = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '32180' || !target.pathname.startsWith('/next/')) throw Error('Expected authorized local Next URL');
  target.hash = '/projects';
  const proof = { kind: 'bounded-real-log-sse', startedAt: new Date().toISOString(), fixtureIds, steps: [], sse: { requests: 0, successfulHeaders: 0, failures: 0, controlledSubscriptionFailures: 0 }, logs: { requests: 0, successful: 0, blockedUnscoped: 0, perFixture: Object.fromEntries(fixtureIds.map(id => [id, 0])) }, pageErrors: 0, status: 'running' };
  let abortNextSse = false;
  const sseRoute = async route => {
    if (abortNextSse) { abortNextSse = false; proof.sse.controlledSubscriptionFailures++; return route.abort('connectionfailed'); }
    return route.continue();
  };
  const state = page.getByTestId('live-state');
  const pause = () => page.getByRole('button', { name: '暂停实时日志', exact: true });
  const resume = () => page.getByRole('button', { name: '恢复实时日志', exact: true });
  const logRequests = new WeakSet();
  const onRequest = request => {
    const u = new URL(request.url());
    if (u.pathname === '/api/events') proof.sse.requests++;
    if (u.pathname === '/api/logs' && request.method() === 'GET') {
      proof.logs.requests++;
      const ids = u.searchParams.getAll('projectId');
      if (ids.length === 1 && fixtureIds.includes(ids[0])) { proof.logs.perFixture[ids[0]]++; logRequests.add(request); }
    }
  };
  const onResponse = response => {
    const u = new URL(response.url());
    if (u.pathname === '/api/events' && response.status() === 200 && /text\/event-stream/i.test(response.headers()['content-type'] ?? '')) proof.sse.successfulHeaders++;
    if (logRequests.has(response.request()) && response.status() === 200) proof.logs.successful++;
  };
  const onFailed = request => { if (new URL(request.url()).pathname === '/api/events') proof.sse.failures++; };
  const onPageError = () => { proof.pageErrors++; };
  // Never retrieve or archive historical logs outside the two root-owned fixture projects.
  const logGuard = async route => {
    const ids = new URL(route.request().url()).searchParams.getAll('projectId');
    if (ids.length !== 1 || !fixtureIds.includes(ids[0])) { proof.logs.blockedUnscoped++; return route.abort('blockedbyclient'); }
    return route.continue();
  };
  const until = async (predicate, message, timeout = 12000) => {
    const deadline = Date.now() + timeout;
    while (!await predicate()) { if (Date.now() > deadline) throw Error(message); await page.waitForTimeout(100); }
  };
  const connected = () => until(async () => await state.textContent() === '事件流已连接', 'Real SSE did not reach connected UI');
  const mark = name => proof.steps.push({ name, at: new Date().toISOString(), sseHeaders: proof.sse.successfulHeaders, logReads: proof.logs.requests });
  let fixtureNames;
  const selectProject = async index => {
    const wrapper = page.getByRole('combobox', { name: '日志工程筛选' }).locator('xpath=ancestor::div[contains(@class,"el-select__wrapper")][1]');
    await wrapper.click();
    if (index === 1) await page.getByRole('option', { name: fixtureNames[0], exact: true }).click();
    await page.getByRole('option', { name: fixtureNames[index], exact: true }).click();
    await page.keyboard.press('Escape');
  };
  await mkdir(proofDir, { recursive: true });
  page.on('request', onRequest); page.on('response', onResponse); page.on('requestfailed', onFailed); page.on('pageerror', onPageError);
  await page.route('**/api/logs?**', logGuard);
  await page.route('**/api/events', sseRoute);
  try {
    await page.goto(target.href, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('companion-browser-page').waitFor();
    await until(async () => await page.getByRole('button', { name: '启用实时更新', exact: true }).isEnabled(), 'Project connection not ready');
    fixtureNames = await Promise.all(fixtureIds.map(async id => {
      const card = page.locator('.companion-project-card').filter({ has: page.locator('.project-header-id', { hasText: id }) });
      if (await card.count() !== 1) throw Error('Task fixture card not unique');
      return (await card.locator('h3').textContent()).trim();
    }));
    if (fixtureNames[0] === fixtureNames[1]) throw Error('Distinct fixture display names required');
    await page.locator('a[href="#/projects?tab=logs"]').click();
    await selectProject(0);
    await page.getByRole('button', { name: '启用实时更新', exact: true }).click();
    await connected();
    await until(() => proof.sse.successfulHeaders >= 1 && proof.logs.successful >= 1, 'No real SSE headers or fixture log read observed');
    mark('real-sse-open-and-fixture-read');

    // Fail exactly one browser subscription request after explicitly closing the original stream.
    // This verifies connection-establishment retry, not interruption of TCP or a natural outage.
    const initialHeaders = proof.sse.successfulHeaders;
    await page.getByRole('button', { name: '停止实时更新', exact: true }).click();
    await until(async () => await state.textContent() === '实时更新未启用', 'Original subscription did not stop');
    abortNextSse = true;
    await page.getByRole('button', { name: '启用实时更新', exact: true }).click();
    await until(async () => proof.sse.controlledSubscriptionFailures === 1 && await state.textContent() === '事件流冷却重连中', 'Controlled subscription failure did not enter cooldown', 5000);
    mark('controlled-subscription-establishment-failure-cooldown');
    await connected();
    await until(() => proof.sse.successfulHeaders > initialHeaders, 'No fresh real SSE response after reconnect');
    if (proof.sse.controlledSubscriptionFailures !== 1) throw Error('Unexpected number of controlled subscription failures');
    proof.reconnectScope = 'One route-aborted browser subscription during establishment; subsequent real SSE response. Original TCP interruption and natural outages unverified.';
    mark('real-sse-reconnected-after-subscription-failure');

    const beforeLeave = proof.sse.requests;
    await page.locator('a[href="#/migration"]').first().click();
    await state.waitFor({ state: 'detached' });
    await page.waitForTimeout(1200);
    if (proof.sse.requests !== beforeLeave) throw Error('SSE resubscribed while off page');
    mark('left-page-no-resubscription');
    await page.locator('a[href="#/projects"]').first().click();
    await connected();
    await until(() => proof.sse.requests > beforeLeave, 'No fresh SSE subscription on page return');
    await page.locator('a[href="#/projects?tab=logs"]').click();
    mark('returned-page-fresh-real-stream');

    await pause().click(); await resume().waitFor();
    await selectProject(1);
    // Filter changes are allowed to perform a manual read even while live delivery is paused.
    await until(() => proof.logs.perFixture[fixtureIds[1]] >= 1, 'Current fixture filter did not query');
    await page.waitForFunction(() => !document.querySelector('.companion-log-toolbar .el-button.is-loading'));
    await page.waitForTimeout(700);
    const pausedReads = proof.logs.requests;
    await page.waitForTimeout(1400);
    if (proof.logs.requests !== pausedReads) throw Error('Unexpected live log query during paused observation');
    mark('paused-current-fixture-observation');
    await resume().click(); await pause().waitFor();
    await until(() => proof.logs.requests > pausedReads, 'Resume did not reconcile current fixture logs');
    await page.waitForFunction(() => !document.querySelector('.companion-log-toolbar .el-button.is-loading'));
    const displayedProjectIds = await page.locator('.companion-log-pane article small').evaluateAll(nodes => nodes.map(n => n.textContent.split(' · ').at(-1).trim()));
    if (displayedProjectIds.some(id => id !== fixtureIds[1])) throw Error('Log rows leaked from another project');
    proof.currentFixtureRows = displayedProjectIds.length;
    mark('resumed-only-current-fixture');
    // Crop status only; never archive raw log messages or browser cookies.
    await state.screenshot({ path: join(proofDir, 'live-state-only.png') });
    if (proof.pageErrors) throw Error('Page emitted runtime errors');
    proof.status = 'passed';
    return proof;
  } catch (error) {
    proof.status = 'failed';
    proof.failure = error instanceof Error && /^[A-Za-z0-9 .-]{1,160}$/.test(error.message) ? error.message : 'Scenario failed; root must inspect locally without raw log capture';
    throw Object.assign(new Error(proof.failure), { proof });
  } finally {
    abortNextSse = false;
    await page.getByRole('button', { name: '停止实时更新', exact: true }).click({ timeout: 1500 }).catch(() => undefined);
    page.off('request', onRequest); page.off('response', onResponse); page.off('requestfailed', onFailed); page.off('pageerror', onPageError);
    await page.unroute('**/api/logs?**', logGuard);
    await page.unroute('**/api/events', sseRoute);
    proof.finishedAt = new Date().toISOString();
    await writeFile(join(proofDir, 'logs-sse-proof.json'), JSON.stringify(proof, null, 2));
  }
}
