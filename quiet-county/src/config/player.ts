/** Protagonist tuning. Gameplay code reads these instead of hard-coding numbers. */
export const PLAYER = Object.freeze({
  name: 'Rowan Hale',
  radius: 0.35,
  height: 1.75,
  eyeHeight: 1.6,
  chestHeight: 1.3,
  crouchChestHeight: 0.85,

  walkSpeed: 2.2,
  runSpeed: 4.5,
  sprintSpeed: 6.3,
  crouchSpeed: 1.5,
  aimSpeed: 1.9,
  /** Joystick magnitude above which the character runs instead of walks. */
  runThreshold: 0.62,
  acceleration: 14,
  turnSpeed: 11,

  maxHealth: 100,
  maxStamina: 100,
  staminaSprintDrain: 15,
  staminaRegen: 22,
  staminaRegenDelay: 0.9,
  /** Once exhausted, sprinting unlocks again at this stamina. */
  exhaustedRecover: 30,
  hitInvulnerability: 0.35,
  hitSlowdown: 0.4,

  noise: Object.freeze({ crouch: 1.6, walk: 4, run: 8.5, sprint: 14, vault: 6, land: 5 }),
  stepLength: Object.freeze({ crouch: 0.55, walk: 0.75, run: 1.1, sprint: 1.45 }),

  /** Multipliers applied to how easily infected see the player. */
  visibility: Object.freeze({
    standing: 1,
    crouched: 0.55,
    inGrassStanding: 0.75,
    inGrassCrouched: 0.3,
    sprinting: 1.35,
    nightDarkness: 0.5,
    flashlightAtNight: 1.5,
  }),

  inventorySlots: 12,
  interactRange: 1.9,
  vaultDuration: 0.55,
  vaultMaxThickness: 0.9,

  flashlightDrainPerSecond: 0.22,
  flashlightRange: 24,

  takedownRange: 1.6,
  /** Minimum angle (degrees) between enemy facing and player for a rear takedown. */
  takedownRearAngle: 105,
  takedownDuration: 1.1,
});

export const STARTING_LOADOUT: readonly { itemId: string; quantity: number; ammo?: number }[] = [
  { itemId: 'w_crowbar', quantity: 1 },
  { itemId: 'w_c9', quantity: 1, ammo: 8 },
  { itemId: 'ammo_9mm', quantity: 6 },
  { itemId: 'bandage', quantity: 1 },
  { itemId: 'glass_bottle', quantity: 1 },
];
