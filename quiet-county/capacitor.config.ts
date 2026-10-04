import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quietcounty.game',
  appName: 'Quiet County',
  webDir: 'dist',
  backgroundColor: '#0d0f10',
  android: {
    // Keep WebGL fast: no mixed content, hardware acceleration is on by default.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
