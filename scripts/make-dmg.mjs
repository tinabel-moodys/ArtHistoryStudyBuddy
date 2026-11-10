// Wraps the packaged .app in a drag-to-Applications .dmg installer.
// Run after `npm run package` (or use `npm run dist`). macOS only: uses ditto, codesign and hdiutil.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_NAME = 'Art History Study';
const arch = process.arch === 'x64' ? 'x64' : process.arch;
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const app = join('dist', `${APP_NAME}-darwin-${arch}`, `${APP_NAME}.app`);
const output = join('dist', `${APP_NAME.replace(/ /g, '-')}-${version}-${arch}.dmg`);

if (process.platform !== 'darwin') throw new Error('make-dmg only runs on macOS.');
if (!existsSync(app)) throw new Error(`${app} not found. Run "npm run package" first.`);

const run = (command, args) => { execFileSync(command, args, { stdio: 'inherit' }); };

// Apple Silicon refuses to run unsigned code; an ad-hoc signature is enough for a local or shared build.
// (Without a paid Developer ID the app is still "unidentified": see the README for first launch.)
run('codesign', ['--force', '--deep', '--sign', '-', app]);

const stage = mkdtempSync(join(tmpdir(), 'dmg-stage-'));
try {
  run('ditto', [app, join(stage, `${APP_NAME}.app`)]); // ditto preserves permissions and symlinks
  symlinkSync('/Applications', join(stage, 'Applications'));
  rmSync(output, { force: true });
  run('hdiutil', ['create', '-volname', APP_NAME, '-srcfolder', stage, '-ov', '-format', 'UDZO', output]);
} finally {
  rmSync(stage, { recursive: true, force: true });
}

console.log(`\nInstaller: ${output}`);
