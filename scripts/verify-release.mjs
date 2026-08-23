import fs from 'node:fs';
const tag = process.argv[2];
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!tag || tag !== `v${pkg.version}`) throw new Error(`Tag ${tag || '(missing)'} does not match package version ${pkg.version}`);
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
if (!changelog.includes(`## [${pkg.version}]`)) throw new Error(`CHANGELOG.md has no ${pkg.version} entry`);
console.log(`${pkg.name}@${pkg.version} release metadata is consistent`);
