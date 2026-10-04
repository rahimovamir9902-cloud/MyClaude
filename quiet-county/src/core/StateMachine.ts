export interface State<C, S extends string> {
  readonly id: S;
  enter?(ctx: C, previous: S | null): void;
  /** Return a state id to transition, or nothing to stay. */
  update?(ctx: C, dt: number): S | void;
  exit?(ctx: C, next: S): void;
}

/** Small finite state machine used by AI brains, the player and game flow. */
export class StateMachine<C, S extends string> {
  private readonly states = new Map<S, State<C, S>>();
  private currentState: State<C, S>;
  private elapsed = 0;
  private previousId: S | null = null;

  constructor(
    private readonly ctx: C,
    states: State<C, S>[],
    initial: S,
    private readonly onChange?: (from: S, to: S) => void,
  ) {
    for (const s of states) this.states.set(s.id, s);
    const first = this.states.get(initial);
    if (!first) throw new Error(`Unknown initial state "${initial}"`);
    this.currentState = first;
    first.enter?.(ctx, null);
  }

  get current(): S {
    return this.currentState.id;
  }

  get previous(): S | null {
    return this.previousId;
  }

  get timeInState(): number {
    return this.elapsed;
  }

  is(id: S): boolean {
    return this.currentState.id === id;
  }

  change(next: S): void {
    const target = this.states.get(next);
    if (!target) throw new Error(`Unknown state "${next}"`);
    if (target === this.currentState) return;
    const from = this.currentState.id;
    this.currentState.exit?.(this.ctx, next);
    this.previousId = from;
    this.currentState = target;
    this.elapsed = 0;
    target.enter?.(this.ctx, from);
    this.onChange?.(from, next);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const next = this.currentState.update?.(this.ctx, dt);
    if (next && next !== this.currentState.id) this.change(next);
  }
}
