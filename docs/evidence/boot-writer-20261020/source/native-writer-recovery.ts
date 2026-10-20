import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { daemonIdentitySchema } from "./lifecycle-drain.js";
import type { WindowsDaemonOwner } from "./windows-daemon-owner.js";
import type { WindowsBootSession } from "./windows-boot-session.js";
import { retainWindowsWriterLock } from "./windows-writer-lock-retention.js";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const utc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/);
export const writerSessionSchema = z.object({ machineId: z.string().uuid(), bootId: z.string().uuid(), systemProcessCreatedAt: utc }).strict();
const osSchema = z.object({ pid: z.number().int().positive(), creationTime: utc, executablePath: z.string().min(1), commandLineSha256: hash }).strict();
export const writerOwnerSchema = z.object({ kind: z.literal("native-writer-owner-v2"), daemonIdentity: daemonIdentitySchema,
  os: osSchema, bootSession: writerSessionSchema }).strict().refine(value => value.os.pid === value.daemonIdentity.pid);
export type WriterOwner = z.infer<typeof writerOwnerSchema>;
export const legacyWriterRecoverySchema = z.object({ schemaVersion: z.literal(1), scope: z.literal("WRITER_ONLY"),
  anchorDigest: hash, currentSession: writerSessionSchema, oldIdentity: daemonIdentitySchema,
  lock: z.object({ sha256: hash, bytes: z.number().int().positive().max(32768) }).strict() }).strict();
export type LegacyWriterRecovery = z.infer<typeof legacyWriterRecoverySchema>;
const baseLock = z.object({ writer: z.string().uuid(), pid: z.number().int().positive(), openedAt: z.string().datetime() });
const lockSchema = z.union([baseLock.extend({ schemaVersion: z.literal(1) }).strict(),
  baseLock.extend({ schemaVersion: z.literal(2), owner: writerOwnerSchema }).strict()]);
const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const refuse = (): never => { throw new Error("NATIVE_WRITER_OWNERSHIP_UNVERIFIED"); };
export const sameWriterSession = (left: z.infer<typeof writerSessionSchema>, right: z.infer<typeof writerSessionSchema>) =>
  left.machineId === right.machineId && left.bootId === right.bootId && left.systemProcessCreatedAt === right.systemProcessCreatedAt;
export async function boundedWriterFile(path: string): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 32768) return refuse();
  const handle = await open(path, "r");
  try {
    const opened = await handle.stat();
    if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size || opened.nlink !== 1) return refuse();
    const bytes = await handle.readFile(); const after = await handle.stat(); const named = await lstat(path);
    if (after.ino !== named.ino || after.dev !== named.dev || after.size !== before.size || after.mtimeMs !== before.mtimeMs || named.nlink !== 1) return refuse();
    return bytes;
  } finally { await handle.close(); }
}

/** Service-only writer ownership. Never native-worker exit or quiescence authority. */
export async function recoverWriterLock(options: {
  journalPath: string; session: WindowsBootSession; owner: WriterOwner; anchorDigest: string;
  legacy?: LegacyWriterRecovery; inspectOwner: (pid: number) => Promise<WindowsDaemonOwner | null>;
  recheck: () => Promise<void>;
}, retain = retainWindowsWriterLock): Promise<string> {
  const owner = writerOwnerSchema.parse(options.owner);
  if (!sameWriterSession(owner.bootSession, options.session)) return refuse();
  const path = `${options.journalPath}.boot-${options.session.bootId}.lock`;
  let bytes: Buffer;
  try { bytes = await boundedWriterFile(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") { await options.recheck(); return path; } throw error; }
  const lock = lockSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (lock.schemaVersion === 2 && lock.pid === owner.daemonIdentity.pid && JSON.stringify(lock.owner) === JSON.stringify(owner)) {
    await options.recheck(); return path; // Post-acquisition recheck of this exact service owner.
  }
  if (lock.schemaVersion === 1) {
    const binding = options.legacy && legacyWriterRecoverySchema.parse(options.legacy);
    if (!binding || binding.anchorDigest !== options.anchorDigest || !sameWriterSession(binding.currentSession, options.session)
      || binding.lock.bytes !== bytes.length || binding.lock.sha256 !== digest(bytes) || binding.oldIdentity.pid !== lock.pid) return refuse();
    const locator = JSON.parse((await boundedWriterFile(join(dirname(options.journalPath), "daemon.json"))).toString("utf8")) as { identity?: unknown };
    const identity = daemonIdentitySchema.parse(locator.identity);
    if (JSON.stringify(identity) !== JSON.stringify(binding.oldIdentity) || resolve(identity.entryPath) !== resolve(owner.daemonIdentity.entryPath)) return refuse();
    // A legacy PID has no stored OS creation identity: require positive absence.
    if (await options.inspectOwner(lock.pid) !== null) return refuse();
  } else {
    const previous = lock.owner;
    if (previous.daemonIdentity.pid !== lock.pid || previous.bootSession.machineId !== options.session.machineId
      || previous.bootSession.bootId !== options.session.bootId || resolve(previous.daemonIdentity.entryPath) !== resolve(owner.daemonIdentity.entryPath)) return refuse();
    const observed = await options.inspectOwner(lock.pid);
    if (observed && (observed.pid !== lock.pid || observed.creationTime === previous.os.creationTime)) return refuse();
    // A reused PID is observed only; never terminated or treated as the old owner.
  }
  await options.recheck();
  const observedAgain = await options.inspectOwner(lock.pid);
  if (observedAgain && (lock.schemaVersion === 1 || observedAgain.pid !== lock.pid || observedAgain.creationTime === lock.owner.os.creationTime)) return refuse();
  const retained = await retain(path, digest(bytes), bytes.length);
  if (retained !== `${path}.retained-${digest(bytes)}` || digest(await boundedWriterFile(retained)) !== digest(bytes)) return refuse();
  await options.recheck();
  return path; // Every contender still acquires the SAME canonical path with wx.
}
