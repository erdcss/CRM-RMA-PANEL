/**
 * Fail closed when a native build is about to ship stale source.
 * This runs on the developer's machine before EAS uploads the app.
 * It also stamps the exact Git revision into the Expo manifest so testers can
 * distinguish an old APK/TestFlight build from the current source.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function fail(message) {
  console.error('\n[release-check] ' + message);
  process.exit(1);
}

let head, branch;
try {
  branch = git(['branch', '--show-current']);
  head = git(['rev-parse', 'HEAD']);
} catch {
  fail('Git bilgisi okunamıyor. Projeyi GitHub deposundan açıp tekrar deneyin.');
}

if (branch !== 'main') {
  fail('Aktif branch "' + branch + '". Yayın için main dalına geçin; yerel değişiklikleri önce yedekleyin.');
}

try {
  git(['fetch', '--quiet', 'origin', 'main']);
} catch {
  fail('origin/main yenilenemedi. İnternet veya GitHub erişimini kontrol edin; eski kodla build başlatılmadı.');
}

let remote;
try {
  remote = git(['rev-parse', 'origin/main']);
} catch {
  fail('origin/main bulunamadı. git pull --ff-only origin main komutunu çalıştırın.');
}

if (remote !== head) {
  fail(
    'Yerel kod ile GitHub main farklı!\n' +
    '  Yerel:  ' + head.slice(0, 12) + '\n' +
    '  GitHub: ' + remote.slice(0, 12) + '\n' +
    'Proje kökünde git status --short ile değişiklikleri kontrol edin. Ardından git pull --ff-only origin main çalıştırın.'
  );
}

const appJsonPath = path.join(root, 'app.json');
const config = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
config.expo = config.expo || {};
config.expo.extra = {
  ...(config.expo.extra || {}),
  sourceRevision: head.slice(0, 12),
  sourceBuildDate: new Date().toISOString(),
  sourceBranch: branch,
};
fs.writeFileSync(appJsonPath, JSON.stringify(config, null, 2) + '\n');
console.log('[release-check] Güncel main doğrulandı: ' + head.slice(0, 12));
console.log('[release-check] Derleme kaynak sürümü app.json içine eklendi.');
