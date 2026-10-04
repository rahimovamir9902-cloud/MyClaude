import { getArchetype } from '../config/enemies';
import { recentLogs, setLogLevel, LogLevel } from '../core/Logger';
import type { Game } from '../game/Game';
import { AutoPilot, type BotTask } from './AutoPilot';
import { validateLevel } from './LevelValidator';

/**
 * window.__QC - hooks for automated QA (Playwright) and manual debugging. Enabled with
 * ?debug=1 (or in dev builds). Never required by gameplay code.
 */
export function installDebugApi(game: Game): void {
  const bot = new AutoPilot(game);
  const api = {
    game,
    bot,
    state: () => game.state,
    snapshot: () => {
      const s = game.session;
      if (!s) return { state: game.state };
      const p = s.player;
      return {
        state: game.state,
        mission: s.missions.state,
        objectives: Object.fromEntries(s.missions.objectives().map((o) => [o.id, o.status])),
        player: { x: p.x, z: p.z, yaw: p.yaw, health: p.health.current, stamina: p.stamina.current, crouched: p.crouched, alive: p.alive, weapon: p.weapon?.def.id ?? null, ammo: p.weapon?.ammo ?? 0 },
        inventory: s.inventory.slots.filter(Boolean).map((x) => `${x!.itemId}x${x!.quantity}`),
        enemies: s.enemies.enemies.map((e) => ({ id: e.id, state: e.state, alive: e.alive, x: +e.x.toFixed(1), z: +e.z.toFixed(1), awareness: +e.brain.awareness.toFixed(2) })),
        npcs: Object.fromEntries(Array.from(s.npcs.npcs, ([id, n]) => [id, { state: n.state, x: +n.x.toFixed(1), z: +n.z.toFixed(1) }])),
        flags: s.world.serialize().flags,
        time: s.time.clock,
        prompt: s.interactions.current?.prompt ?? null,
        stats: s.missions.stats,
        render: { ...game.renderer.stats },
        level: s.level.stats,
        bot: { status: bot.status, index: bot.index, done: bot.done, history: bot.history.slice(-30) },
      };
    },
    teleport: (x: number, z: number, yaw?: number) => {
      const p = game.session?.player;
      if (!p) return false;
      p.x = x;
      p.z = z;
      if (yaw !== undefined) {
        p.yaw = yaw;
        game.session!.camera.yaw = yaw;
      }
      p.syncTransform();
      return true;
    },
    god: (on = true) => {
      if (game.session) game.session.godMode = on;
    },
    give: (itemId: string, qty = 1) => game.session?.inventory.add(itemId, qty, {}, 'debug'),
    setTime: (hour: number) => game.session?.time.set(hour),
    spawn: (archetype: string, x: number, z: number, opts: { dormant?: boolean } = {}) => {
      getArchetype(archetype);
      return !!game.session?.enemies.spawn({ id: `debug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, archetype: archetype as never, x, z, dormant: opts.dormant });
    },
    killAll: () => {
      const s = game.session;
      if (!s) return 0;
      let n = 0;
      for (const e of [...s.enemies.enemies]) {
        if (!e.alive) continue;
        s.enemies.hit(e, { damage: 9999, headshot: false, crit: false, fromX: e.x, fromZ: e.z, stagger: 0, takedown: false, weaponId: 'debug' });
        n++;
      }
      return n;
    },
    levelIssues: () => (game.session ? validateLevel(game.session.level) : []),
    startBot: (tasks?: BotTask[]) => {
      game.session && (game.session.godMode = true);
      bot.start(tasks);
    },
    stopBot: () => bot.stop(),
    logs: () => recentLogs().map((l) => `[${l.scope}] ${l.message}`),
    verbose: () => setLogLevel(LogLevel.Debug),
    newGame: () => game.startMission(null),
    continueGame: () => game.continueGame(),
    saveNow: (slot: 'auto' | 'manual' = 'manual') => game.session?.save(slot, 'Debug save'),
    pause: () => game.pause(),
    resume: () => game.resume(),
    damagePlayer: (amount: number) => game.session?.player.takeDamage(amount, (game.session?.player.x ?? 0) + 1, game.session?.player.z ?? 0, 'debug'),
  };
  (window as unknown as { __QC: typeof api }).__QC = api;
  game.autopilot = bot;
}
