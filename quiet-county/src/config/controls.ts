/** Touch action buttons. Positions are anchored from the right/bottom of the safe area. */
export type TouchButtonId =
  | 'fire'
  | 'aim'
  | 'reload'
  | 'melee'
  | 'interact'
  | 'crouch'
  | 'sprint'
  | 'switch'
  | 'flashlight'
  | 'throw'
  | 'inventory'
  | 'map'
  | 'pause';

export interface TouchButtonLayout {
  id: TouchButtonId;
  label: string;
  /** Distance from right edge, in % of viewport width. */
  right: number;
  /** Distance from bottom edge, in % of viewport height. */
  bottom: number;
  /** Diameter in CSS px before the global scale. */
  size: number;
}

export const DEFAULT_TOUCH_LAYOUT: readonly TouchButtonLayout[] = [
  { id: 'fire', label: 'FIRE', right: 8, bottom: 29, size: 88 },
  { id: 'aim', label: 'AIM', right: 19.5, bottom: 12, size: 62 },
  { id: 'melee', label: 'MELEE', right: 18.5, bottom: 41, size: 60 },
  { id: 'reload', label: 'RELOAD', right: 6.5, bottom: 56, size: 52 },
  { id: 'interact', label: 'USE', right: 30, bottom: 27, size: 70 },
  { id: 'crouch', label: 'CROUCH', right: 31, bottom: 9, size: 56 },
  { id: 'sprint', label: 'SPRINT', right: 41.5, bottom: 9, size: 56 },
  { id: 'switch', label: 'SWAP', right: 7.5, bottom: 10, size: 56 },
  { id: 'flashlight', label: 'LIGHT', right: 15.5, bottom: 60, size: 46 },
  { id: 'throw', label: 'THROW', right: 26.5, bottom: 53, size: 46 },
  { id: 'inventory', label: 'BAG', right: 21, bottom: 85, size: 44 },
  { id: 'map', label: 'MAP', right: 27.5, bottom: 85, size: 44 },
  { id: 'pause', label: 'II', right: 34, bottom: 85, size: 40 },
];
