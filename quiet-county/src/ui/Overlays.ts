import { getItem } from '../config/items';
import { getWeapon } from '../config/weapons';
import type { DialogueRunner } from '../systems/DialogueSystem';
import type { Inventory, ItemStack } from '../systems/Inventory';
import type { HudSnapshot } from '../game/GameSession';
import type { LootContainer, NoteObject } from '../world/WorldObjects';
import { button, el } from './dom';
import { itemIcon } from './icons';
import type { MapRenderer } from './MapRenderer';
import type { ScreenHost } from './Screens';

function slotNode(stack: ItemStack | null, opts: { selected?: boolean; equipped?: boolean } = {}): HTMLElement {
  if (!stack) return el('div', 'slot empty');
  const def = getItem(stack.itemId);
  const n = el('div', `slot ${opts.selected ? 'selected' : ''} ${opts.equipped ? 'equipped' : ''} ${def.quest ? 'quest' : ''}`);
  n.append(itemIcon(def.icon), el('div', 'nm', {}, def.name));
  if (stack.quantity > 1) n.append(el('div', 'qty', {}, `x${stack.quantity}`));
  if (def.weaponId) {
    const w = getWeapon(def.weaponId);
    if (w.magazine > 0) n.append(el('div', 'qty', {}, `${stack.ammo ?? 0}/${w.magazine}`));
    const bar = el('div', 'mini');
    const fill = el('div');
    fill.style.width = `${Math.round(((stack.durability ?? w.durability) / w.durability) * 100)}%`;
    bar.append(fill);
    n.append(bar);
  }
  return n;
}

export interface InventoryActions {
  use(slot: number): void;
  equip(slot: number): void;
  drop(slot: number): void;
  close(): void;
}

/** Bag management: limited slots force choices about what to carry. */
export function inventoryOverlay(host: ScreenHost, inv: Inventory, equippedSlot: () => number, vitals: () => string, actions: InventoryActions): { refresh(): void } {
  const s = el('div', 'screen', { id: 'inventory' });
  const panel = el('div', 'panel');
  let selected = inv.slots.findIndex((x) => !!x);
  const grid = el('div', 'inv-grid');
  const detail = el('div', 'detail col');
  const cap = el('div', 'capacity');
  const refresh = () => {
    grid.innerHTML = '';
    inv.slots.forEach((stack, i) => {
      const n = slotNode(stack, { selected: i === selected, equipped: i === equippedSlot() });
      n.dataset.slot = String(i);
      n.addEventListener('click', () => {
        selected = i;
        host.click();
        refresh();
      });
      grid.append(n);
    });
    cap.textContent = `Slots ${inv.usedSlots}/${inv.capacity}  -  ${inv.totalWeight().toFixed(1)} kg  -  ${vitals()}`;
    detail.innerHTML = '';
    const stack = selected >= 0 ? inv.getSlot(selected) : null;
    if (!stack) {
      detail.append(el('p', 'muted', {}, 'Select an item.'));
      return;
    }
    const def = getItem(stack.itemId);
    detail.append(el('div', 'cat', {}, def.quest ? 'Quest item' : def.category), el('h3', '', {}, def.name), el('p', '', {}, def.description));
    if (def.weaponId) {
      const w = getWeapon(def.weaponId);
      const rows: [string, string][] = [
        ['Damage', String(w.damage) + (w.pellets > 1 ? ` x${w.pellets}` : '')],
        ['Range', `${w.range} m`],
        ['Noise', `${w.noise} m`],
        ['Durability', `${Math.round(stack.durability ?? w.durability)} / ${w.durability}`],
      ];
      if (w.magazine) rows.push(['Magazine', `${stack.ammo ?? 0} / ${w.magazine}`]);
      else rows.push(['Stamina / swing', String(w.staminaCost)]);
      const table = el('div', 'muted', { style: 'font-size:14px;display:grid;grid-template-columns:auto 1fr;gap:2px 12px' });
      for (const [k, v] of rows) table.append(el('span', '', {}, k), el('span', '', { style: 'color:var(--text)' }, v));
      detail.append(table);
    }
    detail.append(el('p', 'muted', { style: 'font-size:13px' }, `${def.weight} kg each`));
    const row = el('div', 'row');
    if (def.effect) row.append(button('Use', () => actions.use(selected), 'btn small primary', { id: 'btn-use' }));
    if (def.weaponId && selected !== equippedSlot()) row.append(button('Equip', () => {
      actions.equip(selected);
      refresh();
    }, 'btn small', { id: 'btn-equip' }));
    if (!def.quest) row.append(button('Discard', () => {
      if (confirm(`Discard ${def.name}? It will be lost.`)) {
        actions.drop(selected);
        refresh();
      }
    }, 'btn small danger'));
    detail.append(row);
  };
  refresh();
  panel.append(
    el('div', 'row', {}, el('div', 'col', { style: 'gap:0' }, el('div', 'kicker', {}, 'Bag'), el('h2', '', {}, 'Inventory')), el('div', 'spacer'), button('Close', () => actions.close(), 'btn small', { id: 'btn-inv-close' })),
    el('hr', 'rule'),
    el('div', 'inv-layout', {}, el('div', '', {}, grid, cap), detail),
  );
  s.append(panel);
  host.mount(s);
  return { refresh };
}

export interface LootActions {
  take(index: number): void;
  takeAll(): void;
  stash(slot: number): void;
  close(): void;
}

export function lootOverlay(host: ScreenHost, container: LootContainer, inv: Inventory, actions: LootActions): { refresh(): void } {
  const s = el('div', 'screen', { id: 'loot' });
  const panel = el('div', 'panel');
  const list = el('div', 'col', { style: 'gap:0' });
  const bag = el('div', 'inv-grid');
  const cap = el('div', 'capacity');
  const refresh = () => {
    list.innerHTML = '';
    if (container.contents.length === 0) list.append(el('div', 'loot-empty', {}, 'Nothing left.'));
    container.contents.forEach((stack, i) => {
      const def = getItem(stack.itemId);
      const fits = inv.spaceFor(stack.itemId) > 0;
      list.append(
        el('div', 'loot-row', {}, itemIcon(def.icon), el('span', 'nm', {}, `${def.name}${stack.quantity > 1 ? ` x${stack.quantity}` : ''}`),
          button(fits ? 'Take' : 'No room', () => actions.take(i), `btn small ${fits ? '' : 'danger'}`, { 'data-loot': String(i) })),
      );
    });
    bag.innerHTML = '';
    inv.slots.forEach((stack, i) => {
      const n = slotNode(stack);
      if (stack && !getItem(stack.itemId).quest) {
        n.title = 'Tap to leave this item here';
        n.addEventListener('click', () => actions.stash(i));
      }
      bag.append(n);
    });
    cap.textContent = `Bag ${inv.usedSlots}/${inv.capacity} slots - tap an item in your bag to leave it here`;
  };
  refresh();
  panel.append(
    el('div', 'row', {}, el('div', 'col', { style: 'gap:0' }, el('div', 'kicker', {}, 'Searching'), el('h2', '', {}, container.spec.label.replace(/^Search (the )?/i, '').replace(/^Open /, ''))), el('div', 'spacer'),
      button('Take all', () => actions.takeAll(), 'btn small primary', { id: 'btn-take-all' }), button('Close', () => actions.close(), 'btn small', { id: 'btn-loot-close' })),
    el('hr', 'rule'),
    el('div', 'inv-layout', {}, list, el('div', '', {}, bag, cap)),
  );
  s.append(panel);
  host.mount(s);
  return { refresh };
}

/** Branching conversation panel. */
export function dialogueOverlay(host: ScreenHost, runner: DialogueRunner, speakerFallback: string, onEnd: () => void): void {
  const box = el('div', 'dialogue', { id: 'dialogue' });
  const speaker = el('div', 'speaker');
  const text = el('div', 'text');
  const choices = el('div', 'choices');
  box.append(speaker, text, choices);
  const render = () => {
    const node = runner.node;
    if (!node) {
      onEnd();
      return;
    }
    speaker.textContent = node.speaker || speakerFallback;
    text.textContent = node.text;
    choices.innerHTML = '';
    const visible = runner.choices();
    if (visible.length === 0) {
      choices.append(button('Continue', () => {
        host.click();
        runner.continue();
        render();
      }, 'btn choice', { 'data-choice': 'continue' }));
    } else {
      visible.forEach((c, i) => {
        choices.append(button(`${i + 1}. ${c.text}`, () => {
          host.click();
          runner.choose(c.index);
          render();
        }, 'btn choice', { 'data-choice': String(i) }));
      });
    }
  };
  const wrap = el('div', 'screen', { style: 'background:rgba(0,0,0,0.25);align-items:flex-end' }, box);
  host.mount(wrap);
  render();
}

export function noteOverlay(host: ScreenHost, note: NoteObject, onClose: () => void): void {
  const s = el('div', 'screen', { id: 'note' });
  const card = el('div', 'note-card');
  card.append(el('h2', '', {}, note.def.title), el('div', 'body', {}, note.def.body), button('Put it down', () => {
    host.click();
    onClose();
  }, 'btn small', { id: 'btn-note-close' }));
  s.append(card);
  host.mount(s);
}

export function mapOverlay(host: ScreenHost, map: MapRenderer, hud: HudSnapshot, onClose: () => void): void {
  const s = el('div', 'screen solid', { id: 'map' });
  const canvas = el('canvas', '', { id: 'fullmap' });
  const h = Math.min(window.innerHeight - 40, 900);
  canvas.width = Math.round(h * (map.image.width / map.image.height));
  canvas.height = Math.round(h);
  canvas.style.height = `${h}px`;
  map.drawFull(canvas, hud);
  const side = el('div', 'map-side col');
  side.append(el('div', 'kicker', {}, 'Calder Junction'), el('h2', '', {}, 'Map'));
  const list = el('ul', 'objective-list');
  for (const o of hud.objectives) list.append(el('li', `${o.kind} ${o.status}`, {}, o.text, el('span', 'tag', {}, o.kind)));
  side.append(list);
  const legend = el('div', 'legend');
  for (const [c, t] of [['#e8a33d', 'Primary objective'], ['#d8d2c4', 'Secondary / optional'], ['#86ad74', 'Extraction'], ['rgba(110,128,70,0.9)', 'Tall grass (cover)'], ['#8a8678', 'Building']]) {
    const i = el('i');
    i.style.background = c;
    legend.append(i, el('span', '', {}, t));
  }
  side.append(legend, el('p', 'muted', { style: 'font-size:13px' }, `${hud.clock} - ${hud.phase}`), button('Close', onClose, 'btn', { id: 'btn-map-close' }));
  s.append(el('div', 'map-layout', {}, el('div', 'map-canvas-wrap', {}, canvas), side));
  host.mount(s);
}
