import { createLogger } from '../core/Logger';
import type { ActionHandler, GameAction } from './Actions';
import { evaluateCondition, type Condition, type ConditionContext } from './Conditions';

const log = createLogger('Dialogue');

export interface DialogueChoiceDef {
  text: string;
  /** Node to go to, or null to end the conversation. */
  next: string | null;
  condition?: Condition;
  actions?: GameAction[];
  /** Hide after being picked once in this conversation. */
  once?: boolean;
}

export interface DialogueNodeDef {
  speaker: string;
  text: string;
  actions?: GameAction[];
  choices?: DialogueChoiceDef[];
  /** For nodes without choices: where "continue" leads (null ends). */
  next?: string | null;
}

export interface DialogueDef {
  id: string;
  npcId: string;
  /** First entry whose condition passes picks the starting node. */
  entries: { condition?: Condition; node: string }[];
  nodes: Record<string, DialogueNodeDef>;
}

export interface VisibleChoice {
  index: number;
  text: string;
}

/** Steps through a branching conversation, filtering choices by condition. */
export class DialogueRunner {
  private currentId: string | null = null;
  private readonly picked = new Set<string>();

  constructor(
    public readonly def: DialogueDef,
    private readonly ctx: ConditionContext,
    private readonly runAction: ActionHandler,
  ) {}

  get node(): DialogueNodeDef | null {
    return this.currentId ? (this.def.nodes[this.currentId] ?? null) : null;
  }

  get nodeId(): string | null {
    return this.currentId;
  }

  get finished(): boolean {
    return this.currentId === null;
  }

  start(): DialogueNodeDef | null {
    const entry = this.def.entries.find((e) => !e.condition || evaluateCondition(e.condition, this.ctx));
    if (!entry) {
      log.warn(`No entry node available for dialogue ${this.def.id}`);
      return null;
    }
    this.goto(entry.node);
    return this.node;
  }

  choices(): VisibleChoice[] {
    const node = this.node;
    if (!node?.choices) return [];
    return node.choices
      .map((c, index) => ({ c, index }))
      .filter(({ c, index }) => {
        if (c.once && this.picked.has(`${this.currentId}:${index}`)) return false;
        return !c.condition || evaluateCondition(c.condition, this.ctx);
      })
      .map(({ c, index }) => ({ index, text: c.text }));
  }

  /** Picks a choice by its original index (see {@link VisibleChoice.index}). */
  choose(index: number): DialogueNodeDef | null {
    const node = this.node;
    const choice = node?.choices?.[index];
    if (!node || !choice) return this.node;
    if (!this.choices().some((v) => v.index === index)) return this.node;
    this.picked.add(`${this.currentId}:${index}`);
    choice.actions?.forEach((a) => this.runAction(a));
    this.goto(choice.next);
    return this.node;
  }

  /** Advances a node without choices. */
  continue(): DialogueNodeDef | null {
    const node = this.node;
    if (!node) return null;
    if (node.choices && node.choices.length > 0) return node;
    this.goto(node.next ?? null);
    return this.node;
  }

  end(): void {
    this.currentId = null;
  }

  private goto(id: string | null): void {
    if (id === null) {
      this.currentId = null;
      return;
    }
    const node = this.def.nodes[id];
    if (!node) {
      log.error(`Dialogue ${this.def.id} references missing node "${id}"`);
      this.currentId = null;
      return;
    }
    this.currentId = id;
    node.actions?.forEach((a) => this.runAction(a));
  }
}
