#!/usr/bin/env node
/**
 * Scope `npm audit` to one workspace's production dependency tree.
 *
 * Why: the repo-wide gate blocked on advisories that only exist in the Expo/Metro
 * toolchain (`expo` pulls its dev server into "dependencies"), never in the deployed
 * backend. Name-based intersection is deliberately conservative — a hoisted package
 * that also appears in the audited tree is counted, so the gate can over-report but
 * cannot miss an advisory that really reaches the backend. Dev-only names are then
 * removed using the lockfile, which is the only place that labels them correctly.
 *
 * Usage: node scripts/audit-workspace.mjs --workspace api [--fail-on high] [--report-only]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SEVERITY_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };

function parseArgs(argv) {
  const args = { failOn: 'high', reportOnly: false, workspace: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--workspace') args.workspace = argv[++i];
    else if (token === '--fail-on') args.failOn = argv[++i];
    else if (token === '--report-only') args.reportOnly = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.reportOnly && !args.workspace)
    throw new Error('--workspace is required unless --report-only');
  return args;
}

function runJson(npmArgs) {
  // Windows resolves `npm` to npm.cmd, which spawnSync will not find without a shell.
  const result = spawnSync('npm', npmArgs, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 256 * 1024 * 1024,
  });
  // npm exits non-zero when advisories exist or the tree has peers it dislikes;
  // the JSON on stdout is still valid, so only an unparseable stdout is an error.
  try {
    return JSON.parse(result.stdout);
  } catch {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`npm ${npmArgs.join(' ')} produced no JSON (exit ${result.status})`);
  }
}

/** Collect every package name reachable from a workspace's production tree. */
function productionPackageNames(workspace) {
  const args = ['ls', '--omit=dev', '--all', '--json'];
  if (workspace) args.push('-w', workspace);
  const tree = runJson(args);
  const names = new Set();
  (function walk(node) {
    for (const [name, child] of Object.entries(node.dependencies ?? {})) {
      names.add(name);
      walk(child);
    }
  })(tree);
  return names;
}

/**
 * Names the lockfile marks dev-only in every install path. `npm ls --omit=dev` does not omit a
 * *workspace's* devDependencies, so test tooling (vitest -> vite -> tinypool) leaks into the tree
 * it reports. A name is dropped only when no install path of it is production, so anything that
 * really reaches the deployed backend stays in scope. The flag errs the other way: a hoisted copy
 * shared by dev and production parents is labelled production, so dev tooling can still block.
 */
function devOnlyPackageNames() {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const seen = new Set();
  const production = new Set();
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    const at = key.lastIndexOf('node_modules/');
    if (at < 0) continue;
    const name = key.slice(at + 'node_modules/'.length);
    seen.add(name);
    if (!entry.dev) production.add(name);
  }
  return new Set([...seen].filter((name) => !production.has(name)));
}

const args = parseArgs(process.argv.slice(2));
const audit = runJson(['audit', '--omit=dev', '--json']);
const thresholds = Object.entries(SEVERITY_RANK).filter(
  ([, rank]) => rank >= SEVERITY_RANK[args.failOn],
);
const blockingSeverities = new Set(thresholds.map(([name]) => name));

const all = Object.values(audit.vulnerabilities ?? {}).filter((v) =>
  blockingSeverities.has(v.severity),
);

if (args.reportOnly) {
  const bySeverity = {};
  for (const v of all) bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
  console.log(
    `report: ${all.length} advisories at ${args.failOn}+ (${JSON.stringify(bySeverity)})`,
  );
  for (const v of all) console.log(` - ${v.severity}: ${v.name} (range ${v.range})`);
  process.exit(0);
}

/**
 * Advisories deliberately left open. Matching is by GHSA id, never by package name, so a NEW
 * advisory for the same package still fails the gate. Drop an entry as soon as the fix lands.
 */
const ACCEPTED_ADVISORIES = [
  {
    id: 'GHSA-mrhx-c7xc-m3w5',
    package: 'zod',
    reason:
      'Needs an unbounded collection to exhaust memory; every api schema caps array length and the 64 KB body ceiling bounds input. Real fix is zod 4, which breaks .strict() and issue codes.',
  },
];

/** GHSA ids reachable from a vulnerability entry. */
function advisoryIds(vulnerability) {
  return (vulnerability.via ?? [])
    .filter((via) => typeof via === 'object' && typeof via.url === 'string')
    .map((via) => /GHSA-[a-z0-9-]+/i.exec(via.url)?.[0])
    .filter(Boolean);
}

const inTree = productionPackageNames(args.workspace);
for (const name of devOnlyPackageNames()) inTree.delete(name);
const treeHits = all.filter((v) => inTree.has(v.name));
const accepted = [];
const hits = [];
for (const hit of treeHits) {
  const ids = advisoryIds(hit);
  const match = ACCEPTED_ADVISORIES.find((a) => a.package === hit.name && ids.includes(a.id));
  if (match) accepted.push({ ...match, severity: hit.severity, range: hit.range });
  else hits.push(hit);
}

console.log(
  `workspace "${args.workspace}": ${inTree.size} production packages, ` +
    `${hits.length} blocking advisory(ies) at ${args.failOn}+ (${accepted.length} accepted with a recorded reason)`,
);
for (const hit of hits) console.log(` - ${hit.severity}: ${hit.name} (range ${hit.range})`);
for (const a of accepted) {
  console.log(` - [accepted ${a.id}] ${a.severity}: ${a.package} — ${a.reason}`);
}

if (hits.length > 0) process.exit(1);
