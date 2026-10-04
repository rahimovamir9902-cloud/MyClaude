import type { ObjectiveStatus } from '../core/GameEvents';

/** Declarative predicates used by missions, dialogue and scripted events. */
export type Condition =
  | { type: 'true' }
  | { type: 'flag'; flag: string; atLeast?: number }
  | { type: 'hasItem'; itemId: string; quantity?: number }
  | { type: 'inZone'; zoneId: string }
  | { type: 'objective'; objectiveId: string; status?: ObjectiveStatus }
  | { type: 'killCount'; atLeast: number; archetype?: string }
  | { type: 'npcState'; npcId: string; state: string }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] }
  | { type: 'not'; of: Condition };

export interface ConditionContext {
  getFlag(flag: string): number;
  countItem(itemId: string): number;
  isInZone(zoneId: string): boolean;
  objectiveStatus(objectiveId: string): ObjectiveStatus | null;
  killCount(archetype?: string): number;
  npcState(npcId: string): string | null;
}

export function evaluateCondition(c: Condition, ctx: ConditionContext): boolean {
  switch (c.type) {
    case 'true':
      return true;
    case 'flag':
      return ctx.getFlag(c.flag) >= (c.atLeast ?? 1);
    case 'hasItem':
      return ctx.countItem(c.itemId) >= (c.quantity ?? 1);
    case 'inZone':
      return ctx.isInZone(c.zoneId);
    case 'objective':
      return ctx.objectiveStatus(c.objectiveId) === (c.status ?? 'completed');
    case 'killCount':
      return ctx.killCount(c.archetype) >= c.atLeast;
    case 'npcState':
      return ctx.npcState(c.npcId) === c.state;
    case 'all':
      return c.of.every((x) => evaluateCondition(x, ctx));
    case 'any':
      return c.of.some((x) => evaluateCondition(x, ctx));
    case 'not':
      return !evaluateCondition(c.of, ctx);
  }
}

/** Collects every flag/item/zone/objective id referenced, for data validation. */
export function conditionRefs(c: Condition, out: { flags: Set<string>; items: Set<string>; zones: Set<string>; objectives: Set<string>; npcs: Set<string> }): void {
  switch (c.type) {
    case 'flag':
      out.flags.add(c.flag);
      break;
    case 'hasItem':
      out.items.add(c.itemId);
      break;
    case 'inZone':
      out.zones.add(c.zoneId);
      break;
    case 'objective':
      out.objectives.add(c.objectiveId);
      break;
    case 'npcState':
      out.npcs.add(c.npcId);
      break;
    case 'all':
    case 'any':
      c.of.forEach((x) => conditionRefs(x, out));
      break;
    case 'not':
      conditionRefs(c.of, out);
      break;
    default:
      break;
  }
}
