import type { CSSProperties } from 'react';
import type { CharacterClass } from '@spf/shared';

// Blizzard class IDs, kept separate from the Forever planner's class catalog.
const classes: Record<number, { key: string; color: string; ink: string }> = {
  1: { key: 'warrior', color: '#c69b6d', ink: '#79502b' },
  2: { key: 'paladin', color: '#f48cba', ink: '#9d174d' },
  3: { key: 'hunter', color: '#aad372', ink: '#42631b' },
  4: { key: 'rogue', color: '#fff468', ink: '#806000' },
  5: { key: 'priest', color: '#ffffff', ink: '#4b5563' },
  6: { key: 'death_knight', color: '#c41e3a', ink: '#b01834' },
  7: { key: 'shaman', color: '#0070dd', ink: '#0060be' },
  8: { key: 'mage', color: '#3fc7eb', ink: '#006b86' },
  9: { key: 'warlock', color: '#8788ee', ink: '#5851b5' },
  10: { key: 'monk', color: '#00ff98', ink: '#007a48' },
  11: { key: 'druid', color: '#ff7c0a', ink: '#ac4d00' },
  12: { key: 'demon_hunter', color: '#a330c9', ink: '#9224b6' },
  13: { key: 'evoker', color: '#33937f', ink: '#19715f' },
};
export function characterNameStyle(classId?: number | null, cls?: CharacterClass): CSSProperties {
  const entry =
    classId != null ? classes[classId] : Object.values(classes).find((c) => c.key === cls);
  return entry
    ? ({ '--character-color': entry.color, '--character-ink': entry.ink } as CSSProperties)
    : {};
}
export default function CharacterName({
  name,
  classId,
  cls,
}: {
  name: string;
  classId?: number | null;
  cls?: CharacterClass;
}) {
  return (
    <span className="wow-character-name" style={characterNameStyle(classId, cls)}>
      {name}
    </span>
  );
}
