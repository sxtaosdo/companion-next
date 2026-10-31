// Explicit read-only scope/evidence checks. No discovery of user data, services or editor actions.
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyWorkflowEvidence } from './workflow-evidence-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// Mirrored from mcp/src/companion/product-version.ts:7-11,18-31. Drift fails closed.
export const productVersionContractSha256 = '95436c23c88b1bcb5b9af7ce492449c3cc6f198b9fdd32c089e511e23f25a984';
const shaPattern = /^[a-f0-9]{64}$/, revisionPattern = /^[a-f0-9]{40}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function strictKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw new Error('PRODUCT_BUILD_STRICT_KEYS_REJECTED');
}
function regularBytes(path, max) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > max) throw new Error('DELIVERY_NOT_REGULAR_OR_TOO_LARGE');
  const bytes = readFileSync(path); if (bytes.length > max) throw new Error('DELIVERY_TOO_LARGE'); return bytes;
}
export function verifyProductBuild(manifest, entryBytes, packageBytes, expected) {
  strictKeys(manifest, ['schemaVersion', 'product', 'build', 'entrySha256']);
  strictKeys(manifest.product, ['name', 'version']);
  strictKeys(manifest.build, ['id', 'sourceRevision', 'packageName', 'packageVersion', 'packageSha256']);
  const build = manifest.build, product = manifest.product;
  const stringMatches = (value, pattern) => typeof value === 'string' && pattern.test(value);
  if (manifest.schemaVersion !== 'companion-product-build-v1' || product.name !== 'Creator AI Companion' || !stringMatches(product.version, versionPattern)
    || !stringMatches(build.packageVersion, versionPattern) || !stringMatches(build.sourceRevision, revisionPattern)
    || !stringMatches(build.packageSha256, shaPattern) || !stringMatches(manifest.entrySha256, shaPattern)
    || ![build.id, build.packageName].every(value => typeof value === 'string' && value.length >= 1 && value.length <= 120)) throw new Error('PRODUCT_BUILD_SCHEMA_REJECTED');
  const pkg = JSON.parse(packageBytes);
  if (!pkg || typeof pkg.name !== 'string' || !stringMatches(pkg.version, versionPattern)) throw new Error('HOST_PACKAGE_SCHEMA_REJECTED');
  if (digest(entryBytes) !== manifest.entrySha256 || manifest.entrySha256 !== expected.entrySha256) throw new Error('DELIVERY_ENTRY_IDENTITY_MISMATCH');
  if (digest(packageBytes) !== build.packageSha256 || build.packageSha256 !== expected.packageSha256 || pkg.name !== build.packageName || pkg.version !== build.packageVersion || pkg.version !== product.version) throw new Error('DELIVERY_PACKAGE_IDENTITY_MISMATCH');
  if (product.version !== expected.version || build.sourceRevision !== expected.sourceRevision) throw new Error('DELIVERY_EXPECTATION_MISMATCH');
  return { product, build, entrySha256: manifest.entrySha256 };
}
export function verifyDelivery(delivery) {
  if (delivery.schemaVersion !== 1 || !['manifestPath', 'entryPath', 'packagePath', 'contractSourcePath'].every(key => typeof delivery[key] === 'string' && isAbsolute(delivery[key]))
    || !shaPattern.test(delivery.manifestSha256 ?? '') || !shaPattern.test(delivery.entrySha256 ?? '') || !shaPattern.test(delivery.packageSha256 ?? '')
    || !versionPattern.test(delivery.version ?? '') || !revisionPattern.test(delivery.sourceRevision ?? '')) throw new Error('DELIVERY_EXPECTATIONS_REQUIRED');
  if (resolve(delivery.manifestPath) !== resolve(dirname(delivery.entryPath), 'product-build.json') || resolve(delivery.packagePath) !== resolve(dirname(delivery.entryPath), 'host-package.json')) throw new Error('DELIVERY_FILES_MUST_MATCH_CONSUMER_LAYOUT');
  if (digest(regularBytes(delivery.contractSourcePath, 64 * 1024)) !== productVersionContractSha256) throw new Error('PRODUCT_VERSION_CONTRACT_DRIFT');
  const manifestBytes = regularBytes(delivery.manifestPath, 16 * 1024);
  const result = verifyProductBuild(JSON.parse(manifestBytes), regularBytes(delivery.entryPath, 32 * 1024 * 1024), regularBytes(delivery.packagePath, 64 * 1024), delivery);
  if (digest(manifestBytes) !== delivery.manifestSha256) throw new Error('DELIVERY_MANIFEST_IDENTITY_MISMATCH');
  return { ...result, manifestSha256: delivery.manifestSha256, contractSourceSha256: productVersionContractSha256, coverage: 'Offline manifest/schema and exact declared artifact bytes only; no running-process or live API acceptance.' };
}
function scopePath(value) {
  if (typeof value !== 'string' || !value || /[\\:\0]/.test(value) || isAbsolute(value) || value.split('/').some(part => !part || part === '..' || part === '.' || part.toLowerCase() === '.git')) throw new Error('INVALID_SCOPE_PATH');
  return value;
}
const overlaps = (left, right) => { const a = left.toLowerCase(), b = right.toLowerCase(); return a === b || a.startsWith(b + '/') || b.startsWith(a + '/'); };

export function verifyManifest(manifest, project = root, actualHead) {
  if (manifest.schemaVersion !== 1 || typeof manifest.task !== 'string' || !manifest.task.trim() || typeof manifest.owner !== 'string' || !manifest.owner.trim()) throw new Error('TASK_AND_OWNER_REQUIRED');
  if (!/^[a-f0-9]{40}$/.test(manifest.expectedHead ?? '') || manifest.expectedHead !== actualHead) throw new Error('HEAD_BASELINE_MISMATCH');
  if (!Array.isArray(manifest.scope) || !manifest.scope.length || !Array.isArray(manifest.parallelOwners) || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('SCOPE_BASELINE_REQUIRED');
  const own = manifest.scope.map(scopePath), claims = [...own.map(path => ({ owner: manifest.owner, path }))];
  for (const other of manifest.parallelOwners) {
    if (!other.owner || other.owner === manifest.owner || !Array.isArray(other.scope) || !other.scope.length) throw new Error('INVALID_PARALLEL_OWNER');
    claims.push(...other.scope.map(path => ({ owner: other.owner, path: scopePath(path) })));
  }
  for (let a = 0; a < claims.length; a++) for (let b = a + 1; b < claims.length; b++) if (overlaps(claims[a].path, claims[b].path)) throw new Error('OVERLAPPING_OWNER_SCOPE');
  const seen = new Set(), files = [];
  for (const item of manifest.files) {
    if (!['source', 'protected', 'artifact', 'evidence'].includes(item.role) || typeof item.path !== 'string' || !item.path) throw new Error('INVALID_BASELINE_FILE');
    if (item.role === 'source') {
      const path = scopePath(item.path);
      if (!own.some(scope => path.toLowerCase() === scope.toLowerCase() || path.toLowerCase().startsWith(scope.toLowerCase() + '/'))) throw new Error('SOURCE_OUTSIDE_OWNER_SCOPE');
    }
    const path = resolve(project, item.path);
    if (relative(project, path).split(/[\\/]/).includes('.git') || seen.has(path.toLowerCase())) throw new Error('DUPLICATE_OR_GIT_FILE');
    seen.add(path.toLowerCase());
    if (!(item.sha256 === null || /^[a-f0-9]{64}$/.test(item.sha256 ?? ''))) throw new Error('INVALID_EXPECTED_HASH');
    if (['artifact', 'evidence'].includes(item.role) && item.sha256 === null) throw new Error('ARTIFACT_EVIDENCE_MUST_EXIST');
    let actual;
    try { actual = digest(readFileSync(path)); } catch (error) { if (error.code === 'ENOENT') actual = null; else throw error; }
    if (actual !== item.sha256) throw new Error(`FILE_BASELINE_MISMATCH: ${item.path}`);
    files.push({ path, role: item.role, sha256: actual });
  }
  if (!manifest.files.some(file => file.role === 'protected')) throw new Error('PROTECTED_BASELINE_REQUIRED');
  if (!own.every(scope => manifest.files.some(file => file.role === 'source' && (file.path.toLowerCase() === scope.toLowerCase() || file.path.toLowerCase().startsWith(scope.toLowerCase() + '/'))))) throw new Error('OWNED_SCOPE_BASELINE_REQUIRED');
  return { task: manifest.task, owner: manifest.owner, head: actualHead, scope: own, parallelOwners: manifest.parallelOwners, files, coverage: 'Declared paths and hashes only; not authorization, full-repository coverage, runtime identity or business acceptance.' };
}

// Workflow evidence is explicit and local. A policy is an independent caller trust boundary,
// not a user authorization or proof that service/model execution actually occurred.
export function verifyWorkflowFiles(evidencePath, policyPath, verifiedScope) {
  const evidenceBytes = regularBytes(evidencePath, 128 * 1024), policyBytes = regularBytes(policyPath, 64 * 1024);
  const policy = JSON.parse(policyBytes), evidence = JSON.parse(evidenceBytes);
  strictKeys(policy, ['schemaVersion','taskId','mode','phase','applicabilityState','presetId','configDigest','collectorSha256','collectorPath','authority','files']);
  const nonempty = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 16000;
  if (policy.schemaVersion !== 'workflow-policy-v1' || !nonempty(policy.taskId) || !['isolated','production'].includes(policy.mode)
    || !['start','delivery'].includes(policy.phase) || !['applicable','not-applicable'].includes(policy.applicabilityState)) throw new Error('WORKFLOW_POLICY_INVALID');
  if (verifiedScope && policy.taskId !== verifiedScope.task) throw new Error('WORKFLOW_SCOPE_TASK_MISMATCH');
  let policyAuthority;
  if (policy.authority?.kind === 'manifest-pin') {
    strictKeys(policy.authority, ['kind']);
    const matched = verifiedScope?.files?.some(f => ['evidence','protected'].includes(f.role) && resolve(f.path) === resolve(policyPath) && f.sha256 === digest(policyBytes));
    if (!matched) throw new Error('WORKFLOW_POLICY_MANIFEST_PIN_REQUIRED');
    policyAuthority = { kind:'manifest-pin', coverage:'Policy bytes are pinned by the separately verified scope manifest.' };
  } else {
    strictKeys(policy.authority, ['kind','reviewer','reviewReference']);
    if (policy.authority.kind !== 'reviewed-caller-policy' || !nonempty(policy.authority.reviewer) || !nonempty(policy.authority.reviewReference)) throw new Error('WORKFLOW_POLICY_REVIEW_REQUIRED');
    policyAuthority = { ...policy.authority, coverage:'Caller explicitly supplies a manually reviewed independent policy. Review attribution is recorded, not mechanically authenticated or inferred from evidence.' };
  }
  if (!Array.isArray(policy.files) || policy.files.length < 1 || policy.files.length > 64) throw new Error('WORKFLOW_FILE_MAPPING_REQUIRED');
  const files = new Map(), paths = new Set(); let total = 0;
  for (const f of policy.files) {
    strictKeys(f, ['key','absolutePath','sha256']);
    if (!nonempty(f.key) || !isAbsolute(f.absolutePath ?? '') || !shaPattern.test(f.sha256 ?? '') || files.has(f.key) || paths.has(resolve(f.absolutePath).toLowerCase())) throw new Error('WORKFLOW_FILE_MAPPING_INVALID');
    const bytes = regularBytes(f.absolutePath, 2 * 1024 * 1024); total += bytes.length;
    if (total > 16 * 1024 * 1024) throw new Error('WORKFLOW_FILE_BUDGET_EXCEEDED');
    if (digest(bytes) !== f.sha256) throw new Error('WORKFLOW_POLICY_FILE_HASH_MISMATCH');
    files.set(f.key, bytes); paths.add(resolve(f.absolutePath).toLowerCase());
  }
  if (policy.applicabilityState === 'applicable') {
    if (!nonempty(policy.presetId) || !shaPattern.test(policy.configDigest ?? '') || !shaPattern.test(policy.collectorSha256 ?? '') || !isAbsolute(policy.collectorPath ?? '')) throw new Error('WORKFLOW_CAPTURE_PIN_REQUIRED');
    if (digest(regularBytes(policy.collectorPath, 256 * 1024)) !== policy.collectorSha256) throw new Error('WORKFLOW_COLLECTOR_BYTES_MISMATCH');
  } else if ([policy.presetId,policy.configDigest,policy.collectorSha256,policy.collectorPath].some(v => v !== null)) throw new Error('WORKFLOW_NOT_APPLICABLE_POLICY_INVALID');
  const result = verifyWorkflowEvidence(evidence, {taskId:policy.taskId,mode:policy.mode,phase:policy.phase,applicabilityState:policy.applicabilityState,presetId:policy.presetId,configDigest:policy.configDigest,collectorSha256:policy.collectorSha256,files});
  return {evidenceSha256:digest(evidenceBytes),policySha256:digest(policyBytes),policyAuthority,...result};
}

export function main(args = process.argv.slice(2)) {
  try {
    const options = new Map();
    for (let index = 0; index < args.length; index += 2) {
      const flag = args[index], path = args[index + 1];
      if (!['--manifest', '--delivery', '--workflow', '--workflow-policy'].includes(flag) || options.has(flag) || typeof path !== 'string' || !isAbsolute(path)) throw new Error('USAGE: task-preflight.mjs [--manifest <absolute JSON>] [--delivery <absolute JSON>] [--workflow <absolute JSON> --workflow-policy <independent absolute JSON>]');
      options.set(flag, path);
    }
    if (!options.size) throw new Error('EXPLICIT_MANIFEST_OR_DELIVERY_REQUIRED');
    if (options.has('--workflow') !== options.has('--workflow-policy')) throw new Error('WORKFLOW_EVIDENCE_AND_POLICY_REQUIRED');
    if (options.has('--manifest') && !options.has('--workflow')) throw new Error('WORKFLOW_EVIDENCE_REQUIRED_FOR_TASK');
    const result = { gate: 'passed' };
    if (options.has('--manifest')) {
      const bytes = readFileSync(options.get('--manifest')), manifest = JSON.parse(bytes);
      // Reject an explicit task mismatch before Git; verifyWorkflowFiles rechecks against the actually verified scope.
      if (options.has('--workflow-policy') && JSON.parse(regularBytes(options.get('--workflow-policy'), 64 * 1024)).taskId !== manifest.task) throw new Error('WORKFLOW_SCOPE_TASK_MISMATCH');
      const git = spawnSync('git', ['--no-optional-locks', '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
      if (git.error || git.status !== 0) throw new Error('GIT_HEAD_UNAVAILABLE');
      result.scope = { manifestSha256: digest(bytes), ...verifyManifest(manifest, root, git.stdout.trim()) };
    }
    if (options.has('--delivery')) {
      const bytes = readFileSync(options.get('--delivery'));
      result.delivery = { requestSha256: digest(bytes), ...verifyDelivery(JSON.parse(bytes)) };
    }
    if (options.has('--workflow')) result.workflow = verifyWorkflowFiles(options.get('--workflow'), options.get('--workflow-policy'), result.scope);
    console.log(JSON.stringify(result)); return 0;
  } catch (error) { console.error(JSON.stringify({ gate: 'blocked', reason: error.message })); return 1; }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
