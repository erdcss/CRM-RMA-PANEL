#!/usr/bin/env node
/**
 * GitHub Actions to Codemagic API bridge for ChatGPT-triggerable releases.
 * Never prints tokens; never uses Expo EAS Build.
 */
import fs from 'node:fs';

const requested = process.argv[2];
const workflowIds = Object.freeze({
  testflight: 'caliskan-business-ios-testflight',
  apk: 'caliskan-business-android-apk',
  aab: 'caliskan-business-android-aab',
});
if (requested !== 'check' && !Object.hasOwn(workflowIds, requested)) {
  throw new Error('Allowed commands: check | testflight | apk | aab');
}
if (process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Business release must be requested from the main branch');
}

const token = process.env.CODEMAGIC_API_TOKEN;
if (!token) {
  throw new Error('Missing CODEMAGIC_API_TOKEN. Save it in GitHub Actions repository secrets.');
}
const headers = { 'Content-Type': 'application/json', 'x-auth-token': token };
const getJson = async (url, init = {}) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000), ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Codemagic request failed: HTTP ' + response.status);
  return payload;
};
const applications = await getJson('https://api.codemagic.io/apps');
const apps = Array.isArray(applications.applications) ? applications.applications : [];
const configuredId = process.env.CODEMAGIC_BUSINESS_APP_ID ||
  process.env.CODEMAGIC_APP_ID_VAR || process.env.CODEMAGIC_APP_ID_SECRET || '';
const repoMatches = apps.filter(a => {
  const repo = String(a.repositoryUrl || a.repository?.url || '').toLowerCase();
  return repo.includes('erdcss/crm-rma-panel') ||
    String(a.appName || '').toLowerCase() === 'crm-rma-panel';
});
if (configuredId && !/^[a-f0-9]{24}$/i.test(configuredId)) {
  throw new Error('Codemagic app ID must contain 24 hexadecimal characters');
}
const chosen = configuredId
  ? apps.find(a => String(a._id || '') === configuredId)
  : (repoMatches.length === 1 ? repoMatches[0] : null);
if (!chosen || !repoMatches.some(a => String(a._id) === String(chosen._id))) {
  throw new Error('CRM-RMA-PANEL Codemagic app not uniquely identifiable. Set CODEMAGIC_BUSINESS_APP_ID (or CODEMAGIC_APP_ID) GitHub variable.');
}
const appId = String(chosen._id);
const appUrl = 'https://codemagic.io/app/' + appId;
const requestLabel = requested === 'testflight' ? 'TestFlight (iOS)'
  : requested === 'apk' ? 'Android APK'
  : requested === 'aab' ? 'Android AAB' : 'Bağlantı kontrolü';

if (requested === 'check') {
  console.log('Business Codemagic API token and app access verified.');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Çalışkan Business Codemagic ön kontrol\n\n' +
    '- Codemagic API erişimi: başarılı\n' +
    '- CRM-RMA-PANEL uygulaması: eşleşti\n' +
    '- [Codemagic uygulaması](' + appUrl + ')\n\n' +
    'Not: iOS sertifikaları, Android keystore ve gerçek imzalı derlemeler bu API ön kontrolüyle doğrulanmaz.\n');
  process.exit(0);
}

const workflowId = workflowIds[requested];
const result = await getJson('https://api.codemagic.io/builds', {
  method: 'POST',
  body: JSON.stringify({ appId, workflowId, branch: 'main' }),
  signal: AbortSignal.timeout(45000),
});
const buildId = String(result.buildId || '');
if (!/^[a-f0-9]{24}$/i.test(buildId)) {
  throw new Error('Codemagic did not return a valid build ID');
}
const buildUrl = appUrl + '/build/' + buildId;
console.log('Queued: ' + requestLabel + ' · build ' + buildId);
console.log('Track: ' + buildUrl);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
  'build_id=' + buildId + '\n' + 'build_url=' + buildUrl + '\n');
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '### Çalışkan Business · ' + requestLabel + '\n\n' +
  '- Durum: **Codemagic derleme kuyruğuna alındı** (henüz tamamlanmadı)\n' +
  '- Workflow: `' + workflowId + '`\n' +
  '- Bundle/package: `com.caliskangroup.business`\n' +
  '- Kod: `main`\n' +
  '- [Codemagic derlemesini ve dosyalarını aç](' + buildUrl + ')\n\n' +
  'TestFlight seçildiyse iOS IPA, Apple App Store Connect TestFlight yüklemesine gönderilir. ' +
  'APK/AAB dosyaları derleme başarılı olunca Codemagic Artifacts bölümünde bulunur. ' +
  'Bu tetikleyici derlemenin tamamlandığını veya Apple tarafından işlendiğini iddia etmez.\n');
