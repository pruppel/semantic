#!/usr/bin/env node
// scripts/semver-tag.js
// Simple semantic version tagger based on Conventional Commits.
// Usage locally: node scripts/semver-tag.js [--push]
// In CI: node scripts/semver-tag.js --push

const { execSync } = require('child_process');

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim();
  } catch (e) {
    return null;
  }
}

function log(...args) { console.log('[semver-tag]', ...args); }

// 1) get last tag
let lastTag = run('git describe --tags --abbrev=0');
if (!lastTag) lastTag = '0.0.0';
const lastTagClean = lastTag.startsWith('v') ? lastTag.slice(1) : lastTag;
const parts = lastTagClean.split('.').map(n => parseInt(n, 10) || 0);
let [maj, min, pat] = parts;
if (parts.length < 3) { maj = parts[0] || 0; min = parts[1] || 0; pat = parts[2] || 0; }

// 2) read last commit message
const commitMsg = run('git log -1 --pretty=%B') || '';
const header = (commitMsg.split('\n')[0] || '').trim();

log('last tag:', lastTag);
log('commit header:', header);

// 3) determine bump type (major/minor/patch)
// - major: "BREAKING CHANGE" anywhere OR header contains "!:"
// - minor: header starts with "feat" (Conventional Commits)
// - patch: header starts with "fix", "perf", or default fallback -> patch
let bump = 'patch';
if (/BREAKING CHANGE/.test(commitMsg) || /^.*![: ]/.test(header) || /!$/.test(header)) {
  bump = 'major';
} else if (/^feat(\(.+\))?:/.test(header)) {
  bump = 'minor';
} else if (/^fix(\(.+\))?:/.test(header) || /^perf(\(.+\))?:/.test(header)) {
  bump = 'patch';
} else {
  // fallback: patch
  bump = 'patch';
}

log('determined bump:', bump);

// 4) compute new version
let newMaj = maj, newMin = min, newPat = pat;
if (bump === 'major') {
  newMaj = maj + 1; newMin = 0; newPat = 0;
} else if (bump === 'minor') {
  newMin = min + 1; newPat = 0;
} else {
  newPat = pat + 1;
}

const newTag = `v${newMaj}.${newMin}.${newPat}`;
if (newTag === (lastTag.startsWith('v') ? lastTag : `v${lastTag}`)) {
  log('No version change (same tag). Nothing to do.');
  process.exit(0);
}

// 5) create annotated tag
try {
  run(`git tag -a ${newTag} -m "chore(release): ${newTag}"`);
  log('Created tag', newTag);
} catch (err) {
  console.error('Failed to create tag:', err && err.message);
  process.exit(1);
}

// 6) push if requested
const shouldPush = process.argv.includes('--push') || process.env.GIT_PUSH === 'true';
if (shouldPush) {
  log('Pushing tag to origin:', newTag);
  try {
    run(`git push origin refs/tags/${newTag}`);
    log('Pushed tag', newTag);
  } catch (err) {
    console.error('Failed to push tag:', err && err.message);
    process.exit(1);
  }
}

console.log(newTag);
process.exit(0);
