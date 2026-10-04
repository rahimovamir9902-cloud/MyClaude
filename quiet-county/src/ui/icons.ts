import { svg } from './dom';

/** Original line-art glyphs for items and HUD (drawn for this project). */
const PATHS: Record<string, string> = {
  crowbar: '<path d="M6 26 L23 9"/><path d="M23 9 q4-4 6 0 q1 3-2 4"/><path d="M5 25 l3 3"/>',
  blade: '<path d="M8 24 L25 7 q3 2 0 6 L12 27z"/><path d="M5 27 l4-4"/>',
  bat: '<path d="M7 25 L22 10 q4-3 5 1 q1 3-3 5 L9 27z"/>',
  pipe: '<rect x="5" y="14" width="22" height="4" rx="1"/><path d="M9 12v8M14 12v8M19 12v8"/>',
  knife: '<path d="M6 26 l6-6"/><path d="M12 20 L26 7 q1 5-4 9 L14 22z"/>',
  pistol: '<path d="M5 11h21v5H13l-2 9H7l2-9H5z"/><path d="M14 16l1 3"/>',
  revolver: '<path d="M4 11h22v4H13l-2 10H7l2-10H4z"/><circle cx="15" cy="14" r="3"/>',
  shotgun: '<path d="M3 13h26v3H12l-6 6H3l4-6H3z"/>',
  rifle: '<path d="M2 13h28v3H14l-5 5H5l3-5H2z"/><path d="M18 11h6"/>',
  crossbow: '<path d="M4 16h22"/><path d="M20 8 q6 8 0 16"/><path d="M8 16l-3 5"/>',
  ammo: '<rect x="7" y="12" width="5" height="13" rx="1"/><rect x="14" y="10" width="5" height="15" rx="1"/><rect x="21" y="12" width="5" height="13" rx="1"/><path d="M7 15h5M14 13h5M21 15h5"/>',
  shell: '<rect x="10" y="9" width="8" height="16" rx="1"/><path d="M10 21h8"/>',
  bolt: '<path d="M5 27 L25 7"/><path d="M25 7l-5 1 4 4z"/>',
  bandage: '<rect x="6" y="11" width="20" height="10" rx="3" transform="rotate(-25 16 16)"/><path d="M14 13l4 6M12 15l2 3M18 11l2 3"/>',
  medkit: '<rect x="5" y="10" width="22" height="16" rx="2"/><path d="M12 10V7h8v3"/><path d="M16 14v8M12 18h8"/>',
  pills: '<rect x="9" y="8" width="14" height="18" rx="3"/><path d="M9 13h14"/><path d="M13 19h6"/>',
  can: '<ellipse cx="16" cy="9" rx="7" ry="2.5"/><path d="M9 9v14 q7 4 14 0V9"/><path d="M9 15 q7 3 14 0"/>',
  water: '<path d="M13 6h6v4l2 3v14H11V13l2-3z"/><path d="M11 18h10"/>',
  bar: '<rect x="5" y="12" width="22" height="8" rx="2"/><path d="M11 12v8M21 12v8"/>',
  battery: '<rect x="7" y="9" width="16" height="14" rx="2"/><path d="M23 13h2v6h-2"/><path d="M13 13l-2 4h4l-2 4"/>',
  bottle: '<path d="M14 5h4v5l3 4v13H11V14l3-4z"/>',
  wrench: '<path d="M7 25 L19 13"/><path d="M19 13 a5 5 0 1 0 2-7 l-2 3 2 2 3-2"/>',
  scrap: '<path d="M6 22l6-12 5 6 4-5 5 11z"/>',
  cloth: '<path d="M6 10 q5-3 10 0 t10 0 v12 q-5 3-10 0 t-10 0z"/>',
  tape: '<circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="4"/><path d="M25 16h4"/>',
  parts: '<rect x="8" y="10" width="12" height="12" rx="1"/><path d="M20 13h5M20 19h5M11 22v4M17 22v4M11 10V6M17 10V6"/>',
  powder: '<path d="M8 25h16l-3-12H11z"/><path d="M13 13V8h6v5"/>',
  case: '<rect x="4" y="11" width="24" height="14" rx="2"/><path d="M12 11V8h8v3"/><path d="M16 15v6M13 18h6"/>',
  fuel: '<path d="M8 8h12l4 4v15H8z"/><path d="M20 8l4 4"/><path d="M12 14l8 8M20 14l-8 8"/>',
  note: '<path d="M8 5h12l5 5v17H8z"/><path d="M11 13h10M11 17h10M11 21h7"/>',
};

export function itemIcon(name: string): SVGElement {
  const body = PATHS[name] ?? '<rect x="8" y="8" width="16" height="16" rx="2"/>';
  return svg(`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
}

export const EYE_SVG = `<svg viewBox="0 0 26 16"><path d="M1 8 Q13 -4 25 8 Q13 20 1 8z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle class="pupil" cx="13" cy="8" r="3.4" fill="currentColor"/></svg>`;
export const ROTATE_SVG = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="20" y="8" width="24" height="44" rx="4"/><path d="M8 44 q0 12 14 12"/><path d="M18 52l4 4-4 4"/></svg>`;
