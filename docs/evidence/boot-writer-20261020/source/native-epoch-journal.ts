import { createHash, randomUUID } from "node:crypto";
import { writerOwnerSchema, type WriterOwner } from "./native-writer-recovery.js";
import { lstat, open, unlink, type FileHandle } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { daemonIdentitySchema, type DaemonIdentity } from "./lifecycle-drain.js";

export type JournalJson = null | boolean | number | string | JournalJson[] | { [key: string]: JournalJson };
export interface NativeUnknownAggregate { count: number; [key: string]: JournalJson }
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const jsonSchema: z.ZodType<JournalJson> = z.lazy(() => z.union([
  z.null(), z.boolean(), z.number().finite(), z.string(), z.array(jsonSchema), z.record(z.string(), jsonSchema),
]));
const aggregateSchema = z.object({ count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).catchall(jsonSchema);
const bindingSchema = z.object({ daemonIdentity: daemonIdentitySchema, aggregateDigest: hashSchema, proofHash: hashSchema }).strict();
const attestationSchema = bindingSchema.extend({ kind: z.literal("native-quiescence-observed-v1") }).strict();
export type QuiescenceBinding = z.infer<typeof bindingSchema>;
export type NativeQuiescenceAttestation = z.infer<typeof attestationSchema>;
/** Installed by trusted service composition, never supplied by HTTP/RPC callers. It must independently
 * verify quiescence; echoing an external proof or accepting a caller's boolean is not a verifier. */
export type TrustedQuiescenceVerifier = (binding: Readonly<QuiescenceBinding>, proof: Readonly<Record<string, JournalJson>>) => Promise<NativeQuiescenceAttestation>;

const unknownSchema = z.object({ kind: z.literal("unknown-aggregate"), outcome: z.literal("UNKNOWN"),
  daemonIdentity: daemonIdentitySchema, aggregate: aggregateSchema, aggregateDigest: hashSchema }).strict();
const evidenceSchema = z.object({ kind: z.literal("quiescence-evidence"), binding: bindingSchema,
  proof: z.record(z.string(), jsonSchema), attestation: attestationSchema }).strict();
const payloadSchema = z.discriminatedUnion("kind", [unknownSchema, evidenceSchema]);
const recordSchema = z.object({ schemaVersion: z.literal(1), sequence: z.number().int().positive(),
  previousHash: hashSchema, payload: payloadSchema, hash: hashSchema }).strict();
const witnessSchema = z.object({ sequence: z.number().int().positive(), recordHash: hashSchema, checksum: hashSchema }).strict();
export type NativeUnknownRecord = z.infer<typeof unknownSchema>;
export type NativeQuiescenceRecord = z.infer<typeof evidenceSchema>;
type JournalRecord = z.infer<typeof recordSchema>;
export interface NativeEpochHistory {
  unknownAggregates: NativeUnknownRecord[];
  quiescenceEvidence: NativeQuiescenceRecord[];
  historicalUnknownCount: number;
  archivedUnknownCount: number;
  unprovenInFlightCount: number;
}
const ZERO_HASH = "0".repeat(64);
const MAX_BYTES = 64 * 1024 * 1024;
function fail(message: string): never { throw new Error(`NATIVE_EPOCH_JOURNAL: ${message}`); }
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function equal(left: unknown, right: unknown): boolean { return canonical(left) === canonical(right); }
function sum(values: number[]): number {
  const result = values.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(result)) fail("aggregate count exceeds exact integer range");
  return result;
}
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
async function assertFile(path: string, handle: FileHandle): Promise<void> {
  const [entry, descriptor] = await Promise.all([lstat(path), handle.stat()]);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.dev !== descriptor.dev || entry.ino !== descriptor.ino) fail("file replaced or not a regular file");
}
async function readText(handle: FileHandle): Promise<string> {
  const size = (await handle.stat()).size;
  if (size > MAX_BYTES) fail("journal budget exceeded");
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(bytes, offset, size - offset, offset);
    if (!bytesRead) fail("file truncated during read");
    offset += bytesRead;
  }
  if ((await handle.stat()).size !== size) fail("concurrent file mutation");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function lines(text: string): unknown[] {
  if (!text) return [];
  if (!text.endsWith("\n")) fail("incomplete trailing record");
  return text.slice(0, -1).split("\n").map((line) => JSON.parse(line) as unknown);
}
function history(records: JournalRecord[]): NativeEpochHistory {
  const unknownAggregates: NativeUnknownRecord[] = [];
  const quiescenceEvidence: NativeQuiescenceRecord[] = [];
  const byDigest = new Map<string, NativeUnknownRecord>();
  const epochs = new Set<string>();
  const archived = new Set<string>();
  const evidenceBindings = new Set<string>();
  for (const { payload } of records) {
    if (payload.kind === "unknown-aggregate") {
      if (epochs.has(payload.daemonIdentity.startupEpoch)) fail("duplicate or conflicting epoch aggregate");
      if (payload.aggregateDigest !== digest({ daemonIdentity: payload.daemonIdentity, aggregate: payload.aggregate })) fail("aggregate digest mismatch");
      epochs.add(payload.daemonIdentity.startupEpoch); byDigest.set(payload.aggregateDigest, payload); unknownAggregates.push(payload);
    } else {
      const target = byDigest.get(payload.binding.aggregateDigest);
      if (!target || !equal(target.daemonIdentity, payload.binding.daemonIdentity)) fail("evidence does not bind an earlier exact epoch aggregate");
      const evidenceBinding = canonical(payload.binding);
      if (evidenceBindings.has(evidenceBinding)) fail("duplicate quiescence evidence binding");
      if (!equal(payload.attestation, { kind: "native-quiescence-observed-v1", ...payload.binding }) || payload.binding.proofHash !== digest(payload.proof)) fail("evidence proof binding mismatch");
      evidenceBindings.add(evidenceBinding);
      archived.add(payload.binding.aggregateDigest); quiescenceEvidence.push(payload);
    }
  }
  return { unknownAggregates, quiescenceEvidence,
    historicalUnknownCount: sum(unknownAggregates.map((row) => row.aggregate.count)),
    archivedUnknownCount: sum(unknownAggregates.filter((row) => archived.has(row.aggregateDigest)).map((row) => row.aggregate.count)),
    unprovenInFlightCount: sum(unknownAggregates.filter((row) => !archived.has(row.aggregateDigest)).map((row) => row.aggregate.count)) };
}

/** Append-only single-writer journal. Both data and independent head witness are fsynced before
 * acknowledgement. A partial transaction, stale lock, corrupt data or one-file truncation fails closed.
 * This detects corruption, not an attacker rolling back BOTH files together: that needs an external
 * trusted monotonic anchor. Never delete a stale lock or repair files automatically at startup. */
export class NativeEpochJournal {
  private pending: Promise<unknown> = Promise.resolve();
  private closing = false;
  private closePromise: Promise<void> | undefined;
  private poisoned = false;
  private sequence = 0;
  private head = ZERO_HASH;
  private constructor(private readonly path: string, private readonly data: FileHandle,
    private readonly witness: FileHandle, private readonly lock: FileHandle,
    private readonly lockToken: string, private readonly verifier: TrustedQuiescenceVerifier | undefined,
    private readonly lockPath: string) {}

  static async open(options: { path: string; trustedVerifier?: TrustedQuiescenceVerifier; writerLockPath?: string; writerOwner?: WriterOwner }): Promise<NativeEpochJournal> {
    const path = resolve(options.path);
    // Only trusted service composition may choose a boot-scoped writer lock.
    const lockPath = options.writerLockPath === undefined ? `${path}.lock` : resolve(options.writerLockPath);
    if (lockPath !== `${path}.lock` && !new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.boot-[0-9a-f-]{36}\\.lock$`, "i").test(lockPath)) fail("invalid writer lock path");
    const owner = options.writerOwner && writerOwnerSchema.parse(options.writerOwner);
    if (owner && owner.daemonIdentity.pid !== process.pid) fail("writer owner does not bind this process");
    const lockToken = JSON.stringify({ schemaVersion: owner ? 2 : 1, writer: randomUUID(), pid: process.pid, openedAt: new Date().toISOString(), ...(owner ? { owner } : {}) });
    // A failed wx acquisition never touches somebody else's lock.
    const lock = await open(lockPath, "wx+", 0o600);
    let data: FileHandle | undefined; let witness: FileHandle | undefined;
    try {
      await lock.writeFile(lockToken); await lock.sync();
      const [hasData, hasWitness] = await Promise.all([exists(path), exists(`${path}.head`)]);
      if (hasData !== hasWitness) fail("data/head pair incomplete");
      if (hasData) {
        for (const item of [path, `${path}.head`]) { const info = await lstat(item); if (!info.isFile() || info.isSymbolicLink()) fail("non-regular journal path"); }
      }
      data = await open(path, hasData ? "a+" : "ax+", 0o600);
      witness = await open(`${path}.head`, hasData ? "a+" : "ax+", 0o600);
      if (!hasData) { await data.sync(); await witness.sync(); }
      const journal = new NativeEpochJournal(path, data, witness, lock, lockToken, options.trustedVerifier, lockPath);
      await journal.verify(false);
      return journal;
    } catch (error) {
      await Promise.allSettled([data?.close(), witness?.close()]);
      try { await assertFile(lockPath, lock); if (await readText(lock) === lockToken) await unlink(lockPath); } finally { await lock.close(); }
      throw error;
    }
  }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closing || this.poisoned) return Promise.reject(new Error("NATIVE_EPOCH_JOURNAL: closed or failed writer"));
    const result = this.pending.then(async () => {
      if (this.poisoned) fail("failed writer");
      return operation();
    });
    this.pending = result.catch(() => undefined);
    return result;
  }
  private async verify(checkHead = true): Promise<{ records: JournalRecord[]; state: NativeEpochHistory }> {
    try {
      await Promise.all([assertFile(this.path, this.data), assertFile(`${this.path}.head`, this.witness), assertFile(this.lockPath, this.lock)]);
      if (await readText(this.lock) !== this.lockToken) fail("writer lock changed");
      const [rawData, rawWitness] = await Promise.all([readText(this.data), readText(this.witness)]);
      const records = lines(rawData).map((row) => recordSchema.parse(row));
      const heads = lines(rawWitness).map((row) => witnessSchema.parse(row));
      if (records.length !== heads.length) fail("truncated or uncommitted journal/head");
      let head = ZERO_HASH;
      for (let index = 0; index < records.length; index++) {
        const row = records[index]!; const witness = heads[index]!;
        const { hash, ...unsigned } = row;
        if (row.sequence !== index + 1 || row.previousHash !== head || hash !== digest(unsigned)) fail("record chain invalid");
        if (witness.sequence !== row.sequence || witness.recordHash !== hash || witness.checksum !== digest({ sequence: row.sequence, recordHash: hash })) fail("head witness invalid");
        head = hash;
      }
      if (checkHead && (this.sequence !== records.length || this.head !== head)) fail("unexpected external append or rollback");
      const state = history(records);
      this.sequence = records.length; this.head = head;
      return { records, state };
    } catch (error) { this.poisoned = true; throw error; }
  }
  private async append(payload: z.infer<typeof payloadSchema>, beforeCommit?: () => void): Promise<void> {
    const unsigned = { schemaVersion: 1 as const, sequence: this.sequence + 1, previousHash: this.head, payload };
    const hash = digest(unsigned);
    const witness = { sequence: unsigned.sequence, recordHash: hash };
    let commitStarted = false;
    try {
      const dataLine = `${canonical({ ...unsigned, hash })}\n`;
      const witnessLine = `${canonical({ ...witness, checksum: digest(witness) })}\n`;
      if ((await this.data.stat()).size + Buffer.byteLength(dataLine) > MAX_BYTES ||
        (await this.witness.stat()).size + Buffer.byteLength(witnessLine) > MAX_BYTES) fail("journal budget exceeded");
      // Last synchronous boundary before the first durable transaction write. Once a
      // transaction starts, finish data+head fsync even if its deadline later expires.
      beforeCommit?.();
      commitStarted = true;
      await this.data.writeFile(dataLine); await this.data.sync();
      await this.witness.writeFile(witnessLine); await this.witness.sync();
      this.sequence = unsigned.sequence; this.head = hash;
    } catch (error) { if (commitStarted) this.poisoned = true; throw error; }
  }
  loadHistory(): Promise<NativeEpochHistory> { return this.run(async () => structuredClone((await this.verify()).state)); }

  /** Server-owned observation only. An epoch has one immutable aggregate; identical retries are idempotent. */
  recordUnknownAggregate(input: { daemonIdentity: DaemonIdentity; aggregate: NativeUnknownAggregate }): Promise<NativeUnknownRecord> {
    const daemonIdentity = daemonIdentitySchema.parse(input.daemonIdentity);
    const aggregate = aggregateSchema.parse(input.aggregate);
    return this.run(async () => {
      const { state } = await this.verify();
      const aggregateDigest = digest({ daemonIdentity, aggregate });
      const existing = state.unknownAggregates.find((row) => row.daemonIdentity.startupEpoch === daemonIdentity.startupEpoch);
      if (existing) { if (existing.aggregateDigest !== aggregateDigest) fail("epoch aggregate conflict"); return structuredClone(existing); }
      sum([...state.unknownAggregates.map((row) => row.aggregate.count), aggregate.count]);
      const payload: NativeUnknownRecord = { kind: "unknown-aggregate", outcome: "UNKNOWN", daemonIdentity, aggregate, aggregateDigest };
      await this.append(payload); return structuredClone(payload);
    });
  }
  /** Proof is not authority: only the composition-installed verifier can attest the exact binding.
   * Fresh proofs each require approval; identical bindings are idempotent. Multiple observations
   * archive an aggregate only once, never changing UNKNOWN to a successful/cancelled request. */
  recordQuiescenceEvidence(input: { daemonIdentity: DaemonIdentity; aggregateDigest: string; proof: Record<string, JournalJson>; beforeCommit?: () => void }): Promise<NativeQuiescenceRecord> {
    const daemonIdentity = daemonIdentitySchema.parse(input.daemonIdentity);
    const aggregateDigest = hashSchema.parse(input.aggregateDigest);
    const proof = z.record(z.string(), jsonSchema).parse(input.proof);
    if (Object.keys(proof).length === 0) return Promise.reject(new Error("NATIVE_EPOCH_JOURNAL: empty proof"));
    return this.run(async () => {
      const { state } = await this.verify();
      const target = state.unknownAggregates.find((row) => row.aggregateDigest === aggregateDigest);
      if (!target || !equal(target.daemonIdentity, daemonIdentity)) fail("evidence target identity mismatch");
      const binding: QuiescenceBinding = { daemonIdentity, aggregateDigest, proofHash: digest(proof) };
      const existing = state.quiescenceEvidence.find((row) => equal(row.binding, binding));
      if (existing) return structuredClone(existing);
      if (!this.verifier) fail("trusted quiescence verifier unavailable");
      const attestation = attestationSchema.parse(await this.verifier(structuredClone(binding), structuredClone(proof)));
      if (!equal(attestation, { kind: "native-quiescence-observed-v1", ...binding })) fail("verifier binding mismatch");
      // The verifier may await I/O; revalidate before persisting its observation.
      await this.verify();
      const payload: NativeQuiescenceRecord = { kind: "quiescence-evidence", binding, proof, attestation };
      await this.append(payload, input.beforeCommit); return structuredClone(payload);
    });
  }
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closing = true;
    this.closePromise = (async () => {
      await this.pending;
      const results = await Promise.allSettled([this.data.close(), this.witness.close()]);
      try {
        await assertFile(this.lockPath, this.lock);
        if (await readText(this.lock) !== this.lockToken) fail("writer lock changed during close");
        await unlink(this.lockPath);
      } finally { await this.lock.close(); }
      for (const result of results) if (result.status === "rejected") throw result.reason;
    })();
    return this.closePromise;
  }
}

export const openNativeEpochJournal = NativeEpochJournal.open;
