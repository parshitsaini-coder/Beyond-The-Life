import type { CapacitorConfig } from '@capacitor/cli';

// ---------------- Step 10 — Capacitor config ----------------
// webDir: 'out' matches next.config.js's distDir for the CAPACITOR_BUILD
// static export (see `npm run build:capacitor`). This is the *offline
// shell* — the compiled HTML/JS/CSS bundle gets copied into the native
// android/ project and loads locally with no network call, same pattern
// as the prior TJRA app. Firebase Auth + Firestore calls still go out
// live over the internet from inside that WebView; only the app shell
// itself is bundled offline.
const config: CapacitorConfig = {
  appId: 'com.btl.app',
  appName: 'Beyond The Life',
  webDir: 'out',
  backgroundColor: '#c0d6df',
  android: {
    backgroundColor: '#c0d6df',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#403d39',
      showSpinner: false,
    },
  },
};

export default config;
