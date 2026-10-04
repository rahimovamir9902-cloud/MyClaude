import './ui/styles.css';
import { Game } from './game/Game';
import { installDebugApi } from './debug/DebugApi';
import { LogLevel, createLogger, setLogLevel } from './core/Logger';

const log = createLogger('Main');

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const debug = params.has('debug') || import.meta.env.DEV;
  setLogLevel(params.has('verbose') ? LogLevel.Debug : debug ? LogLevel.Info : LogLevel.Warn);
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');
  const game = new Game(root);
  if (debug) installDebugApi(game);
  await game.init();
}

window.addEventListener('error', (e) => log.error('Uncaught', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => log.error('Unhandled rejection', e.reason));

boot().catch((err) => {
  log.error('Boot failed', err);
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#e8e2d4;font-family:sans-serif;padding:24px;text-align:center;background:#0d0f10';
  msg.textContent = 'Quiet County could not start: WebGL may be unavailable on this device.';
  document.body.append(msg);
});
