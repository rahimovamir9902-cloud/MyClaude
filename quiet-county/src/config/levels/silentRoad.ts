import type { LevelDef, PropDef, SpawnDef } from '../../world/LevelTypes';

/**
 * LEVEL: Calder Junction service stop (Mission 01 "The Silent Road").
 *
 * Layout (north is -Z):
 *  - Route 9 highway runs north-south along the west (x -38..-26). The player starts at the
 *    south end; a jackknifed refrigerated rig blocks the road around z = 38.
 *  - SAFE ROUTE: the tall-grass farm field east of the highway (stealth cover) leads to the
 *    store's south side and its broken window.
 *  - DANGEROUS SHORTCUT: straight up the highway past abandoned cars (loot, an alarm car,
 *    wandering infected) to the fuel canopy and the store's front doors.
 *  - The store holds the office (primary objective, pry the door or vault the broken office
 *    window from the back lot), a walk-in cooler (stranded survivor) and storage.
 *  - The maintenance garage (fuel, mechanic's locker) sits in the back lot.
 *  - HIDDEN AREA: a collapsed section of the back fence leads to Walt's camp (stash, save).
 *  - EXTRACTION: Teo's pickup at the north overpass beyond the jersey barriers.
 */

const STORE = 'store';
const GARAGE = 'garage';

const storeProps: PropDef[] = [
  { type: 'shelf', x: 6.5, z: -15, rot: Math.PI / 2, w: 5, interior: STORE, container: { id: 's_shelf_a', tableId: 'store_shelf', label: 'Search the shelves', offset: { x: 0, z: 0.85 } } },
  { type: 'shelf', x: 9.5, z: -15, rot: Math.PI / 2, w: 5, interior: STORE, container: { id: 's_shelf_b', tableId: 'store_shelf', label: 'Search the shelves', offset: { x: 0, z: 0.85 } } },
  { type: 'shelf', x: 9.5, z: -22.8, rot: Math.PI / 2, w: 3.5, interior: STORE },
  { type: 'counter', x: 2.2, z: -11.5, rot: Math.PI / 2, w: 2.6, interior: STORE, container: { id: 's_counter', tableId: 'store_counter', label: 'Search behind the counter', offset: { x: 0, z: 0.95 } } },
  { type: 'fridge', x: 12.4, z: -23.4, rot: -Math.PI / 2, interior: STORE },
  { type: 'fridge', x: 12.4, z: -22.15, rot: -Math.PI / 2, interior: STORE },
  { type: 'fridge', x: 12.4, z: -20.9, rot: -Math.PI / 2, interior: STORE },
  { type: 'magazineRack', x: 0.6, z: -20.1, rot: Math.PI / 2, interior: STORE },
  { type: 'debris', x: 8, z: -10, interior: STORE },
  { type: 'boxes', x: 11.2, z: -9.2, interior: STORE },
  // Walk-in cooler where Ines hides.
  { type: 'boxes', x: 1.1, z: -25, interior: STORE },
  { type: 'crate', x: 4.2, z: -25.1, w: 0.8, interior: STORE },
  { type: 'tarp', x: 2.6, z: -23.6, w: 1.6, d: 1.2, color: 0x4a5a6a, interior: STORE },
  // Storage hallway.
  { type: 'shelf', x: 19.35, z: -12.5, rot: Math.PI / 2, w: 4, interior: STORE, container: { id: 's_storage_shelf', tableId: 'crate', label: 'Search the storage shelf', offset: { x: 0, z: -0.85 } } },
  { type: 'crate', x: 14.2, z: -9.0, interior: STORE, container: { id: 's_storage_crate', tableId: 'crate', label: 'Search the crate', offset: { x: 0.1, z: -0.8 } } },
  { type: 'crate', x: 15.2, z: -9.0, w: 0.8, interior: STORE },
  { type: 'bodyBag', x: 16.6, z: -13.6, rot: 0.4, interior: STORE },
  { type: 'pallet', x: 17.6, z: -9.3, interior: STORE },
  // Office.
  // Desk against the west wall under the alarm panel, keeping the back door clear.
  { type: 'desk', x: 14.0, z: -22.5, rot: Math.PI / 2, interior: STORE, container: { id: 's_office_desk', tableId: 'office_desk', label: 'Search the desk', offset: { x: -0.5, z: 0.8 } } },
  { type: 'chair', x: 14.95, z: -22.3, rot: -Math.PI / 2, interior: STORE },
  { type: 'fileCabinet', x: 19.4, z: -25.2, rot: -Math.PI / 2, interior: STORE, container: { id: 's_office_files', tableId: 'office_desk', label: 'Search the filing cabinet', offset: { x: 0, z: 0.75 } } },
  { type: 'medCabinet', x: 14.2, z: -25.6, interior: STORE, container: { id: 's_office_med', tableId: 'medicine_cabinet', label: 'Search the medicine cabinet', offset: { x: 0, z: 0.8 } } },
  { type: 'cot', x: 18.9, z: -20.3, interior: STORE },
  { type: 'footlocker', x: 14.4, z: -18.1, interior: STORE },
];

const garageProps: PropDef[] = [
  { type: 'carLift', x: 30.5, z: -36.5, rot: Math.PI / 2, interior: GARAGE },
  { type: 'workbench', x: 30, z: -41.25, w: 3, interior: GARAGE, container: { id: 'g_workbench', tableId: 'garage_toolbox', label: 'Search the workbench', offset: { x: 0, z: 0.85 } } },
  { type: 'toolbox', x: 31.1, z: -41.3, y: 0.89, interior: GARAGE },
  { type: 'locker', x: 37.4, z: -33.0, rot: -Math.PI / 2, interior: GARAGE, container: { id: 'g_mechanic_locker', tableId: 'locker', label: "Search Walt's locker", setsFlag: 'garage_locker_searched', guaranteed: [{ itemId: 'ammo_9mm', quantity: 9 }, { itemId: 'bandage', quantity: 1 }], offset: { x: 0, z: 0.75 } } },
  { type: 'locker', x: 37.4, z: -33.6, rot: -Math.PI / 2, color: 0x5a5e52, interior: GARAGE },
  { type: 'locker', x: 37.4, z: -34.2, rot: -Math.PI / 2, interior: GARAGE, container: { id: 'g_locker_2', tableId: 'locker', label: 'Search the locker', offset: { x: 0, z: 0.75 } } },
  { type: 'drums', x: 26.2, z: -40.8, interior: GARAGE },
  { type: 'tires', x: 36.6, z: -41.0, interior: GARAGE },
  { type: 'tires', x: 35.7, z: -41.2, interior: GARAGE },
  { type: 'generator', x: 35.4, z: -30.9, interior: GARAGE },
  { type: 'barrel', x: 25.0, z: -30.8, color: 0x8a2f2a, interior: GARAGE },
];

const outsideProps: PropDef[] = [
  // Fuel canopy and pumps.
  { type: 'canopy', x: -14, z: -9, w: 14, d: 12, h: 4.4 },
  { type: 'fuelPump', x: -16.5, z: -11.5 },
  { type: 'fuelPump', x: -11.5, z: -11.5 },
  { type: 'fuelPump', x: -16.5, z: -6.5 },
  { type: 'fuelPump', x: -11.5, z: -6.5, color: 0xc8c2b2 },
  { type: 'signPole', x: -21.5, z: 4.5, h: 7.5, rot: Math.PI / 2, text: 'CALDER JUNCTION|FUEL - GOODS' },
  { type: 'roadSign', x: -23.2, z: 58, w: 3.2, text: 'CALDER JUNCTION|SERVICES AHEAD' },
  { type: 'bench', x: -1.2, z: -12.6, rot: -Math.PI / 2 },
  { type: 'mailbox', x: -23, z: 12 },
  { type: 'lamp', x: -2.5, z: -3.5, rot: Math.PI / 2 },
  { type: 'lamp', x: 20.5, z: -45.5 },
  // Back lot.
  { type: 'dumpster', x: 6, z: -29.6 },
  { type: 'dumpster', x: 9.1, z: -29.7, rot: 0.06, container: { id: 'b_dumpster', tableId: 'crate', label: 'Search the dumpster', offset: { x: 0, z: 0.95 } } },
  { type: 'pallet', x: 12.2, z: -29.2, rot: 0.3 },
  { type: 'pallet', x: 13.6, z: -30.4, rot: -0.2 },
  { type: 'crate', x: 3, z: -29.5 },
  { type: 'boxes', x: 1.2, z: -30.2, rot: 0.4 },
  { type: 'barrel', x: 22.4, z: -40.2 },
  { type: 'barrel', x: 22.5, z: -38.9, color: 0x5a6a3a },
  { type: 'tires', x: 21.8, z: -35.5 },
  // Utility poles along the highway.
  { type: 'utilityPole', x: -23.2, z: 66 },
  { type: 'utilityPole', x: -23.2, z: 36 },
  { type: 'utilityPole', x: -23.2, z: 8 },
  { type: 'utilityPole', x: -23.2, z: -26 },
  { type: 'utilityPole', x: -23.2, z: -58 },
  // Start area: abandoned belongings.
  { type: 'suitcase', x: -32.5, z: 51.5, color: 0x6a3a3a },
  { type: 'suitcase', x: -31.1, z: 49.2 },
  { type: 'backpack', x: -33.6, z: 50.4, container: { id: 'b_start_pack', tableId: 'backpack', label: 'Search the backpack', offset: { x: 0.6, z: 0.4 } } },
  { type: 'debris', x: -30, z: 46.5 },
  { type: 'debris', x: -28, z: 24 },
  { type: 'debris', x: -33, z: -36 },
  // Farm field.
  { type: 'tractor', x: 28, z: 44, rot: 0.6 },
  { type: 'hayBale', x: 18, z: 38, rot: 0.2 },
  { type: 'hayBale', x: 19.7, z: 38.7, rot: 0.1 },
  { type: 'hayBale', x: 35, z: 54, rot: 1.2 },
  { type: 'hayBale', x: -4, z: 33, rot: 0.6 },
  { type: 'pivot', x: 25, z: 60, w: 22, rot: 0.1 },
  { type: 'tires', x: 14.5, z: 31.5 },
  // North road cover.
  { type: 'barrier', x: -36.4, z: -50 },
  { type: 'barrier', x: -34.2, z: -50.2, rot: 0.08 },
  { type: 'barrier', x: -28.8, z: -50 },
  { type: 'barrier', x: -26.8, z: -49.6, rot: -0.15 },
  { type: 'debris', x: -31, z: -52 },
  // Walt's hidden camp.
  { type: 'camper', x: 50, z: -60, rot: 0.3 },
  { type: 'campfire', x: 46, z: -57.5 },
  { type: 'chair', x: 44.8, z: -56.2, rot: 2.2 },
  { type: 'tarp', x: 44, z: -59.5, w: 2.2, d: 2.8 },
  { type: 'footlocker', x: 47.4, z: -61.6, rot: 0.3, container: { id: 'h_trailer_stash', tableId: 'backpack', label: "Open Walt's footlocker", setsFlag: 'trailer_stash_searched', guaranteed: [{ itemId: 'medkit', quantity: 1 }, { itemId: 'ammo_9mm', quantity: 9 }, { itemId: 'battery', quantity: 1 }], offset: { x: 0, z: 0.8 } } },
];

const commons = (list: Omit<SpawnDef, 'archetype'>[]): SpawnDef[] => list.map((s) => ({ archetype: 'common', ...s }));

export const SILENT_ROAD_LEVEL: LevelDef = {
  id: 'calder_junction',
  name: 'Calder Junction',
  region: 'Route 9 - Calder Valley',
  bounds: { x0: -56, z0: -74, x1: 62, z1: 74 },
  seed: 90210,
  playerStart: { x: -31, z: 66, yaw: 0 },
  baseGround: { material: 'grass', surface: 'grass' },
  ground: [
    { rect: { x0: -41.5, z0: -74, x1: -38, z1: 74 }, material: 'gravel', surface: 'gravel' },
    { rect: { x0: -26, z0: -74, x1: -24, z1: 74 }, material: 'gravel', surface: 'gravel' },
    { rect: { x0: 22, z0: 40, x1: 34, z1: 50 }, material: 'dirt', surface: 'dirt' },
    { rect: { x0: 10, z0: -6, x1: 13, z1: 72 }, material: 'dirt', surface: 'dirt' },
    { rect: { x0: 40, z0: -66, x1: 56, z1: -52 }, material: 'dirt', surface: 'dirt' },
    { rect: { x0: -24, z0: -47, x1: 0, z1: 6 }, material: 'asphalt', surface: 'asphalt', color: 0xc4c4c2 },
    { rect: { x0: 0, z0: -47, x1: 46, z1: -26 }, material: 'asphalt', surface: 'asphalt', color: 0xbcbcba },
    { rect: { x0: 20, z0: -26, x1: 46, z1: -6 }, material: 'asphalt', surface: 'asphalt', color: 0xbcbcba },
    { rect: { x0: -21, z0: -15, x1: -7, z1: -3 }, material: 'concrete', surface: 'concrete' },
    { rect: { x0: -2, z0: -26, x1: 0, z1: -8 }, material: 'concrete', surface: 'concrete' },
    { rect: { x0: 20, z0: -41, x1: 24, z1: -31 }, material: 'concrete', surface: 'concrete' },
  ],
  roads: [{ rect: { x0: -38, z0: -74, x1: -26, z1: 74 }, axis: 'z', lanes: 2 }],
  buildings: [
    {
      id: STORE,
      name: 'Calder Junction Goods',
      rect: { x0: 0, z0: -26, x1: 20, z1: -8 },
      height: 3.4,
      wallMaterial: 'siding',
      wallColor: 0xcfc6b0,
      trimColor: 0x7a2a22,
      interiorMaterial: 'paint',
      interiorColor: 0xb4b09c,
      floorMaterial: 'tile',
      floorSurface: 'floor',
      roofMaterial: 'concrete',
      roofColor: 0x707070,
      openings: {
        w: [
          { at: 5.5, width: 2.0, kind: 'window', sill: 0.9, top: 2.5 },
          { at: 8.5, width: 2.4, kind: 'door', doorId: 'store_front' },
          { at: 11.5, width: 5, kind: 'window', sill: 0.9, top: 2.5 },
        ],
        s: [
          { at: 5, width: 2.5, kind: 'brokenWindow', sill: 0.95, top: 2.3 },
          { at: 12, width: 3, kind: 'window', sill: 0.95, top: 2.3 },
        ],
        n: [{ at: 15.5, width: 1.2, kind: 'door', doorId: 'store_back' }],
        e: [{ at: 2.5, width: 2.0, kind: 'brokenWindow', sill: 1.0, top: 2.3 }],
      },
      interiorWalls: [
        { x0: 13, z0: -26, x1: 13, z1: -8, openings: [{ at: 11, width: 1.2, kind: 'door', doorId: 'store_staff' }] },
        { x0: 13, z0: -17, x1: 20, z1: -17, openings: [{ at: 2, width: 1.2, kind: 'door', doorId: 'office_door' }] },
        { x0: 0, z0: -21, x1: 5, z1: -21, openings: [{ at: 3, width: 1.2, kind: 'door', doorId: 'cooler_door' }] },
        { x0: 5, z0: -26, x1: 5, z1: -21 },
      ],
    },
    {
      id: GARAGE,
      name: 'Halvorsen Auto & Diesel',
      rect: { x0: 24, z0: -42, x1: 38, z1: -30 },
      height: 4.6,
      wallMaterial: 'corrugated',
      wallColor: 0x9aa6aa,
      trimColor: 0x3a3e42,
      interiorMaterial: 'corrugated',
      interiorColor: 0x8a8e88,
      floorMaterial: 'concrete',
      floorColor: 0x9a9890,
      floorSurface: 'concrete',
      roofMaterial: 'corrugated',
      roofColor: 0x6a6e70,
      openings: {
        w: [{ at: 3, width: 5.5, kind: 'gap', top: 2.3 }],
        s: [{ at: 9, width: 1.1, kind: 'door', doorId: 'garage_side' }],
        e: [{ at: 4, width: 2, kind: 'brokenWindow', sill: 1.0, top: 2.4 }],
        n: [{ at: 4, width: 3, kind: 'window', sill: 1.2, top: 2.4 }],
      },
    },
  ],
  doors: {
    store_front: { label: 'Front doors', lock: 'none', material: 'glass', color: 0xffffff, double: true },
    store_back: { label: 'Back door', lock: 'barred', material: 'paint', color: 0x5a6a5a, lockedText: 'Barred from the inside.' },
    store_staff: { label: 'Staff door', lock: 'none', material: 'wood', color: 0x8a6a4a },
    office_door: { label: 'Office door', lock: 'pry', material: 'paint', color: 0x6a6e72, lockedText: 'Locked. A crowbar could force it - loudly.' },
    cooler_door: { label: 'Walk-in cooler', lock: 'scripted', unlockFlag: 'cooler_unlocked', material: 'paint', color: 0xd8d8d0, lockedText: 'Something is wedged against it from inside.', talkNpc: 'ines' },
    garage_side: { label: 'Side door', lock: 'none', material: 'paint', color: 0x7a3a2a },
  },
  fences: [
    { kind: 'guardrail', x0: -41.5, z0: -74, x1: -41.5, z1: 74, gaps: [{ at: 40, width: 5 }, { at: 92, width: 6 }, { at: 125, width: 5 }] },
    { kind: 'chainlink', x0: -23, z0: -48, x1: 46, z1: -48, gaps: [{ at: 24, width: 3 }, { at: 60, width: 3.5 }] },
    { kind: 'chainlink', x0: 46, z0: -48, x1: 46, z1: 6 },
    { kind: 'wood', x0: -22, z0: 30, x1: 58, z1: 30, gaps: [{ at: 33, width: 3.5 }] },
  ],
  vehicles: [
    { id: 'v_wagon', type: 'wagon', x: -34.5, z: 55, rot: 0.2, color: 0x6a7a8a, doorsOpen: true, container: { id: 'c_wagon', tableId: 'vehicle_trunk', label: 'Search the station wagon', guaranteed: [{ itemId: 'water_bottle', quantity: 1 }] } },
    { id: 'v_trailer', type: 'semiTrailer', x: -33, z: 38.5, rot: Math.PI / 2, color: 0xd0d2cc, livery: 'BARROW COLD FREIGHT' },
    { id: 'v_cab', type: 'semiCab', x: -24.4, z: 36.0, rot: Math.PI / 2 + 0.5, color: 0x8a2a24, wrecked: true },
    { id: 'v_crash', type: 'sedan', x: -30.5, z: 42.8, rot: 2.9, color: 0x3a4a3a, wrecked: true, container: { id: 'c_crash_sedan', tableId: 'vehicle_glovebox', label: 'Search the crashed sedan' } },
    { id: 'v_alarm', type: 'sedan', x: -28.8, z: 22, rot: 0.12, color: 0x2e4f7a, alarmLight: true, container: { id: 'c_alarm_car', tableId: 'vehicle_glovebox', label: 'Search the blue sedan', alarm: true, setsFlag: 'car_alarm_triggered', guaranteed: [{ itemId: 'ammo_9mm', quantity: 8 }] } },
    { id: 'v_pickup', type: 'pickup', x: -35, z: 6, rot: -0.15, color: 0x7a5a3a, wrecked: true, container: { id: 'c_pickup_bed', tableId: 'vehicle_trunk', label: 'Search the truck bed', offset: { x: 0, z: 3.3 }, guaranteed: [{ itemId: 'glass_bottle', quantity: 1 }] } },
    { id: 'v_clinic', type: 'van', x: -29.5, z: -2, rot: 0.35, color: 0xe4e2dc, livery: 'CALDER VALLEY|RURAL CLINIC', doorsOpen: true, container: { id: 'c_clinic_van', tableId: 'medicine_cabinet', label: 'Search the clinic van', offset: { x: 0, z: 3.3 }, guaranteed: [{ itemId: 'bandage', quantity: 2 }] } },
    { id: 'v_lot', type: 'sedan', x: -16.5, z: 1.5, rot: 1.45, color: 0x8a8478, container: { id: 'c_lot_sedan', tableId: 'vehicle_trunk', label: 'Search the hatchback' } },
    { id: 'v_overturned', type: 'overturned', x: -33.5, z: -38, rot: 0.4, color: 0x5a2a2a },
    { id: 'v_north', type: 'sedan', x: -29, z: -55, rot: 3.0, color: 0x4a4a52, wrecked: true },
  ],
  props: [...storeProps, ...garageProps, ...outsideProps],
  pickups: [
    { id: 'pk_clinic_case', itemId: 'q_clinic_case', quantity: 1, x: 14.0, y: 0.77, z: -22.95, interior: STORE },
    { id: 'pk_fuel_can', itemId: 'q_fuel_can', quantity: 1, x: 24.85, y: 0, z: -41.0, interior: GARAGE },
    { id: 'pk_bottle_lot', itemId: 'glass_bottle', quantity: 1, x: -20.4, y: 0, z: -2.6 },
    { id: 'pk_battery_pump', itemId: 'battery', quantity: 1, x: -9.2, y: 0, z: -13.6 },
  ],
  notes: [
    {
      id: 'note_start', title: 'Receipt under a wiper', x: -34.8, y: 0.92, z: 53.4,
      body: 'Car alarms are a dinner bell. If you see the little red light blinking on a dash, walk away. Whatever is in that glovebox is not worth it.\n\n- M.',
    },
    {
      id: 'note_van', title: 'Clinic run log', x: -28.2, y: 0.03, z: 1.4,
      body: 'Supply run, day 3. The swarm caught us on Route 9. Danny took the supply case into the service stop office - steel door, real lock. Said he would wait it out.\n\nIf you find this: the antibiotics go to whoever needs them most.\n\n- Priya, Calder Valley Rural Clinic',
    },
    {
      id: 'note_office', title: "Owner's log", x: 14.05, y: 0.78, z: -21.95, interior: STORE,
      body: 'Day 9. Generator out back keeps the freezer and the lights going. Customers stopped coming. Something else started coming instead.\n\nThey come when it runs. I cannot turn it off. It is the only thing that still sounds like before.\n\n- G. Okafor',
    },
    {
      id: 'note_garage', title: 'Scrap of shop paper', x: 29.0, y: 0.94, z: -41.15, interior: GARAGE,
      body: 'Left the good diesel behind the drums. The old camper past the back fence is mine - there is a gap where the fence came down behind the garage.\n\nIf things go bad, that is where I will be.\n\n- Walt',
    },
    {
      id: 'note_trailer', title: "Walt's letter", x: 47.3, y: 0.47, z: -61.5,
      body: 'Whoever you are - there is a medkit in the footlocker. Take it.\n\nI am going to find my daughter in Ashby. Do not follow the noise. Walk when it is quiet. Run only when it is not.\n\n- Walt',
    },
  ],
  savePoints: [
    { id: 'save_office', label: "Okafor's office radio", x: 14.4, z: -18.1, interior: STORE },
    { id: 'save_camp', label: "Walt's camp", x: 45.6, z: -59.2, rot: 0.3 },
  ],
  zones: [
    { id: 'station_lot', label: 'Calder Junction', kind: 'trigger', rect: { x0: -24, z0: -47, x1: 44, z1: 5 } },
    { id: 'store_shop', label: 'Store', kind: 'trigger', rect: { x0: 0.3, z0: -25.7, x1: 12.9, z1: -8.3 } },
    { id: 'hidden_camp', label: "Walt's camp", kind: 'trigger', rect: { x0: 41, z0: -66, x1: 56, z1: -52 } },
    { id: 'extraction_zone', label: 'North overpass', kind: 'extraction', rect: { x0: -36, z0: -66, x1: -26, z1: -55 } },
    { id: 'highway_south', label: 'Route 9', kind: 'region', rect: { x0: -41.5, z0: 10, x1: -24, z1: 74 } },
  ],
  spawns: [
    ...commons([
      { id: 'road_1', x: -33, z: 46, wanderRadius: 5 },
      { id: 'road_2', x: -27, z: 27, rot: 2.5 },
      { id: 'road_3', x: -36, z: 14, wanderRadius: 6 },
      { id: 'canopy_1', x: -14, z: -9, rot: 1.2 },
      { id: 'canopy_2', x: -9.5, z: -1.5, dormant: true },
      { id: 'store_1', x: 8, z: -18.5, wanderRadius: 2.5 },
      { id: 'store_2', x: 16.5, z: -11, rot: 3.1 },
      { id: 'garage_1', x: 29, z: -33.5, dormant: true },
      { id: 'garage_2', x: 34.5, z: -38.5, rot: -1.2 },
      { id: 'field_1', x: 4, z: 20, wanderRadius: 8 },
      { id: 'field_2', x: 30, z: 26, rot: 1.0 },
      { id: 'north_1', x: -31, z: -47, dormant: true },
      { id: 'backlot_1', x: 12, z: -37, wanderRadius: 6 },
      { id: 'lot_1', x: -4, z: -32, patrol: [{ x: -4, z: -32 }, { x: 10, z: -42 }, { x: -10, z: -42 }] },
      { id: 'alarm_1', x: -50, z: 21, group: 'alarm_horde' },
      { id: 'alarm_2', x: -51, z: 24, group: 'alarm_horde' },
      { id: 'alarm_3', x: -49, z: 26.5, group: 'alarm_horde' },
      { id: 'alarm_4', x: -52, z: 18.5, group: 'alarm_horde' },
      { id: 'alarm_5', x: -48, z: 23, group: 'alarm_horde' },
      { id: 'siren_1', x: 8, z: -58, group: 'siren_horde' },
      { id: 'siren_2', x: 12, z: -61, group: 'siren_horde' },
      { id: 'siren_3', x: 17, z: -57, group: 'siren_horde' },
      { id: 'siren_4', x: 3, z: -62, group: 'siren_horde' },
      { id: 'night_1', x: -31, z: 10, wanderRadius: 10, night: true },
      { id: 'night_2', x: 20, z: 50, wanderRadius: 10, night: true },
    ]),
  ],
  npcs: [
    {
      id: 'ines', name: 'Ines Barrow', role: 'Stranded trucker', x: 2.4, z: -23.4, rot: Math.PI / 2,
      dialogueId: 'dlg_ines', outfit: { shirt: 0x7a3a34, pants: 0x3a4250, skin: 0x8a5e44, hair: 0x2a1a12 },
      initialState: 'hiding', limp: true, interior: STORE,
    },
  ],
  extraction: {
    x: -31, z: -60.5, radius: 4.5, label: "Teo's truck",
    vehicle: { id: 'v_teo', type: 'pickup', x: -31, z: -66, rot: Math.PI, color: 0x3a5a6a, headlights: true },
    driverNpc: {
      id: 'teo', name: 'Teo Brandt', role: 'Harrow Mill driver', x: -28.6, z: -62.2, rot: Math.PI,
      dialogueId: 'dlg_teo', outfit: { shirt: 0x4a5a3a, pants: 0x2e3036, skin: 0xc49a78, hair: 0x7a7a74 },
      initialState: 'waiting',
    },
  },
  lights: [
    { x: 6.5, y: 3.0, z: -16, color: 0xff6a4a, intensity: 1.4, distance: 13, flicker: true, interior: STORE },
    { x: 17, y: 2.7, z: -22, color: 0xffd6a0, intensity: 1.1, distance: 8, interior: STORE },
    { x: -14, y: 4.0, z: -9, color: 0xd8f0ff, intensity: 1.2, distance: 15, flicker: true },
    { x: 46, y: 0.9, z: -57.5, color: 0xff9a50, intensity: 1.3, distance: 8, flicker: true },
  ],
  decals: [
    { kind: 'graffiti', x: -0.03, y: 1.7, z: -23.4, rot: -Math.PI / 2, w: 3.6, h: 1.35, text: 'THEY HEAR YOU', color: '#b8261c' },
    { kind: 'graffiti', x: 28.5, y: 2.6, z: -29.96, rot: 0, w: 4, h: 1.5, text: "WALT'S - KEEP OUT", color: '#e8e0c8' },
    { kind: 'graffiti', x: -30.2, y: 1.5, z: 39.83, rot: 0, w: 2.2, h: 0.55, text: 'TURN BACK', color: '#e0e0d0' },
    { kind: 'sign', x: -0.05, y: 2.95, z: -16.3, rot: -Math.PI / 2, w: 4.6, h: 0.7, text: 'CALDER JUNCTION GOODS', background: '#9e2b22', color: '#f0e8d8' },
    { kind: 'sign', x: 13.09, y: 2.0, z: -22.6, rot: Math.PI / 2, w: 1.2, h: 0.6, text: 'ALARM|ARMED', background: '#2a2a2a', color: '#e04030', interior: STORE },
    { kind: 'sign', x: 3.6, y: 2.2, z: -20.9, rot: 0, w: 1.4, h: 0.45, text: 'WALK-IN COOLER', background: '#d8d8d0', color: '#2a4a6a', interior: STORE },
    { kind: 'sign', x: 15.6, y: 2.35, z: -16.9, rot: 0, w: 1.4, h: 0.45, text: 'OFFICE - STAFF ONLY', background: '#e0dcd0', color: '#2a2a2a', interior: STORE },
    { kind: 'blood', x: -28, y: 0.03, z: 1.2, rot: 0.5, w: 2.2, h: 2.2, flat: true },
    { kind: 'blood', x: 16.2, y: 0.04, z: -12.8, rot: 1.1, w: 1.8, h: 1.8, flat: true, interior: STORE },
    { kind: 'blood', x: 15.4, y: 0.04, z: -18.3, rot: 0.2, w: 1.4, h: 1.4, flat: true, interior: STORE },
    { kind: 'blood', x: -31.5, y: 0.03, z: 44.6, rot: 2.0, w: 2.0, h: 2.0, flat: true },
    { kind: 'oil', x: 30.5, y: 0.04, z: -36.5, rot: 0.3, w: 2.6, h: 2.6, flat: true, interior: GARAGE },
    { kind: 'oil', x: -13.8, y: 0.03, z: -9.2, rot: 1.0, w: 2.4, h: 2.4, flat: true },
  ],
  alarmSources: {
    office_panel: { x: 13.6, z: -22.6, kind: 'siren' },
  },
  forests: [
    { rect: { x0: -66, z0: -84, x1: -43, z1: 84 }, count: 190, pineRatio: 0.8 },
    { rect: { x0: -24, z0: -86, x1: 70, z1: -50.5 }, count: 230, pineRatio: 0.6, avoid: [{ x0: 40, z0: -67, x1: 57, z1: -51 }] },
    { rect: { x0: 48, z0: -50, x1: 72, z1: 84 }, count: 130, pineRatio: 0.5 },
    { rect: { x0: -22, z0: 69, x1: 48, z1: 86 }, count: 70, pineRatio: 0.5 },
    { rect: { x0: -20, z0: 10, x1: 44, z1: 66 }, count: 10, pineRatio: 0.2 },
  ],
  grass: [
    { rect: { x0: -22, z0: 40, x1: -4, z1: 62 }, density: 0.85, tall: true, zoneId: 'grass_south' },
    { rect: { x0: -6, z0: 12, x1: 16, z1: 28 }, density: 0.85, tall: true, zoneId: 'grass_middle' },
    { rect: { x0: 1, z0: -7.5, x1: 22, z1: 8 }, density: 0.85, tall: true, zoneId: 'grass_store' },
    { rect: { x0: 26, z0: 14, x1: 46, z1: 36 }, density: 0.85, tall: true, zoneId: 'grass_east' },
    { rect: { x0: -22, z0: -6, x1: 60, z1: 70 }, density: 0.06, tall: false },
    { rect: { x0: -43, z0: -74, x1: -41.8, z1: 74 }, density: 0.3, tall: false },
  ],
};
