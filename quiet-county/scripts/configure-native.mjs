#!/usr/bin/env node
/**
 * Applies Quiet County's native settings to generated Capacitor projects (which are not
 * committed): landscape-only orientation, immersive fullscreen, no backup of save data
 * conflicts. Run after `npx cap add android|ios`. Safe to run repeatedly.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2] ?? 'all';

function patch(file, fn) {
  if (!existsSync(file)) {
    console.log(`skip: ${file} not found`);
    return;
  }
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`patched: ${file}`);
  } else console.log(`ok: ${file}`);
}

if (target === 'android' || target === 'all') {
  patch('android/app/src/main/AndroidManifest.xml', (xml) => {
    let out = xml;
    if (!out.includes('android:screenOrientation')) {
      out = out.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="sensorLandscape"');
    }
    if (!out.includes('android:hardwareAccelerated')) {
      out = out.replace('<application', '<application\n        android:hardwareAccelerated="true"');
    }
    return out;
  });
  patch('android/app/src/main/res/values/styles.xml', (xml) =>
    xml.includes('android:windowFullscreen')
      ? xml
      : xml.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>'),
  );
}

if (target === 'ios' || target === 'all') {
  patch('ios/App/App/Info.plist', (plist) => {
    const landscape = '<array>\n\t\t<string>UIInterfaceOrientationLandscapeLeft</string>\n\t\t<string>UIInterfaceOrientationLandscapeRight</string>\n\t</array>';
    let out = plist.replace(/(<key>UISupportedInterfaceOrientations<\/key>\s*)<array>[\s\S]*?<\/array>/, `$1${landscape}`);
    out = out.replace(/(<key>UISupportedInterfaceOrientations~ipad<\/key>\s*)<array>[\s\S]*?<\/array>/, `$1${landscape}`);
    if (!out.includes('UIStatusBarHidden')) out = out.replace('<dict>', '<dict>\n\t<key>UIStatusBarHidden</key>\n\t<true/>\n\t<key>UIRequiresFullScreen</key>\n\t<true/>');
    return out;
  });
}
