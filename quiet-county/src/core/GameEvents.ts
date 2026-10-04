import type { Vec2 } from './math';

export type NoiseKind =
  | 'footstep'
  | 'gunshot'
  | 'melee'
  | 'impact'
  | 'door'
  | 'breakable'
  | 'alarm'
  | 'voice'
  | 'throwable'
  | 'interaction'
  | 'environment';

export interface NoiseEvent {
  kind: NoiseKind;
  x: number;
  z: number;
  /** Audible radius in meters before occlusion. */
  radius: number;
  /** True when the player caused it (infected track the source). */
  fromPlayer: boolean;
  /** Higher priority stimuli override lower ones in AI. */
  priority: number;
  sourceId?: string;
}

export type MessageKind = 'info' | 'warning' | 'objective' | 'radio' | 'loot' | 'danger';
export type ObjectiveStatus = 'hidden' | 'active' | 'completed' | 'failed';
export type TimePhase = 'day' | 'dusk' | 'night' | 'dawn';
export type ItemChangeSource = 'loot' | 'pickup' | 'reward' | 'debug' | 'dialogue' | 'start' | 'craft' | 'load';

export interface MissionSummary {
  missionId: string;
  title: string;
  elapsedSeconds: number;
  objectives: { id: string; text: string; kind: string; status: ObjectiveStatus }[];
  rewards: { id: string; label: string; amount: number }[];
  stats: MissionStats;
}

export interface MissionStats {
  kills: number;
  takedowns: number;
  headshots: number;
  shotsFired: number;
  containersSearched: number;
  timesDetected: number;
  damageTaken: number;
}

/** Every cross-system event in the game. Payloads are plain data. */
export interface GameEvents {
  noise: NoiseEvent;
  message: { text: string; kind: MessageKind; duration?: number };

  'player:damaged': { amount: number; health: number; from?: Vec2; source: string };
  'player:healed': { amount: number; health: number };
  'player:died': { cause: string };
  'player:footstep': { x: number; z: number; surface: string; gait: string };
  'player:stanceChanged': { crouched: boolean };
  'player:vaulted': { x: number; z: number };

  'inventory:changed': { reason: string };
  'item:added': { itemId: string; quantity: number; source: ItemChangeSource };
  'item:removed': { itemId: string; quantity: number; reason: string };
  'item:used': { itemId: string };

  'weapon:equipped': { weaponId: string | null };
  'weapon:fired': { weaponId: string; x: number; y: number; z: number };
  'weapon:dryFire': { weaponId: string };
  'weapon:reloadStarted': { weaponId: string; duration: number };
  'weapon:reloaded': { weaponId: string; ammo: number };
  'weapon:broken': { weaponId: string };
  'weapon:melee': { weaponId: string; hit: boolean };
  'weapon:hit': { targetId: string; damage: number; headshot: boolean; crit: boolean; killed: boolean };

  'enemy:spawned': { id: string; archetype: string };
  'enemy:stateChanged': { id: string; from: string; to: string };
  'enemy:alerted': { id: string; x: number; z: number };
  'enemy:killed': { id: string; archetype: string; takedown: boolean; headshot: boolean };

  'interaction:started': { id: string; kind: string };
  'interaction:completed': { id: string; kind: string };
  'interaction:cancelled': { id: string; kind: string };
  'container:searched': { id: string; tableId: string };
  'container:opened': { id: string };
  'door:changed': { id: string; open: boolean; byEnemy: boolean };
  'pickup:collected': { id: string; itemId: string };
  'note:read': { id: string };

  'zone:entered': { zoneId: string };
  'zone:exited': { zoneId: string };
  'flag:changed': { flag: string; value: number };

  'mission:started': { missionId: string };
  'mission:objectiveChanged': { missionId: string; objectiveId: string; status: ObjectiveStatus; text: string; kind: string };
  'mission:extractionUnlocked': { missionId: string };
  'mission:completed': { summary: MissionSummary };
  'mission:failed': { missionId: string; reason: string };
  'mission:eventTriggered': { missionId: string; eventId: string };

  'dialogue:started': { dialogueId: string; npcId: string };
  'dialogue:ended': { dialogueId: string; npcId: string };
  'npc:changed': { npcId: string; state: string };

  'save:completed': { slot: string; manual: boolean };
  'save:failed': { slot: string; error: string };

  'time:phaseChanged': { phase: TimePhase; hour: number };
  'weather:changed': { rain: number; fog: number };

  'game:stateChanged': { from: string; to: string };
}
