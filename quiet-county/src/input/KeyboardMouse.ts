import type { ActionId, InputState } from './InputState';

const ACTION_KEYS: Record<string, ActionId> = {
  KeyE: 'interact',
  KeyR: 'reload',
  KeyC: 'crouch',
  ControlLeft: 'crouch',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyQ: 'switch',
  KeyV: 'melee',
  KeyF: 'flashlight',
  KeyG: 'throw',
  Tab: 'inventory',
  KeyI: 'inventory',
  KeyM: 'map',
  Escape: 'pause',
  KeyP: 'pause',
  Space: 'interact',
};

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Desktop controls for development and browser play: WASD, mouse look, buttons. */
export class KeyboardMouse {
  private readonly down = new Set<string>();
  private locked = false;

  constructor(
    private readonly canvas: HTMLElement,
    private readonly input: InputState,
    private readonly isPlaying: () => boolean,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.releaseAll());
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      // Esc releases pointer lock in browsers; treat that as a pause request.
      if (was && !this.locked && this.isPlaying()) this.input.tap('pause', 'keyboard');
    });
  }

  private updateMove(): void {
    let x = 0;
    let y = 0;
    for (const k of this.down) {
      const m = MOVE_KEYS[k];
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    // Walk while holding Alt (keyboard has no analog stick).
    const scale = this.down.has('AltLeft') ? 0.5 : 1;
    this.input.setMove('keyboard', x * scale, y * scale);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
    if (e.code === 'Tab') e.preventDefault();
    if (this.down.has(e.code)) return;
    this.down.add(e.code);
    if (MOVE_KEYS[e.code] || e.code === 'AltLeft') this.updateMove();
    const action = ACTION_KEYS[e.code];
    if (action) this.input.press(action, 'keyboard');
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    if (MOVE_KEYS[e.code] || e.code === 'AltLeft') this.updateMove();
    const action = ACTION_KEYS[e.code];
    if (action) this.input.release(action);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.isPlaying()) return;
    if (!this.locked && e.button === 0) {
      void this.canvas.requestPointerLock?.();
    }
    if (e.button === 0) this.input.press('fire', 'keyboard');
    if (e.button === 2) this.input.press('aim', 'keyboard');
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.input.release('fire');
    if (e.button === 2) this.input.release('aim');
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (this.locked) this.input.addLook(e.movementX * 0.6, e.movementY * 0.6, 'keyboard');
  };

  releaseAll(): void {
    this.down.clear();
    this.input.clear();
  }

  exitPointerLock(): void {
    if (this.locked) document.exitPointerLock?.();
  }
}
