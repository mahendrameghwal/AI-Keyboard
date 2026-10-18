#!/usr/bin/env node
/**
 * Scope `npm audit` to one workspace's production dependency tree.
 *
 * Why: the repo-wide gate blocked on advisories that only exist in the Expo/Metro
 * toolchain (`expo` pulls its dev server into "dependencies"), never in the deployed
 * backend. Name-based intersection is deliberately conservative — a hoisted package
 * that also appears in the audited tree is counted, so the gate can over-report but
 * cannot miss an advisory that really reaches the backend.
 *
 * Usage: node scripts/audit-workspace.mjs --workspace api [--fail-on high] [--report-only]
 */
import { spawnSync } from 'node:child_process';

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

const inTree = productionPackageNames(args.workspace);
const hits = all.filter((v) => inTree.has(v.name));

console.log(
  `workspace "${args.workspace}": ${inTree.size} production packages, ` +
    `${hits.length} advisory(ies) at ${args.failOn}+`,
);
for (const hit of hits) console.log(` - ${hit.severity}: ${hit.name} (range ${hit.range})`);

if (hits.length > 0) process.exit(1);
