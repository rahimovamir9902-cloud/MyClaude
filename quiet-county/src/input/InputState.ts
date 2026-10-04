export type ActionId =
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

export type InputSource = 'touch' | 'keyboard' | 'bot';

/**
 * Device-independent input snapshot. Touch controls, keyboard/mouse and the QA autopilot
 * all write here; gameplay only reads actions, never raw events.
 */
export class InputState {
  private readonly moves = new Map<InputSource, { x: number; y: number }>();
  private readonly held = new Set<ActionId>();
  private readonly pressed = new Set<ActionId>();
  private readonly released = new Set<ActionId>();
  lookX = 0;
  lookY = 0;
  /** Which device produced input most recently (UI hints adapt to it). */
  lastSource: InputSource = 'keyboard';
  enabled = true;

  setMove(source: InputSource, x: number, y: number): void {
    if (x === 0 && y === 0) this.moves.delete(source);
    else {
      this.moves.set(source, { x, y });
      this.lastSource = source;
    }
  }

  /** Combined movement vector, clamped to unit length. y is forward. */
  get moveX(): number {
    return this.combined().x;
  }

  get moveY(): number {
    return this.combined().y;
  }

  get moveMagnitude(): number {
    const c = this.combined();
    return Math.hypot(c.x, c.y);
  }

  private combined(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const m of this.moves.values()) {
      x += m.x;
      y += m.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  press(action: ActionId, source: InputSource = 'keyboard'): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
    this.lastSource = source;
  }

  release(action: ActionId): void {
    if (this.held.delete(action)) this.released.add(action);
  }

  /** Instant press+release (e.g. a tap on a toggle button). */
  tap(action: ActionId, source: InputSource = 'keyboard'): void {
    this.pressed.add(action);
    this.released.add(action);
    this.lastSource = source;
  }

  addLook(dx: number, dy: number, source: InputSource = 'keyboard'): void {
    if (!this.enabled) return;
    this.lookX += dx;
    this.lookY += dy;
    this.lastSource = source;
  }

  isHeld(action: ActionId): boolean {
    return this.enabled && this.held.has(action);
  }

  wasPressed(action: ActionId): boolean {
    return this.enabled && this.pressed.has(action);
  }

  wasReleased(action: ActionId): boolean {
    return this.released.has(action);
  }

  /**
   * Clears one-shot edges (pressed/released) and look deltas while keeping held buttons.
   * Used between simulation substeps so a single tap never fires twice.
   */
  consumeEdges(): void {
    this.pressed.clear();
    this.released.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  /** Call once per frame after gameplay consumed the input. */
  endFrame(): void {
    this.pressed.clear();
    this.released.clear();
    this.lookX = 0;
    this.lookY = 0;
  }

  clear(): void {
    this.moves.clear();
    this.held.clear();
    this.pressed.clear();
    this.released.clear();
    this.lookX = 0;
    this.lookY = 0;
  }
}
