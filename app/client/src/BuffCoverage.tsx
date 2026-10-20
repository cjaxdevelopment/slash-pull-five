import { useState } from 'react';
import { Check, Minus, AlertTriangle } from 'lucide-react';
import {
  catalog,
  label,
  abilityCategories,
  excludedRaidEffects,
  type AbilityCategory,
  type composition,
} from '@spf/shared';
import { Modal, classStyle } from './ui';
type Coverage = ReturnType<typeof composition>;
export default function BuffCoverage({
  data,
  onEdit,
}: {
  data: Coverage;
  onEdit?: (id: string) => void;
}) {
  const [filter, setFilter] = useState('all'),
    [table, setTable] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const [category, setCategory] = useState<AbilityCategory>('buff');
  const categoryRows = data.rows.filter((r) => r.category === category);
  const rows = categoryRows.filter(
    (r) =>
      filter === 'all' || (filter === 'provided' ? r.providers.length > 0 : r.status !== 'covered'),
  );
  const active = data.rows.find((r) => r.key === selected);
  const covered = categoryRows.filter((r) => r.status === 'covered').length;
  function edit(id: string) {
    setSelected(null);
    onEdit?.(id);
  }
  function status(row: Coverage['rows'][number]) {
    return row.status === 'covered' ? (
      <Check size={13} />
    ) : row.status === 'partial' || row.status === 'conflict' ? (
      <AlertTriangle size={13} />
    ) : (
      <Minus size={13} />
    );
  }
  return (
    <section className="buff-coverage" aria-label="Buff coverage">
      <div className="buff-heading">
        <div className="coverage-tabs" role="group" aria-label="Coverage categories">
          {abilityCategories.map((tab) => (
            <button key={tab} aria-pressed={tab === category} onClick={() => setCategory(tab)}>
              {tab === 'utility' ? 'Utility' : label(tab) + 's'}
            </button>
          ))}
          <span className="coverage-total">
            {covered}/{categoryRows.length}
          </span>
        </div>
        <div className="buff-controls">
          <select
            aria-label="Filter buff coverage"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="provided">Active</option>
            <option value="missing">Missing / partial</option>
          </select>
          <button className="text-link" aria-pressed={table} onClick={() => setTable(!table)}>
            {table ? 'Compact' : 'Table'}
          </button>
        </div>
      </div>
      {data.conflicts.length > 0 && (
        <div className="error" role="alert">
          Windfury / Flametongue conflict.{' '}
          <button className="text-link" onClick={() => setSelected(data.conflicts[0].key)}>
            Review
          </button>
        </div>
      )}
      {table ? (
        <div className="buff-table-scroll panel">
          <table className="buff-table">
            <thead>
              <tr>
                <th>Buff</th>
                <th>{category === 'buff' ? 'Coverage' : 'Available'}</th>
                {data.rows[0]?.groups.map((g) => (
                  <th key={g.group}>G{g.group}</th>
                ))}
                <th>Characters</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} data-testid="buff-row" data-status={row.status}>
                  <th scope="row">
                    <button className="buff-name" onClick={() => setSelected(row.key)}>
                      {row.effect}
                    </button>
                  </th>
                  <td>
                    <span className={'coverage-status ' + row.status}>
                      {status(row)}
                      {row.availabilityOnly && row.status === 'covered'
                        ? 'Available'
                        : label(row.status)}
                    </span>
                  </td>
                  {row.groups.map((g) => (
                    <td
                      key={g.group}
                      className={
                        'group-coverage ' +
                        (row.availabilityOnly
                          ? g.providers
                            ? 'complete'
                            : ''
                          : g.total && g.covered === g.total
                            ? 'complete'
                            : g.covered
                              ? 'partial'
                              : '')
                      }
                    >
                      {row.availabilityOnly
                        ? g.providers
                        : g.total
                          ? g.covered + '/' + g.total
                          : '\u2014'}
                    </td>
                  ))}
                  <td className="buff-providers">
                    {row.providers.map((p) => (
                      <button
                        className="provider-link class-name"
                        style={classStyle(p.class)}
                        disabled={!onEdit}
                        key={p.characterId + p.buff.id}
                        onClick={() => edit(p.characterId)}
                      >
                        {p.name}
                        {p.buff.scope === 'party' ? ' (G' + (p.group ?? '?') + ')' : ''}
                      </button>
                    ))}
                    {!row.providers.length && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="buff-grid">
          {rows.map((row, i) => (
            <div
              className={'buff-chip ' + row.status}
              key={row.key}
              data-testid="buff-row"
              data-status={row.status}
            >
              <button
                aria-label={row.effect}
                aria-describedby={'buff-status-' + i}
                onClick={() => setSelected(row.key)}
              >
                {status(row)}
                <span>{row.effect}</span>
                {(row.status === 'partial' || (row.availabilityOnly && row.providerCount > 0)) && (
                  <small>
                    {row.availabilityOnly ? row.providerCount : row.recipients.length}
                    {!row.availabilityOnly && '/' + data.total}
                  </small>
                )}
              </button>
              <span className="sr-only" id={'buff-status-' + i}>
                {label(row.status)}
              </span>
            </div>
          ))}
        </div>
      )}
      {!rows.length && <p className="pool-empty">Nothing in this view.</p>}
      <details className="coverage-notes">
        <summary>Rules &amp; sources</summary>
        <p>
          Level 60, learned talents, maintained buffs, and characters in range. Party buffs cover
          the provider's group; raid buffs cover the active lineup. Bench characters are excluded.
          Debuffs and Utility count available characters, not combat uptime or a simultaneous
          cooldown rotation. Exact values are not simulated.
        </p>
        <p>
          One totem per element, one Paladin aura and one blanket blessing per Paladin. Individual
          blessing targets can differ in game. Missing buffs are not requirements.
        </p>
        <details>
          <summary>Forever differences</summary>
          {excludedRaidEffects.map((e) => (
            <p key={e.name}>
              <a className="text-link" href={e.source} target="_blank" rel="noreferrer">
                {e.name}
              </a>
              : {e.reason}
            </p>
          ))}
        </details>
        <p>Reviewed {catalog.reviewedAt}.</p>
        <ul>
          {catalog.sources.map((s) => (
            <li key={s.url}>
              <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </details>
      {active && (
        <Modal title={active.effect} onClose={() => setSelected(null)}>
          <div className={'buff-detail-status coverage-status ' + active.status}>
            {status(active)}
            {active.availabilityOnly && active.status === 'covered'
              ? 'Available: ' + active.providerCount
              : label(active.status)}
          </div>
          <div className="buff-detail-groups">
            {active.groups.map((g) => (
              <span key={g.group}>
                G{g.group}
                <strong>{active.availabilityOnly ? g.providers : g.covered + '/' + g.total}</strong>
              </span>
            ))}
          </div>
          {active.definitions.map((b) => (
            <div className="buff-definition" key={b.id}>
              <h3>
                {b.name}
                <small>
                  {label(b.scope)}
                  {b.talent ? ' / Talent' : ''}
                  {b.pet ? ' / ' + label(b.pet) : ''}
                </small>
              </h3>
              {b.note && <p className="muted small-copy">{b.note}</p>}
              <div className="buff-detail-providers">
                {active.providers
                  .filter((p) => p.buff.id === b.id)
                  .map((p) => (
                    <button
                      className="text-link class-name"
                      style={classStyle(p.class)}
                      disabled={!onEdit}
                      key={p.characterId}
                      onClick={() => edit(p.characterId)}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
              <a className="text-link small-copy" href={b.source} target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          ))}
        </Modal>
      )}
    </section>
  );
}

export function GroupBuffs({ data, group }: { data: Coverage; group: number }) {
  const rows = data.rows.filter(
    (r) =>
      r.category === 'buff' &&
      r.providers.some((p) => p.group === group && p.buff.scope === 'party'),
  );
  const short: Record<string, string> = {
    'Mana regeneration': 'Mana',
    'Armor aura': 'Armor',
    'Stamina (Imp)': 'Imp',
    'Spell pushback protection': 'Focus',
    'Periodic healing': 'Heal',
    'Physical damage reduction': 'Guard',
    'Damage reflection': 'Reflect',
  };
  return rows.length ? (
    <div className="group-support" aria-label={'Party buffs in Group ' + group}>
      {rows.map((r) => (
        <span key={r.key} aria-label={r.effect}>
          {short[r.effect] || r.effect}
        </span>
      ))}
    </div>
  ) : null;
}
