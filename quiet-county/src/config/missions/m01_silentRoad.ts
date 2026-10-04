import type { MissionDef } from '../../systems/MissionSystem';

/**
 * MISSION 01 - "THE SILENT ROAD"
 * Recover a clinic supply case from the Calder Junction service stop and get out.
 * Secondary: find fuel, help the stranded survivor, search the maintenance garage.
 * Optional: find Walt's hidden camp.
 */
export const M01_SILENT_ROAD: MissionDef = {
  id: 'm01_silent_road',
  number: 1,
  title: 'The Silent Road',
  region: 'Route 9 - Calder Valley',
  levelId: 'calder_junction',
  startHour: 17.4,
  briefing: {
    speaker: 'Noor Haddad, Harrow Mill medic',
    lines: [
      'Rowan. The Okonjo boy is burning up and I am out of antibiotics.',
      'A clinic van went missing on Route 9 three weeks ago. Teo found it this morning - abandoned at the Calder Junction service stop.',
      'The clinic always carried an orange supply case. If it is anywhere, it is in that station.',
      'Teo will drop you south of the junction and wait at the north overpass. Bring fuel if you find any - the mill generator is nearly dry.',
      'And Rowan... it is quiet out there. Keep it that way.',
    ],
  },
  debriefing: 'The case is sealed and intact. Noor gets to work before the truck has even stopped.',
  objectives: [
    {
      id: 'reach_station',
      text: 'Reach the Calder Junction service stop',
      kind: 'primary',
      completeWhen: { type: 'inZone', zoneId: 'station_lot' },
      marker: { x: -6, z: -14 },
      onComplete: [{ type: 'autosave' }],
    },
    {
      id: 'find_supplies',
      text: 'Recover the clinic supply case',
      kind: 'primary',
      revealWhen: { type: 'any', of: [{ type: 'objective', objectiveId: 'reach_station' }, { type: 'flag', flag: 'note:note_van' }] },
      completeWhen: { type: 'hasItem', itemId: 'q_clinic_case' },
      marker: { x: 14.6, z: -22.6 },
    },
    {
      id: 'find_fuel',
      text: 'Find fuel for the mill generator',
      kind: 'secondary',
      completeWhen: { type: 'hasItem', itemId: 'q_fuel_can' },
      marker: { x: 31, z: -36 },
      reward: [{ id: 'fuel', label: 'Diesel for the mill generator', amount: 5 }],
    },
    {
      id: 'search_garage',
      text: 'Search the maintenance garage',
      kind: 'secondary',
      completeWhen: { type: 'flag', flag: 'garage_locker_searched' },
      marker: { x: 36.5, z: -33.5 },
      reward: [{ id: 'parts', label: 'Garage tools and parts', amount: 2 }],
    },
    {
      id: 'rescue_survivor',
      text: 'Help the survivor hiding in the cooler',
      kind: 'secondary',
      revealWhen: { type: 'flag', flag: 'heard_survivor' },
      completeWhen: { type: 'flag', flag: 'ines_rescued' },
      marker: { x: 2.5, z: -22 },
      reward: [{ id: 'survivors', label: 'Ines Barrow joins Harrow Mill', amount: 1 }],
    },
    {
      id: 'hidden_camp',
      text: "Search Walt's hidden camp",
      kind: 'optional',
      revealWhen: { type: 'any', of: [{ type: 'flag', flag: 'note:note_garage' }, { type: 'inZone', zoneId: 'hidden_camp' }] },
      completeWhen: { type: 'flag', flag: 'trailer_stash_searched' },
      marker: { x: 48, z: -60 },
      reward: [{ id: 'medicine', label: "Walt's medkit", amount: 2 }],
    },
    {
      id: 'extract',
      text: "Meet Teo at the north overpass",
      kind: 'extraction',
      revealWhen: { type: 'objective', objectiveId: 'find_supplies' },
      completeWhen: { type: 'flag', flag: 'extracted' },
      marker: { x: -31, z: -60.5 },
    },
  ],
  events: [
    {
      id: 'intro_radio',
      when: { type: 'true' },
      actions: [
        { type: 'radio', speaker: 'Teo', text: 'Rig jackknifed across the road ahead. I am going round to the north overpass. Get the case, Rowan - and keep it quiet.' },
      ],
    },
    {
      id: 'car_alarm',
      when: { type: 'flag', flag: 'car_alarm_triggered' },
      actions: [
        { type: 'spawnGroup', groupId: 'alarm_horde' },
        { type: 'radio', speaker: 'Teo', text: 'Was that a car alarm? Every Hollow for a mile heard it. Get off the road!' },
      ],
    },
    {
      id: 'heard_survivor',
      when: { type: 'inZone', zoneId: 'store_shop' },
      actions: [
        { type: 'message', text: '"Hello? Is someone out there? ...Please. I am in the cooler."', kind: 'info', duration: 6 },
        { type: 'setFlag', flag: 'heard_survivor' },
      ],
    },
    {
      id: 'office_siren',
      when: { type: 'hasItem', itemId: 'q_clinic_case' },
      actions: [
        { type: 'alarm', sourceId: 'office_panel', seconds: 14 },
        { type: 'spawnGroup', groupId: 'siren_horde' },
        { type: 'radio', speaker: 'Teo', text: 'I can hear that siren from here. They are coming out of the woods - get to the overpass, now!' },
        { type: 'autosave' },
      ],
    },
    {
      id: 'night_warning',
      when: { type: 'flag', flag: 'phase:night' },
      actions: [
        { type: 'message', text: 'Night has fallen. Your flashlight helps you see - and helps them see you.', kind: 'warning', duration: 6 },
      ],
    },
  ],
  rewards: [
    { id: 'medicine', label: 'Clinic antibiotics and supplies', amount: 10 },
    { id: 'xp', label: 'Mission complete', amount: 250 },
  ],
};
