import { buffs, categoryOf } from './buffs.js';
import { roles, type Character, type Plan, type Role } from './index.js';
export function composition(plan: Pick<Plan, 'assignments' | 'capacity'>, characters: Character[]) {
  const selected = plan.assignments
    .filter((a) => a.status === 'lineup')
    .flatMap((a) => {
      const c = characters.find((c) => c.id === a.characterId);
      return c && !c.archived ? [{ ...c, group: a.group }] : [];
    });
  const counts = Object.fromEntries(
    roles.map((role) => [role, selected.filter((c) => c.role === role).length]),
  ) as Record<Role, number>;
  const effects = [...new Set(buffs.map((b) => categoryOf(b) + ':' + b.effect))];
  const rows = effects.map((key) => {
    const definitions = buffs.filter((b) => categoryOf(b) + ':' + b.effect === key),
      effect = definitions[0].effect,
      category = categoryOf(definitions[0]);
    const providers = selected.flatMap((c) =>
      definitions
        .filter((b) => c.buffs.includes(b.id))
        .map((b) => ({ characterId: c.id, name: c.name, class: c.class, group: c.group, buff: b })),
    );
    const conflicting = providers.some((p) =>
      p.buff.conflictsWith?.some((id) => selected.some((c) => c.buffs.includes(id))),
    );
    const availabilityOnly = category !== 'buff';
    const recipients =
      conflicting || availabilityOnly
        ? []
        : selected.filter((c) =>
            providers.some(
              (p) => p.buff.scope !== 'party' || (p.group !== null && p.group === c.group),
            ),
          );
    const providerCount = new Set(providers.map((p) => p.characterId)).size;
    const groups = Array.from({ length: Math.ceil(plan.capacity / 5) }, (_, i) => i + 1).map(
      (group) => ({
        group,
        covered: recipients.filter((c) => c.group === group).length,
        total: selected.filter((c) => c.group === group).length,
        providers: new Set(providers.filter((p) => p.group === group).map((p) => p.characterId))
          .size,
      }),
    );
    const status: 'missing' | 'partial' | 'covered' | 'conflict' = conflicting
      ? 'conflict'
      : availabilityOnly
        ? providerCount
          ? 'covered'
          : 'missing'
        : !recipients.length
          ? 'missing'
          : recipients.length === selected.length
            ? 'covered'
            : 'partial';
    return {
      key,
      effect,
      category,
      definitions,
      providers,
      providerCount,
      availabilityOnly,
      recipients: recipients.map((c) => c.id),
      groups,
      status,
    };
  });
  return {
    counts,
    total: selected.length,
    rows,
    conflicts: rows.filter((r) => r.status === 'conflict'),
    ungrouped: selected.filter((c) => c.group === null).length,
  };
}
