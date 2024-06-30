const classToBuffs = {
        death_knight: [ 'Battle Res' ],
        demon_hunter: [ 'Chaos Brand' ],
        druid: [ 'Mark of the Wild', 'Battle Res' ],
        evoker: [ 'Movement Speed' ],
        hunter: [],
        mage: [ 'Intellect' ],
        monk: [ 'Mystic Touch' ],
        paladin: [ 'Battle Res' ],
        priest: [ 'Stamina' ],
        rogue: [],
        shaman: [],
        warlock: [ 'Battle Res' ],
        warrior: [ 'Attack Power' ]
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
    