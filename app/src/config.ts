import Constants from 'expo-constants';

// Base URL of the backend that proxies the Claude API.
//
// - In development on a device/emulator, "localhost" refers to the device,
//   not your computer. Use your machine's LAN IP (e.g. http://192.168.1.20:8787)
//   or an Android emulator alias (http://10.0.2.2:8787).
// - In production, point this at your deployed backend URL.
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl || 'http://localhost:8787';
