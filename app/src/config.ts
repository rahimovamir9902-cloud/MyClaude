import Constants from 'expo-constants';

type Extra = { apiBaseUrl?: string; demoMode?: boolean };

const extra = (Constants.expoConfig?.extra as Extra | undefined) ?? {};

// Base URL of the backend that proxies the Claude API.
//
// - In development on a device/emulator, "localhost" refers to the device,
//   not your computer. Use your machine's LAN IP (e.g. http://192.168.1.20:8787)
//   or an Android emulator alias (http://10.0.2.2:8787).
// - In production, point this at your deployed backend URL.
export const API_BASE_URL: string = extra.apiBaseUrl || 'http://localhost:8787';

// When true, the app never calls the backend and always uses the offline demo
// tutor (pre-written Tajik answers). Handy for a no-setup demo or Play review.
// Even when false, the app automatically falls back to demo answers if the
// backend is unreachable, so it is always usable.
export const DEMO_MODE: boolean = extra.demoMode === true;
