import { RECIPES, type CraftStation, type Recipe } from '../config/crafting';
import type { Inventory } from './Inventory';

export type CraftBlock = 'missing' | 'station' | 'noRoom' | null;

/** Pure crafting rules over an inventory (UI arrives in Phase 4). */
export class Crafting {
  constructor(private readonly recipes: readonly Recipe[] = RECIPES) {}

  get all(): readonly Recipe[] {
    return this.recipes;
  }

  get(id: string): Recipe | undefined {
    return this.recipes.find((r) => r.id === id);
  }

  check(recipe: Recipe, inv: Inventory, station: CraftStation): CraftBlock {
    if (recipe.station === 'workbench' && station !== 'workbench') return 'station';
    if (!recipe.inputs.every((i) => inv.has(i.itemId, i.quantity))) return 'missing';
    // Room check after consuming inputs: simulate on a copy.
    const sim = inv.serialize();
    const temp = new (inv.constructor as new (c: number) => Inventory)(sim.capacity);
    temp.load(sim);
    recipe.inputs.forEach((i) => temp.remove(i.itemId, i.quantity));
    if (!temp.canAdd(recipe.output.itemId, recipe.output.quantity)) return 'noRoom';
    return null;
  }

  available(inv: Inventory, station: CraftStation): Recipe[] {
    return this.recipes.filter((r) => this.check(r, inv, station) === null);
  }

  /** Consumes inputs and adds the output. Returns false (and changes nothing) if blocked. */
  craft(recipe: Recipe, inv: Inventory, station: CraftStation): boolean {
    if (this.check(recipe, inv, station) !== null) return false;
    recipe.inputs.forEach((i) => inv.remove(i.itemId, i.quantity, 'crafted'));
    inv.add(recipe.output.itemId, recipe.output.quantity, {}, 'craft');
    return true;
  }
}
