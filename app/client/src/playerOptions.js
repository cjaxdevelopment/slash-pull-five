  export const classOptions = [
    { name: 'Death Knight', value: 'death_knight' },
    { name: 'Demon Hunter', value: 'demon_hunter' },
    { name: 'Druid', value: 'druid' },
    { name: 'Evoker', value: 'evoker' },
    { name: 'Hunter', value: 'hunter' },
    { name: 'Mage', value: 'mage' },
    { name: 'Monk', value: 'monk' },
    { name: 'Paladin', value: 'paladin' },
    { name: 'Priest', value: 'priest' },
    { name: 'Rogue', value: 'rogue' },
    { name: 'Shaman', value: 'shaman' },
    { name: 'Warlock', value: 'warlock' },
    { name: 'Warrior', value: 'warrior' }
  ];

  export const classRoleOptions = {
    death_knight: ['tank', 'dps'],
    demon_hunter: ['tank', 'dps'],
    druid: ['tank', 'healer', 'dps'],
    evoker: [ 'healer', 'dps' ],
    hunter: ['dps'],
    mage: ['dps'],
    monk: ['tank', 'healer', 'dps'],
    paladin: ['tank', 'healer', 'dps'],
    priest: ['healer', 'dps'],
    rogue: ['dps'],
    shaman: ['healer', 'dps'],
    warlock: ['dps'],
    warrior: ['tank', 'dps']
  };
  
  export const specOptions = {
    death_knight: [
      { name: 'Blood', value: 'blood' },
      { name: 'Frost', value: 'frost' },
      { name: 'Unholy', value: 'unholy' }
    ],
    demon_hunter: [
      { name: 'Havoc', value: 'havoc' },
      { name: 'Vengeance', value: 'vengeance' }
    ],
    druid: [
      { name: 'Balance', value: 'balance' },
      { name: 'Feral', value: 'feral' },
      { name: 'Guardian', value: 'guardian' },
      { name: 'Restoration', value: 'restoration' }
    ],
    evoker: [
      { name: 'Devastation', value: 'devastation' },
      { name: 'Augmentation', value: 'augmentation' },
      { name: 'Preservation', value: 'preservation' },
    ],
    hunter: [
      { name: 'Beast Mastery', value: 'beast_mastery' },
      { name: 'Marksmanship', value: 'marksmanship' },
      { name: 'Survival', value: 'survival' }
    ],
    mage: [
      { name: 'Arcane', value: 'arcane' },
      { name: 'Fire', value: 'fire' },
      { name: 'Frost', value: 'frost' }
    ],
    monk: [
      { name: 'Brewmaster', value: 'brewmaster' },
      { name: 'Mistweaver', value: 'mistweaver' },
      { name: 'Windwalker', value: 'windwalker' }
    ],
    paladin: [
      { name: 'Holy', value: 'holy' },
      { name: 'Protection', value: 'protection' },
      { name: 'Retribution', value: 'retribution' }
    ],
    priest: [
      { name: 'Discipline', value: 'discipline' },
      { name: 'Holy', value: 'holy' },
      { name: 'Shadow', value: 'shadow' }
    ],
    rogue: [
      { name: 'Assassination', value: 'assassination' },
      { name: 'Outlaw', value: 'outlaw' },
      { name: 'Subtlety', value: 'subtlety' }
    ],
    shaman: [
      { name: 'Elemental', value: 'elemental' },
      { name: 'Enhancement', value: 'enhancement' },
      { name: 'Restoration', value: 'restoration' }
    ],
    warlock: [
      { name: 'Affliction', value: 'affliction' },
      { name: 'Demonology', value: 'demonology' },
      { name: 'Destruction', value: 'destruction' }
    ],
    warrior: [
      { name: 'Arms', value: 'arms' },
      { name: 'Fury', value: 'fury' },
      { name: 'Protection', value: 'protection' }
    ]
  };
  