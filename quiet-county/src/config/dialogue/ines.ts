import type { DialogueDef } from '../../systems/DialogueSystem';

/** Ines Barrow - refrigerated-rig driver, hiding in the store's walk-in cooler. */
export const DLG_INES: DialogueDef = {
  id: 'dlg_ines',
  npcId: 'ines',
  entries: [
    { condition: { type: 'npcState', npcId: 'ines', state: 'following' }, node: 'following' },
    { condition: { type: 'npcState', npcId: 'ines', state: 'waiting' }, node: 'waiting' },
    { condition: { type: 'flag', flag: 'cooler_unlocked' }, node: 'hub' },
    { node: 'through_door' },
  ],
  nodes: {
    through_door: {
      speaker: 'Voice behind the door',
      text: 'Stay back! I have a - I have a knife. Are you bitten? Tell me the truth.',
      choices: [
        { text: 'Not bitten. My name is Rowan. I am from Harrow Mill.', next: 'door_trust' },
        { text: 'Keep your voice down. They hear everything.', next: 'door_quiet', once: true },
        { text: '[Leave]', next: null },
      ],
    },
    door_quiet: {
      speaker: 'Voice behind the door',
      text: '...Right. Sorry. Two days in the dark with the dripping. You start talking to the shelves. Who are you?',
      next: 'through_door',
    },
    door_trust: {
      speaker: 'Voice behind the door',
      text: 'Harrow Mill... the old grain mill off Route 9? I heard your radio once, late at night. Okay. Okay. Moving the crates.',
      actions: [{ type: 'setFlag', flag: 'cooler_unlocked' }, { type: 'setFlag', flag: 'met_ines' }, { type: 'relationship', npcId: 'ines', delta: 10 }],
      next: 'introduce',
    },
    introduce: {
      speaker: 'Ines Barrow',
      text: 'Ines Barrow. I drive - drove - the reefer rig jackknifed out on the highway. That one is mine. My leg got torn open in the crash.',
      next: 'hub',
    },
    hub: {
      speaker: 'Ines Barrow',
      text: 'So. What now?',
      choices: [
        { text: '[Use bandage] Let me look at that leg.', next: 'treated', condition: { type: 'hasItem', itemId: 'bandage' }, actions: [{ type: 'takeItem', itemId: 'bandage', quantity: 1 }, { type: 'npc', npcId: 'ines', command: 'treated' }, { type: 'relationship', npcId: 'ines', delta: 25 }] },
        { text: '[Use medkit] Hold still. This will sting.', next: 'treated', condition: { type: 'all', of: [{ type: 'hasItem', itemId: 'medkit' }, { type: 'not', of: { type: 'hasItem', itemId: 'bandage' } }] }, actions: [{ type: 'takeItem', itemId: 'medkit', quantity: 1 }, { type: 'npc', npcId: 'ines', command: 'treated' }, { type: 'relationship', npcId: 'ines', delta: 30 }] },
        { text: 'Can you walk?', next: 'can_walk', once: true },
        { text: 'What happened here?', next: 'what_happened', once: true },
        { text: 'Is there anything in the office?', next: 'office', once: true },
        { text: 'Stay here. I will come back for you.', next: null },
      ],
    },
    can_walk: {
      speaker: 'Ines Barrow',
      text: 'Not far. Not fast. Get me something to wrap this with - a bandage, anything clean - and I can keep up.',
      next: 'hub',
    },
    what_happened: {
      speaker: 'Ines Barrow',
      text: 'Mr. Okafor ran his generator out back every night to keep the lights on. The noise pulled them in from the fields, a few more every night. A clinic van came through. One of them locked something in the office. Then the screaming started.',
      next: 'hub',
    },
    office: {
      speaker: 'Ines Barrow',
      text: 'Steel door, and Okafor wired some kind of battery alarm to the panel in there. If you go in, be ready to leave fast. There is a broken window on the east side, too, if you do not mind the back lot.',
      actions: [{ type: 'setFlag', flag: 'ines_office_tip' }],
      next: 'hub',
    },
    treated: {
      speaker: 'Ines Barrow',
      text: 'That is... better. Thank you. I mean it. Lead the way - I will stay close and keep quiet.',
      actions: [{ type: 'npc', npcId: 'ines', command: 'follow' }],
      next: null,
    },
    following: {
      speaker: 'Ines Barrow',
      text: 'Right behind you.',
      choices: [
        { text: 'Wait here for me.', next: null, actions: [{ type: 'npc', npcId: 'ines', command: 'stay' }] },
        { text: 'Keep moving.', next: null },
      ],
    },
    waiting: {
      speaker: 'Ines Barrow',
      text: 'Ready to move?',
      choices: [
        { text: 'Follow me.', next: null, actions: [{ type: 'npc', npcId: 'ines', command: 'follow' }] },
        { text: 'Not yet. Stay put.', next: null },
      ],
    },
  },
};

/** Teo Brandt - Harrow Mill driver waiting at the extraction truck. */
export const DLG_TEO: DialogueDef = {
  id: 'dlg_teo',
  npcId: 'teo',
  entries: [
    { condition: { type: 'objective', objectiveId: 'find_supplies' }, node: 'ready' },
    { node: 'not_yet' },
  ],
  nodes: {
    not_yet: {
      speaker: 'Teo Brandt',
      text: 'No case, no ride, Rowan. Noor will have my head. The station is south of here, past the barriers.',
      next: null,
    },
    ready: {
      speaker: 'Teo Brandt',
      text: 'You got it? Good. Get in whenever you are ready - and do not slam the door.',
      next: null,
    },
  },
};
