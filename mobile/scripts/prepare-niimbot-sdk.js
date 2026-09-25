const fs = require('fs');
const path = require('path');

const mobileRoot = path.join(__dirname, '..');
const sourceRoot = path.join(mobileRoot, 'vendor', 'niimbot-ios', 'SDK');
const targetRoot = path.join(mobileRoot, 'modules', 'niimbot-printer', 'ios', 'NiimbotSDK');

const requiredFiles = [
  ['Libs', 'JCAPI.a'],
  ['Libs', 'JCLPAPI.a'],
  ['Libs', 'libSkiaRenderLibrary.a'],
  ['font', 'FONT.json'],
  ['font', 'ZT001.ttf'],
  ['font', 'ZT002.otf'],
];

// CocoaPods/ld resolve vendored_libraries via -lNAME -> libNAME.a
const linkerAliases = [
  ['Libs', 'JCAPI.a', 'libJCAPI.a'],
  ['Libs', 'JCLPAPI.a', 'libJCLPAPI.a'],
];

const verifyTargets = [
  ['NiimbotSDK/Libs/libJCAPI.a', 9_000_000],
  ['NiimbotSDK/Libs/libJCLPAPI.a', 2_500_000],
  ['NiimbotSDK/Libs/libSkiaRenderLibrary.a', 60_000_000],
  ['NiimbotSDK/font/FONT.json', 1_000],
  ['NiimbotSDK/font/ZT001.ttf', 1_000_000],
  ['NiimbotSDK/font/ZT002.otf', 1_000_000],
];

function formatBytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function copyIfNeeded(relativeParts) {
  const source = path.join(sourceRoot, ...relativeParts);
  const target = path.join(targetRoot, ...relativeParts);

  if (!fs.existsSync(source)) {
    throw new Error(`NIIMBOT SDK file missing: ${source}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });

  const sourceStat = fs.statSync(source);
  if (fs.existsSync(target)) {
    const targetStat = fs.statSync(target);
    if (targetStat.size === sourceStat.size && targetStat.mtimeMs >= sourceStat.mtimeMs) {
      return target;
    }
  }

  fs.copyFileSync(source, target);
  return target;
}

function copyAliasIfNeeded(relativeDir, sourceName, aliasName) {
  const source = path.join(targetRoot, relativeDir, sourceName);
  const target = path.join(targetRoot, relativeDir, aliasName);

  if (!fs.existsSync(source)) {
    throw new Error(`NIIMBOT linker alias source missing: ${source}`);
  }

  const sourceStat = fs.statSync(source);
  if (fs.existsSync(target)) {
    const targetStat = fs.statSync(target);
    if (targetStat.size === sourceStat.size && targetStat.mtimeMs >= sourceStat.mtimeMs) {
      return target;
    }
  }

  fs.copyFileSync(source, target);
  return target;
}

if (!fs.existsSync(sourceRoot)) {
  console.warn(
    `NIIMBOT vendor SDK not found at ${sourceRoot}; using existing NiimbotSDK copy from upload.`,
  );
} else {
  for (const parts of requiredFiles) {
    copyIfNeeded(parts);
  }

  for (const [dir, sourceName, aliasName] of linkerAliases) {
    copyAliasIfNeeded(dir, sourceName, aliasName);
  }

  console.log(`NIIMBOT SDK synced to ${targetRoot}`);
}

for (const [relativePath, minBytes] of verifyTargets) {
  const absolutePath = path.join(mobileRoot, 'modules', 'niimbot-printer', 'ios', relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`NIIMBOT verify failed: ${relativePath} = MISSING`);
  }

  const { size } = fs.statSync(absolutePath);
  if (size < minBytes) {
    throw new Error(
      `NIIMBOT verify failed: ${relativePath} size ${formatBytes(size)} below expected minimum`,
    );
  }

  console.log(`NIIMBOT verify: ${relativePath} = EXISTS (${formatBytes(size)})`);
}
