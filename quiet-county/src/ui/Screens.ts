import { QUALITY_PRESETS, type QualityLevel } from '../config/quality';
import type { GameSettings } from '../config/settings';
import type { MissionSummary } from '../core/GameEvents';
import type { MissionDef } from '../systems/MissionSystem';
import type { ProfileState, SaveGame } from '../systems/SaveSystem';
import { button, el, formatTime } from './dom';

export interface ScreenHost {
  mount(node: HTMLElement): void;
  close(): void;
  click(): void;
}

function titleBlock(): HTMLElement {
  return el(
    'div', 'title-block', {},
    el('div', 'game-title', {}, el('span', 'q', {}, 'Q'), 'UIET', el('br'), 'COUNTY'),
    el('div', 'title-rule'),
    el('div', 'tagline', {}, 'Noise kills'),
  );
}

export function bootScreen(host: ScreenHost, onStart: () => void): void {
  const s = el('div', 'screen solid', { id: 'boot' });
  const wrap = el('div', 'col', { style: 'align-items:flex-start' }, titleBlock(), el('div', 'tap-start', {}, 'Tap to begin'));
  s.append(wrap);
  s.addEventListener('pointerdown', () => onStart(), { once: true });
  host.mount(s);
}

export function mainMenu(
  host: ScreenHost,
  profile: ProfileState,
  latest: SaveGame | null,
  actions: { continueGame(): void; newGame(): void; settings(): void; controls(): void; howTo(): void; credits(): void },
): void {
  const s = el('div', 'screen solid', { id: 'main-menu' });
  const left = el('div', 'col', {}, titleBlock());
  const res = profile.campResources;
  const fmt = (k: string) => Math.round(res[k] ?? 0);
  left.append(
    el(
      'div', 'camp-card', {},
      el('div', 'kicker', {}, 'Harrow Mill - survivor camp'),
      el('div', '', {}, 'Medicine ', el('b', '', {}, String(fmt('medicine'))), '  Fuel ', el('b', '', {}, String(fmt('fuel'))), '  Parts ', el('b', '', {}, String(fmt('parts'))), '  Survivors ', el('b', '', {}, String(5 + fmt('survivors')))),
      el('div', 'muted', {}, profile.completedMissions.length ? `Missions completed: ${profile.completedMissions.length}` : 'No missions completed yet'),
    ),
  );
  const buttons = el('div', 'menu-buttons');
  if (latest) {
    const cont = button('Continue', () => {
      host.click();
      actions.continueGame();
    }, 'btn primary', { id: 'btn-continue' });
    buttons.append(cont, el('div', 'muted', { style: 'font-size:13px;margin-top:-4px' }, `${latest.label} - ${new Date(latest.savedAt).toLocaleString()}`));
  }
  buttons.append(
    button(latest ? 'New game' : 'Start: The Silent Road', () => {
      host.click();
      actions.newGame();
    }, latest ? 'btn' : 'btn primary', { id: 'btn-new' }),
    button('Settings', () => {
      host.click();
      actions.settings();
    }),
    button('Controls layout', () => {
      host.click();
      actions.controls();
    }),
    button('How to survive', () => {
      host.click();
      actions.howTo();
    }),
    button('Credits', () => {
      host.click();
      actions.credits();
    }),
  );
  s.append(el('div', 'menu-wrap', {}, left, buttons));
  host.mount(s);
}

export function briefingScreen(host: ScreenHost, mission: MissionDef, onBegin: () => void, onBack: () => void): void {
  const s = el('div', 'screen solid', { id: 'briefing' });
  const panel = el('div', 'panel');
  panel.append(
    el('div', 'kicker', {}, `Mission ${String(mission.number).padStart(2, '0')} - ${mission.region}`),
    el('h2', '', { style: 'font-size:28px;margin-top:4px' }, mission.title),
    el('div', 'briefing-speaker', {}, `Radio - ${mission.briefing.speaker}`),
  );
  mission.briefing.lines.forEach((line, i) => {
    const p = el('p', 'briefing-line', {}, line);
    p.style.animationDelay = `${0.25 + i * 0.45}s`;
    panel.append(p);
  });
  const list = el('ul', 'objective-list');
  for (const o of mission.objectives) {
    if (o.revealWhen && o.kind !== 'primary' && o.kind !== 'extraction') continue;
    list.append(el('li', o.kind, {}, o.text, el('span', 'tag', {}, o.kind)));
  }
  panel.append(el('hr', 'rule'), el('h3', '', {}, 'Objectives'), list);
  panel.append(
    el('div', 'row', { style: 'margin-top:12px' },
      button('Back', () => {
        host.click();
        onBack();
      }),
      el('div', 'spacer'),
      button('Begin mission', () => {
        host.click();
        onBegin();
      }, 'btn primary', { id: 'btn-begin' }),
    ),
  );
  s.append(panel);
  host.mount(s);
}

export function pauseScreen(
  host: ScreenHost,
  info: { lastSave: string | null; clock: string },
  actions: { resume(): void; settings(): void; controls(): void; howTo(): void; quit(): void },
): void {
  const s = el('div', 'screen', { id: 'pause' });
  const panel = el('div', 'panel narrow');
  panel.append(
    el('div', 'kicker', {}, 'Paused'),
    el('h2', '', {}, 'Catch your breath'),
    el('p', 'muted', {}, info.lastSave ? `Last save: ${info.lastSave}` : 'No save yet. Find a radio or a safe camp to save manually.'),
    el('p', 'muted', { style: 'font-size:13px' }, 'Manual saves are only possible at safe locations (radios, camps) when no infected are hunting you. The game also autosaves at checkpoints.'),
  );
  const b = el('div', 'menu-buttons');
  b.append(
    button('Resume', () => {
      host.click();
      actions.resume();
    }, 'btn primary', { id: 'btn-resume' }),
    button('Settings', () => {
      host.click();
      actions.settings();
    }),
    button('Controls layout', () => {
      host.click();
      actions.controls();
    }),
    button('How to survive', () => {
      host.click();
      actions.howTo();
    }),
    button('Quit to menu', () => {
      host.click();
      actions.quit();
    }, 'btn danger'),
  );
  panel.append(b);
  s.append(panel);
  host.mount(s);
}

export function resultsScreen(host: ScreenHost, summary: MissionSummary, debrief: string, actions: { menu(): void; replay(): void }): void {
  const s = el('div', 'screen solid', { id: 'results' });
  const panel = el('div', 'panel');
  panel.append(
    el('div', 'kicker', {}, 'Mission complete'),
    el('h2', '', { style: 'font-size:28px' }, summary.title),
    el('p', '', {}, debrief),
  );
  const list = el('ul', 'objective-list');
  for (const o of summary.objectives) list.append(el('li', `${o.kind} ${o.status}`, {}, o.text, el('span', 'tag', {}, o.status === 'completed' ? 'done' : 'missed')));
  panel.append(el('h3', '', {}, 'Objectives'), list);
  const st = summary.stats;
  const grid = el('div', 'stats-grid');
  const stat = (v: string | number, label: string) => el('div', 'stat', {}, el('b', '', {}, String(v)), el('span', '', {}, label));
  grid.append(
    stat(formatTime(summary.elapsedSeconds), 'Time'),
    stat(st.kills, 'Infected killed'),
    stat(st.takedowns, 'Silent takedowns'),
    stat(st.shotsFired, 'Shots fired'),
    stat(st.timesDetected, 'Times detected'),
    stat(Math.round(st.damageTaken), 'Damage taken'),
  );
  panel.append(grid, el('h3', '', {}, 'Brought home to Harrow Mill'));
  for (const r of summary.rewards) panel.append(el('div', 'reward', {}, `+ ${r.amount} ${r.id === 'xp' ? 'XP' : r.id} - ${r.label}`));
  panel.append(
    el('div', 'row', { style: 'margin-top:14px' },
      button('Replay mission', () => {
        host.click();
        actions.replay();
      }),
      el('div', 'spacer'),
      button('Return to Harrow Mill', () => {
        host.click();
        actions.menu();
      }, 'btn primary', { id: 'btn-results-menu' }),
    ),
  );
  s.append(panel);
  host.mount(s);
}

export function deathScreen(host: ScreenHost, hasCheckpoint: boolean, actions: { retry(): void; restart(): void; menu(): void }): void {
  const s = el('div', 'screen', { id: 'death', style: 'background:rgba(20,4,2,0.82)' });
  const panel = el('div', 'panel narrow', { style: 'text-align:center' });
  panel.append(
    el('div', 'death-title', {}, 'Rowan is down'),
    el('p', 'muted', {}, 'The county keeps what it takes. Move quieter. Pick your fights.'),
  );
  const b = el('div', 'menu-buttons', { style: 'margin:12px auto 0;max-width:300px' });
  if (hasCheckpoint) b.append(button('Retry from checkpoint', () => {
    host.click();
    actions.retry();
  }, 'btn primary', { id: 'btn-retry' }));
  b.append(
    button('Restart mission', () => {
      host.click();
      actions.restart();
    }, hasCheckpoint ? 'btn' : 'btn primary', { id: 'btn-restart' }),
    button('Main menu', () => {
      host.click();
      actions.menu();
    }),
  );
  panel.append(b);
  s.append(panel);
  host.mount(s);
}

export function infoScreen(host: ScreenHost, title: string, kicker: string, paragraphs: string[], onBack: () => void): void {
  const s = el('div', 'screen solid', { id: 'info' });
  const panel = el('div', 'panel');
  panel.append(el('div', 'kicker', {}, kicker), el('h2', '', {}, title));
  for (const p of paragraphs) panel.append(el('p', '', {}, p));
  panel.append(button('Back', () => {
    host.click();
    onBack();
  }, 'btn', { style: 'margin-top:10px' }));
  s.append(panel);
  host.mount(s);
}

export const HOW_TO_SURVIVE = [
  'SOUND IS EVERYTHING. Every footstep, door, swing and shot makes noise. The ring on your minimap shows how far your last sound carried - any Hollow inside it heard you.',
  'Crouch to move quietly and stay low. Crouching inside tall grass makes you nearly invisible. Watch the eye: amber means something is suspicious, red means you are being hunted.',
  'Gunshots carry for half a kilometre and pull every infected nearby. Firearms are a last resort. Melee costs stamina - an exhausted swing is a weak swing.',
  'Approach an unaware infected from behind (or one lying still) and press MELEE for a silent takedown.',
  'Throw an empty bottle to make noise somewhere else, then slip past while they investigate.',
  'Hollows cannot climb. Vault fences and low walls to break a chase. They will bash through doors, though - given time.',
  'Your bag has limited slots. Leave junk in containers, keep ammo, bandages and quest items. Heal before a fight, not during one.',
  'Night cuts your vision and theirs - but a flashlight beam is the brightest thing in the county.',
  'Save manually at radios and camps when no infected are hunting you. Checkpoints also save automatically.',
];

export const CREDITS = [
  'QUIET COUNTY is an original game. Every character, place, story line, model, texture, sound and interface element was created for this project - geometry, textures and audio are generated procedurally by the game code at runtime.',
  'No assets, names, dialogue, maps or designs from any existing game, film or television series are used.',
  'Built with TypeScript and three.js (MIT). Packaged for Android and iOS with Capacitor (MIT).',
];

export function settingsScreen(host: ScreenHost, current: GameSettings, onChange: (s: GameSettings) => void, onBack: () => void, onReset: () => GameSettings): void {
  let s = { ...current };
  const screen = el('div', 'screen solid', { id: 'settings' });
  const panel = el('div', 'panel');
  const grid = el('div', 'settings-grid');
  const commit = () => onChange({ ...s });

  const toggle = (label: string, key: keyof GameSettings) => {
    const t = el('div', `toggle ${s[key] ? 'on' : ''}`, { role: 'switch', 'data-key': String(key) });
    t.addEventListener('click', () => {
      (s as unknown as Record<string, unknown>)[key] = !s[key];
      t.classList.toggle('on', !!s[key]);
      host.click();
      commit();
    });
    return el('div', 'setting', {}, el('span', '', {}, label), t);
  };
  const range = (label: string, key: keyof GameSettings, min: number, max: number, step: number) => {
    const input = el('input', '', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), 'data-key': String(key) });
    input.addEventListener('input', () => {
      (s as unknown as Record<string, unknown>)[key] = parseFloat(input.value);
      commit();
    });
    return el('div', 'setting', {}, el('span', '', {}, label), input);
  };
  const select = (label: string, key: keyof GameSettings, options: [string, string][]) => {
    const sel = el('select', '', { 'data-key': String(key) });
    for (const [v, t] of options) {
      const o = el('option', '', { value: v }, t);
      if (String(s[key]) === v) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => {
      const raw = sel.value;
      (s as unknown as Record<string, unknown>)[key] = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
      commit();
    });
    return el('div', 'setting', {}, el('span', '', {}, label), sel);
  };

  const render = () => {
    grid.innerHTML = '';
    grid.append(
      select('Graphics quality', 'quality', (Object.keys(QUALITY_PRESETS) as QualityLevel[]).map((q) => [q, QUALITY_PRESETS[q].label])),
      select('Frame-rate target', 'targetFps', [['30', '30 FPS (battery)'], ['60', '60 FPS']]),
      toggle('Dynamic resolution', 'dynamicResolution'),
      toggle('Show FPS / perf', 'showFps'),
      range('Look sensitivity (horizontal)', 'lookSensitivityX', 0.3, 2.5, 0.05),
      range('Look sensitivity (vertical)', 'lookSensitivityY', 0.3, 2.5, 0.05),
      toggle('Invert vertical look', 'invertY'),
      toggle('Aim assist', 'aimAssist'),
      select('Aim button', 'aimMode', [['hold', 'Hold'], ['toggle', 'Toggle']]),
      select('Sprint button', 'sprintMode', [['toggle', 'Toggle'], ['hold', 'Hold']]),
      range('Button size', 'buttonScale', 0.7, 1.4, 0.05),
      range('Button opacity', 'buttonOpacity', 0.3, 1, 0.05),
      toggle('Left-handed layout', 'leftHanded'),
      toggle('Vibration', 'haptics'),
      range('Master volume', 'masterVolume', 0, 1, 0.05),
      range('Effects volume', 'sfxVolume', 0, 1, 0.05),
      range('Ambience volume', 'ambienceVolume', 0, 1, 0.05),
    );
  };
  render();
  panel.append(
    el('div', 'kicker', {}, 'Options'),
    el('h2', '', { style: 'margin-bottom:8px' }, 'Settings'),
    grid,
    el('p', 'muted', { style: 'font-size:13px' }, 'Quality changes apply to the next loaded mission (textures, shadows, grass density, view distance).'),
    el('div', 'row', { style: 'margin-top:8px' },
      button('Reset to defaults', () => {
        s = onReset();
        render();
      }, 'btn small'),
      el('div', 'spacer'),
      button('Done', () => {
        host.click();
        onBack();
      }, 'btn primary', { id: 'btn-settings-done' }),
    ),
  );
  screen.append(panel);
  host.mount(screen);
}

export function loadingScreen(text: string): HTMLElement {
  return el('div', '', { id: 'loading' }, el('div', 'spinner'), el('div', 'kicker', {}, text));
}
