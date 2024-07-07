const classToBuffs = {
        death_knight: [ 'Battle Res', 'Immunities' ],
        demon_hunter: [ 'Chaos Brand', 'Darkness', 'Immunities' ],
        druid: [ 'Mark of the Wild', 'Battle Res', 'Raid Burst Move Speed' ],
        evoker: [ 'Movement Speed', 'Bloodlust', 'Raid Burst Move Speed' ],
        hunter: [ 'Bloodlust', 'Immunities' ],
        mage: [ 'Intellect', 'Bloodlust', 'Immunities' ],
        monk: [ 'Mystic Touch' ],
        paladin: [ 'Battle Res', 'Devo Aura', 'Blessing of Protection', 'Immunities' ],
        priest: [ 'Stamina', 'Mass Dispel' ],
        rogue: [ 'Boss DR', 'Immunities' ],
        shaman: [ 'Bloodlust', 'Raid Burst Move Speed', 'Skyfury Totem' ],
        warlock: [ 'Battle Res', 'Healthstone' ],
        warrior: [ 'Attack Power', 'Rallying Cry' ]
    };
    
    const allBuffs = [
    'Attack Power',
    'Intellect',
    'Stamina',
    'Movement Speed',
    'Mark of the Wild',
    'Mystic Touch',
    'Chaos Brand',
    'Battle Res',
    'Devo Aura',
    'Bloodlust',
    'Raid Burst Move Speed',
    'Skyfury Totem',
    'Healthstone',
    'Blessing of Protection',
    'Boss DR',
    'Rallying Cry',
    'Immunities',
    ];

    const calculateBuffs = (players) => {
    const coveredBuffs = new Set();
    players.forEach(player => {
        const buffs = classToBuffs[player.class];
        if (buffs) {
        buffs.forEach(buff => coveredBuffs.add(buff));
        }
    });
    const missingBuffs = allBuffs.filter(buff => !coveredBuffs.has(buff));
    return { coveredBuffs: coveredBuffs.size, missingBuffs };
    };

    module.exports = { calculateBuffs, allBuffs };
    