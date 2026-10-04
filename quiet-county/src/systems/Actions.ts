import type { MessageKind, NoiseKind } from '../core/GameEvents';

/** Declarative side effects triggered by missions, dialogue choices and world scripts. */
export type GameAction =
  | { type: 'setFlag'; flag: string; value?: number }
  | { type: 'message'; text: string; kind?: MessageKind; duration?: number }
  | { type: 'radio'; speaker: string; text: string }
  | { type: 'spawnGroup'; groupId: string }
  | { type: 'noise'; x: number; z: number; radius: number; kind: NoiseKind }
  | { type: 'revealObjective'; objectiveId: string }
  | { type: 'autosave' }
  | { type: 'giveItem'; itemId: string; quantity: number }
  | { type: 'takeItem'; itemId: string; quantity: number }
  | { type: 'npc'; npcId: string; command: 'follow' | 'stay' | 'treated' | 'hide' | 'board' }
  | { type: 'relationship'; npcId: string; delta: number }
  | { type: 'sound'; sound: string; x?: number; z?: number }
  | { type: 'alarm'; sourceId: string; seconds: number };

export type ActionHandler = (action: GameAction) => void;
