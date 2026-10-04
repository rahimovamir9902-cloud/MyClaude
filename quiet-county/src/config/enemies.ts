export type ArchetypeId = 'common' | 'runner' | 'brute' | 'stalker';

export interface EnemyArchetype {
  id: ArchetypeId;
  name: string;
  description: string;
  health: number;
  walkSpeed: number;
  chaseSpeed: number;
  /** Radians per second. */
  turnSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackWindup: number;
  attackCooldown: number;
  visionRange: number;
  /** Full field of view in degrees. */
  visionFov: number;
  /** Distance at which the player is sensed from any angle. */
  proximitySense: number;
  hearingMultiplier: number;
  /** Awareness gained per second at full visibility. */
  awarenessGain: number;
  awarenessDecay: number;
  /** Damage in a single hit needed to stagger. */
  staggerThreshold: number;
  staggerDuration: number;
  /** Seconds to search a last known position before giving up. */
  searchDuration: number;
  /** Seconds without sight before a chase turns into a search. */
  loseSightTime: number;
  wanderRadius: number;
  doorBashTime: number;
  scale: number;
  radius: number;
  takedownable: boolean;
  /** Vocal alert radius that pulls nearby infected in (group behavior). */
  alertRadius: number;
  flanks: boolean;
  quiet: boolean;
  knockback: number;
  skinTones: number[];
  clothTones: number[];
  posture: 'shamble' | 'lean' | 'hulk' | 'crouch';
}

const defs: EnemyArchetype[] = [
  {
    id: 'common', name: 'Hollow', description: 'Slow and clumsy alone. In numbers, a tide.',
    health: 100, walkSpeed: 0.85, chaseSpeed: 3.1, turnSpeed: 4.5,
    attackDamage: 14, attackRange: 1.35, attackWindup: 0.55, attackCooldown: 1.4,
    visionRange: 17, visionFov: 120, proximitySense: 2.0, hearingMultiplier: 1.0,
    awarenessGain: 1.1, awarenessDecay: 0.3,
    staggerThreshold: 30, staggerDuration: 0.7, searchDuration: 10, loseSightTime: 3.5,
    wanderRadius: 7, doorBashTime: 2.2, scale: 1.0, radius: 0.35, takedownable: true,
    alertRadius: 13, flanks: false, quiet: false, knockback: 0,
    skinTones: [0x8a8f7c, 0x7d8274, 0x948b7a, 0x6f776e], clothTones: [0x3c4a52, 0x5a4a3a, 0x4b5240, 0x6a5f55, 0x2f3438, 0x704a3c],
    posture: 'shamble',
  },
  {
    id: 'runner', name: 'Runner', description: 'Freshly turned and fast. Fragile, frantic and loud.',
    health: 65, walkSpeed: 1.3, chaseSpeed: 5.6, turnSpeed: 7,
    attackDamage: 10, attackRange: 1.3, attackWindup: 0.35, attackCooldown: 0.9,
    visionRange: 20, visionFov: 130, proximitySense: 2.5, hearingMultiplier: 1.2,
    awarenessGain: 1.5, awarenessDecay: 0.35,
    staggerThreshold: 20, staggerDuration: 0.6, searchDuration: 12, loseSightTime: 5,
    wanderRadius: 12, doorBashTime: 1.6, scale: 0.97, radius: 0.33, takedownable: true,
    alertRadius: 20, flanks: false, quiet: false, knockback: 0,
    skinTones: [0xa29a88, 0x988f80], clothTones: [0x2e4e6e, 0x7a2f2f, 0x55585c],
    posture: 'lean',
  },
  {
    id: 'brute', name: 'Brute', description: 'Swollen and enormous. Shrugs off blows and splinters doors.',
    health: 380, walkSpeed: 0.75, chaseSpeed: 2.6, turnSpeed: 2.5,
    attackDamage: 32, attackRange: 1.8, attackWindup: 0.9, attackCooldown: 2.0,
    visionRange: 14, visionFov: 100, proximitySense: 2.5, hearingMultiplier: 0.9,
    awarenessGain: 0.9, awarenessDecay: 0.25,
    staggerThreshold: 90, staggerDuration: 0.9, searchDuration: 8, loseSightTime: 3,
    wanderRadius: 5, doorBashTime: 0.6, scale: 1.35, radius: 0.55, takedownable: false,
    alertRadius: 10, flanks: false, quiet: false, knockback: 2.5,
    skinTones: [0x7c7464, 0x857c6c], clothTones: [0x3a3a30, 0x4a3b2c],
    posture: 'hulk',
  },
  {
    id: 'stalker', name: 'Stalker', description: 'Silent. Keeps to shadows and circles behind you.',
    health: 85, walkSpeed: 1.1, chaseSpeed: 4.2, turnSpeed: 6,
    attackDamage: 18, attackRange: 1.4, attackWindup: 0.45, attackCooldown: 1.2,
    visionRange: 22, visionFov: 140, proximitySense: 1.5, hearingMultiplier: 1.4,
    awarenessGain: 1.3, awarenessDecay: 0.2,
    staggerThreshold: 28, staggerDuration: 0.6, searchDuration: 16, loseSightTime: 6,
    wanderRadius: 15, doorBashTime: 3, scale: 1.02, radius: 0.33, takedownable: true,
    alertRadius: 0, flanks: true, quiet: true, knockback: 0,
    skinTones: [0x6c6e66, 0x5f625c], clothTones: [0x202326, 0x2b2a27],
    posture: 'crouch',
  },
];

export const ARCHETYPES: Readonly<Record<ArchetypeId, EnemyArchetype>> = Object.freeze(
  Object.fromEntries(defs.map((d) => [d.id, d])) as Record<ArchetypeId, EnemyArchetype>,
);

export function getArchetype(id: string): EnemyArchetype {
  const def = (ARCHETYPES as Record<string, EnemyArchetype>)[id];
  if (!def) throw new Error(`Unknown enemy archetype "${id}"`);
  return def;
}
