import { useState, type FormEvent } from 'react';
import {
  buffs,
  categoryOf,
  petsFor,
  abilityCategories,
  type AbilityCategory,
  classes,
  classRoles,
  characterSchema,
  planSchema,
  raidSizes,
  specs,
  specFor,
  label,
  type Character,
  type CharacterClass,
  type CharacterInput,
  type Plan,
  type PlanInput,
} from '@spf/shared';
import { Field, ErrorBox } from './ui';
import { errorMessage, useCommandMutation } from './api';
export function presetCharacter(cls: CharacterClass, specId: string, name: string): CharacterInput {
  const spec = specFor(cls, specId) || specs[cls][0];
  return { name, class: cls, spec: spec.id, role: spec.role, buffs: [...spec.buffs] };
}
export function CharacterForm({
  guildId,
  initial,
  onDone,
}: {
  guildId: string;
  initial: Character;
  onDone: () => void;
}) {
  const [value, set] = useState<CharacterInput>({
    name: initial.name,
    class: initial.class,
    spec: initial.spec,
    role: initial.role,
    buffs: initial.buffs,
  });
  const [command, state] = useCommandMutation();
  const [error, setError] = useState('');
  const [loadoutTab, setLoadoutTab] = useState<AbilityCategory>('buff');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = characterSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await command({
        guildId,
        path: 'characters/' + initial.id,
        method: 'PUT',
        body: { character: parsed.data, revision: initial.revision },
      }).unwrap();
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function toggle(id: string, checked: boolean) {
    const chosen = buffs.find((b) => b.id === id)!;
    set((v) => ({
      ...v,
      buffs: checked
        ? [
            ...v.buffs.filter((existing) => {
              const b = buffs.find((b) => b.id === existing);
              return (
                existing !== id &&
                (!chosen.slot || b?.slot !== chosen.slot) &&
                !chosen.conflictsWith?.includes(existing)
              );
            }),
            id,
          ]
        : v.buffs.filter((b) => b !== id),
    }));
  }
  return (
    <form onSubmit={submit}>
      <Field label="Character name">
        <input
          required
          maxLength={60}
          value={value.name}
          onChange={(e) => set({ ...value, name: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field label="Class">
          <select
            value={value.class}
            onChange={(e) => {
              const cls = e.target.value as CharacterClass;
              set(presetCharacter(cls, specs[cls][0].id, value.name));
            }}
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Spec">
          <select
            value={value.spec}
            onChange={(e) =>
              set(
                e.target.value === 'custom'
                  ? { ...value, spec: 'custom' }
                  : presetCharacter(value.class, e.target.value, value.name),
              )
            }
          >
            <option value="custom">Custom</option>
            {specs[value.class].map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select
            value={value.role}
            onChange={(e) => set({ ...value, role: e.target.value as CharacterInput['role'] })}
          >
            {classRoles[value.class].map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {petsFor(value.class).length > 0 && (
        <Field label="Pet support">
          <select
            value={buffs.find((b) => value.buffs.includes(b.id) && b.pet)?.pet || 'none'}
            onChange={(e) =>
              set({
                ...value,
                buffs: [
                  ...value.buffs.filter((id) => !buffs.find((b) => b.id === id)?.pet),
                  ...buffs
                    .filter((b) => b.class === value.class && b.pet === e.target.value)
                    .map((b) => b.id),
                ],
              })
            }
          >
            <option value="none">None / other pet</option>
            {petsFor(value.class).map((pet) => (
              <option key={pet} value={pet}>
                {label(pet)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="coverage-tabs" role="group" aria-label="Character abilities">
        {abilityCategories.map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={tab === loadoutTab}
            onClick={() => setLoadoutTab(tab)}
          >
            {tab === 'utility' ? 'Utility' : label(tab) + 's'}
          </button>
        ))}
      </div>

      <div className="buff-options">
        {buffs
          .filter(
            (b) =>
              b.class === value.class &&
              categoryOf(b) === loadoutTab &&
              (!b.pet ||
                value.buffs.some((id) => buffs.find((other) => other.id === id)?.pet === b.pet)),
          )
          .map((b) => (
            <label className="buff-option" key={b.id}>
              <input
                type="checkbox"
                checked={value.buffs.includes(b.id)}
                onChange={(e) => toggle(b.id, e.target.checked)}
              />
              <span>
                <strong>{b.name}</strong>
                <small>
                  {label(b.scope)}
                  {b.pet ? ' / ' + label(b.pet) : ''}
                  {b.slot ? ' / ' + label(b.slot) : ''}
                  {b.talent ? ' / Talent' : ''}
                </small>
              </span>
            </label>
          ))}
      </div>
      {!buffs.some((b) => b.class === value.class && categoryOf(b) === loadoutTab) && (
        <p className="muted small-copy">No abilities in this category.</p>
      )}
      <p className="muted small-copy">Shared across raids. Changing spec resets the buff preset.</p>
      {error && <ErrorBox message={error} />}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onDone}>
          Cancel
        </button>
        <button className="button primary" disabled={state.isLoading}>
          Save character
        </button>
      </div>
    </form>
  );
}
export function PlanForm({
  guildId,
  initial,
  onDone,
}: {
  guildId: string;
  initial?: Plan;
  onDone: (id?: string) => void;
}) {
  const [value, set] = useState<PlanInput>(
    initial
      ? { name: initial.name, capacity: initial.capacity, notes: initial.notes }
      : { name: '', capacity: 40, notes: '' },
  );
  const [command, state] = useCommandMutation();
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = planSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      const result = await command({
        guildId,
        path: initial ? 'plans/' + initial.id : 'plans',
        method: initial ? 'PUT' : 'POST',
        body: initial ? { plan: parsed.data, revision: initial.revision } : parsed.data,
      }).unwrap();
      onDone(result.id || initial?.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Composition name">
        <input
          required
          autoFocus
          maxLength={80}
          placeholder="e.g. Progression"
          value={value.name}
          onChange={(e) => set({ ...value, name: e.target.value })}
        />
      </Field>
      <Field label="Raid size">
        <select
          value={value.capacity}
          onChange={(e) => set({ ...value, capacity: Number(e.target.value) })}
        >
          {raidSizes.map((n) => (
            <option key={n} value={n}>
              {n}-man
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea
          maxLength={2000}
          value={value.notes}
          onChange={(e) => set({ ...value, notes: e.target.value })}
        />
      </Field>
      {error && <ErrorBox message={error} />}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={() => onDone()}>
          Cancel
        </button>
        <button className="button primary" disabled={state.isLoading}>
          {initial ? 'Save composition' : 'Create composition'}
        </button>
      </div>
    </form>
  );
}
