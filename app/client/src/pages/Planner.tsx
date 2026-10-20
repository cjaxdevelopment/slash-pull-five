import { useState, type FormEvent, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Copy, Pencil, Trash2, X, MoreHorizontal, Link2, Download } from 'lucide-react';
import {
  classes,
  composition,
  label,
  roles,
  specs,
  specFor,
  type Character,
  type CharacterClass,
  type Assignment,
  type Snapshot,
} from '@spf/shared';
import { errorMessage, useCommandMutation } from '../api';
import { CharacterForm, PlanForm, presetCharacter } from '../forms';
import { Empty, ErrorBox, Field, Modal, RoleIcon, CharacterIdentity, classStyle } from '../ui';
import BuffCoverage, { GroupBuffs } from '../BuffCoverage';
import { raidShareLink } from '../sharing';

export default function Planner({ data }: { data: Snapshot }) {
  const { id } = useParams(),
    navigate = useNavigate();
  const plan = id ? data.plans.find((p) => p.id === id) : data.plans[0];
  const [modal, setModal] = useState<'new' | 'edit' | 'delete' | 'share' | null>(null);
  const [editing, setEditing] = useState<Character>();
  const [deleting, setDeleting] = useState<Character>();
  const [deleteError, setDeleteError] = useState('');
  const [playerClass, setClass] = useState<CharacterClass>('warrior'),
    [specId, setSpec] = useState('protection'),
    [name, setName] = useState('');
  const [destination, setDestination] = useState('auto');
  const [poolSearch, setPoolSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState(''),
    [shareError, setShareError] = useState(''),
    [copied, setCopied] = useState(false);
  const [poolView, setPoolView] = useState<'characters' | 'specs'>('characters');
  const [error, setError] = useState('');
  const [command, state] = useCommandMutation();
  const guildId = data.workspace.id;
  const busy = state.isLoading;
  const comp = plan ? composition(plan, data.characters) : null;
  const groupCount = plan ? Math.ceil(plan.capacity / 5) : 0;
  const assignments = plan?.assignments || [];
  const available = data.characters.filter(
    (c) => !c.archived && !assignments.some((a) => a.characterId === c.id),
  );
  const matching = available.filter((c) =>
    [c.name, label(c.class), specFor(c.class, c.spec)?.name || 'Custom', label(c.role)]
      .join(' ')
      .toLowerCase()
      .includes(poolSearch.trim().toLowerCase()),
  );
  async function run(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    setError('');
    try {
      return await command({ guildId, path, method, body }).unwrap();
    } catch (e) {
      setError(errorMessage(e));
      return null;
    }
  }
  function autoGroup() {
    if (!plan) return null;
    for (let group = 1; group <= groupCount; group++)
      if (
        assignments.filter((a) => a.status === 'lineup' && a.group === group).length <
        Math.min(5, plan.capacity - (group - 1) * 5)
      )
        return group;
    return null;
  }
  function target() {
    const group =
      destination === 'auto' ? autoGroup() : destination === 'bench' ? null : Number(destination);
    return {
      group,
      status: (destination === 'bench' || group === null
        ? 'bench'
        : 'lineup') as Assignment['status'],
    };
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!plan) return;
    const spec = specFor(playerClass, specId)!;
    const base = spec.name + ' ' + label(playerClass);
    let candidate = base,
      n = 2;
    while (data.characters.some((c) => c.name.toLowerCase() === candidate.toLowerCase()))
      candidate = base + ' ' + n++;
    const result = await run(
      'characters',
      'POST',
      presetCharacter(playerClass, specId, name.trim() || candidate),
    );
    if (result) {
      setName('');
      setPoolSearch('');
      setCreating(false);
      setPoolView('characters');
    }
  }
  async function move(characterId: string, value: string, slot?: number) {
    if (!plan || busy) return;
    await run('plans/' + plan.id + '/assignments', 'PUT', {
      assignment: {
        characterId,
        slot,
        status: value === 'bench' ? 'bench' : 'lineup',
        group: value === 'bench' || value === 'ungrouped' ? null : Number(value),
      },
      revision: plan.revision,
    });
  }
  async function addExisting(characterId: string) {
    if (!plan || busy) return;
    await run('plans/' + plan.id + '/assignments', 'PUT', {
      assignment: { characterId, ...target() },
      revision: plan.revision,
    });
  }
  async function returnToPool(characterId: string) {
    if (!plan || busy) return;
    await run('plans/' + plan.id + '/assignments/' + characterId, 'DELETE', {
      revision: plan.revision,
    });
  }
  function startDrag(e: DragEvent, characterId: string) {
    e.dataTransfer.setData('text/plain', characterId);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(characterId);
  }
  function endDrag() {
    setDragging(null);
    setDropTarget(null);
  }
  function dragOver(e: DragEvent, target: string) {
    if (
      !dragging ||
      busy ||
      (target === 'pool' &&
        !dragging.startsWith('spec:') &&
        !assignments.some((a) => a.characterId === dragging))
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  }
  function dragLeave(e: DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
  }
  function unusedName(cls: CharacterClass, specId: string) {
    const base = (specFor(cls, specId)?.name || 'Custom') + ' ' + label(cls);
    let candidate = base,
      n = 2;
    while (data.characters.some((c) => c.name.toLowerCase() === candidate.toLowerCase()))
      candidate = base + ' ' + n++;
    return candidate;
  }
  async function addTemplate(cls: CharacterClass, specId: string, value?: string, slot?: number) {
    if (!plan || busy) return;
    const c = presetCharacter(cls, specId, unusedName(cls, specId));
    if (value === 'pool') {
      await run('characters', 'POST', c);
      setPoolView('characters');
      return;
    }
    const position = value
      ? {
          status: value === 'bench' ? 'bench' : 'lineup',
          group: value === 'bench' || value === 'ungrouped' ? null : Number(value),
        }
      : target();
    await run('plans/' + plan.id + '/characters', 'POST', {
      character: c,
      revision: plan.revision,
      ...position,
      slot,
    });
  }
  async function drop(e: DragEvent, value: string, slot?: number) {
    e.preventDefault();
    e.stopPropagation();
    const char = e.dataTransfer.getData('text/plain');
    endDrag();
    if (char.startsWith('spec:')) {
      const [, cls, specId] = char.split(':');
      if ((classes as readonly string[]).includes(cls) && specFor(cls as CharacterClass, specId))
        await addTemplate(cls as CharacterClass, specId, value, slot);
      return;
    }
    if (value === 'pool') {
      if (assignments.some((a) => a.characterId === char)) await returnToPool(char);
    } else if (data.characters.some((c) => c.id === char && !c.archived))
      await move(char, value, slot);
  }
  function card(a: Assignment) {
    const c = data.characters.find((c) => c.id === a.characterId);
    if (!c) return null;
    return (
      <div
        key={a.id}
        className={
          'comp-character class-identity' +
          (dragging === c.id ? ' is-dragging' : '') +
          (a.group && a.slot && dropTarget === a.group + ':' + a.slot ? ' drop-active' : '')
        }
        data-testid="comp-character"
        data-slot={a.slot ?? ''}
        data-group={a.group ?? ''}
        style={classStyle(c.class)}
        draggable={!busy}
        onDragStart={(e) => startDrag(e, c.id)}
        onDragEnd={endDrag}
        onDragOver={a.group && a.slot ? (e) => dragOver(e, a.group + ':' + a.slot) : undefined}
        onDragLeave={dragLeave}
        onDrop={a.group && a.slot ? (e) => drop(e, String(a.group), a.slot!) : undefined}
      >
        <button
          className="character-edit"
          draggable={!busy}
          onClick={() => setEditing(c)}
          aria-label={'Edit ' + c.name}
        >
          <CharacterIdentity
            name={c.name}
            cls={c.class}
            role={c.role}
            spec={specFor(c.class, c.spec)?.name || 'Custom'}
          />
        </button>
        <select
          className="move-character"
          aria-label={'Move ' + c.name}
          disabled={busy}
          value={a.status === 'bench' ? 'bench' : (a.group ?? 'ungrouped')}
          onChange={(e) => move(c.id, e.target.value)}
        >
          <option value="ungrouped">Unassigned</option>
          {Array.from({ length: groupCount }, (_, i) => (
            <option value={i + 1} key={i}>
              G{i + 1}
            </option>
          ))}
          <option value="bench">Bench</option>
        </select>
        <button
          className="icon-button remove-character"
          disabled={busy}
          aria-label={'Remove ' + c.name + ' from composition'}
          onClick={() => returnToPool(c.id)}
        >
          <X size={13} />
        </button>
      </div>
    );
  }
  return (
    <>
      <h1 className="sr-only">Raid composition</h1>
      <div className="raid-toolbar">
        {plan ? (
          <>
            <select
              className="raid-picker"
              aria-label="Saved composition"
              value={plan.id}
              onChange={(e) => {
                navigate('/plans/' + e.target.value);
                setError('');
              }}
            >
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="raid-capacity">
              {comp!.total}
              <span> / {plan.capacity}</span>
            </span>
            <div className="role-counts">
              {roles.map((r) => (
                <span key={r} aria-label={comp!.counts[r] + ' ' + label(r)}>
                  <RoleIcon role={r} size={14} />
                  <strong>{comp!.counts[r]}</strong>
                </span>
              ))}
            </div>
            <details
              className="raid-actions"
              onKeyDown={(e) => {
                if (e.key === 'Escape') e.currentTarget.removeAttribute('open');
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  e.currentTarget.removeAttribute('open');
              }}
            >
              <summary aria-label="Raid actions">
                <MoreHorizontal size={19} />
              </summary>
              <div className="action-popover">
                <button
                  disabled={busy}
                  onClick={(e) => {
                    e.currentTarget.closest('details')!.removeAttribute('open');
                    setModal('edit');
                  }}
                >
                  <Pencil size={14} />
                  Edit raid
                </button>
                <button
                  disabled={busy}
                  onClick={async (e) => {
                    e.currentTarget.closest('details')!.removeAttribute('open');
                    const r = await run('plans/' + plan.id + '/duplicate', 'POST', {
                      revision: plan.revision,
                    });
                    if (r?.id) navigate('/plans/' + r.id);
                  }}
                >
                  <Copy size={14} />
                  Duplicate
                </button>
                <button
                  onClick={async (e) => {
                    e.currentTarget.closest('details')!.removeAttribute('open');
                    try {
                      setShareUrl(await raidShareLink(plan, data.characters));
                      setCopied(false);
                      setShareError('');
                      setModal('share');
                    } catch (error) {
                      setError(errorMessage(error));
                    }
                  }}
                >
                  <Link2 size={14} />
                  Share link
                </button>
                <a href={'/api/guilds/' + guildId + '/backup'} download>
                  <Download size={14} />
                  Export data
                </a>
                <button
                  disabled={busy}
                  className="danger"
                  aria-label="Delete composition"
                  onClick={(e) => {
                    e.currentTarget.closest('details')!.removeAttribute('open');
                    setModal('delete');
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </details>
          </>
        ) : (
          <span className="raid-empty-label">Raids</span>
        )}
        <button
          className="button secondary new-raid"
          aria-label="New composition"
          onClick={() => setModal('new')}
        >
          <Plus size={15} />
          New raid
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {!plan ? (
        <Empty
          title={id ? 'Raid not found' : 'No raids yet'}
          action={
            <button className="button primary" onClick={() => setModal('new')}>
              Create composition
            </button>
          }
        >
          Create a 10, 20, or 40-man raid.
        </Empty>
      ) : (
        <>
          {plan.notes && (
            <details className="raid-notes">
              <summary>Notes</summary>
              <p>{plan.notes}</p>
            </details>
          )}
          <div className="composition-workspace">
            <div className="composition-lineup">
              <section aria-label="Raid groups" className="composition-groups">
                {Array.from({ length: groupCount }, (_, i) => i + 1).map((group) => {
                  const rows = assignments.filter(
                    (a) => a.status === 'lineup' && a.group === group,
                  );
                  return (
                    <section
                      key={group}
                      className={
                        'comp-group panel' + (dropTarget === String(group) ? ' drop-active' : '')
                      }
                      aria-label={'Group ' + group}
                      onDragOver={(e) => dragOver(e, String(group))}
                      onDragLeave={dragLeave}
                      onDrop={(e) => drop(e, String(group))}
                    >
                      <header>
                        <h2>Group {group}</h2>
                        <span>{rows.length}/5</span>
                      </header>
                      <GroupBuffs data={comp!} group={group} />
                      <div className="group-characters">
                        {[1, 2, 3, 4, 5].map((slot) => {
                          const a = rows.find((a) => a.slot === slot);
                          return a ? (
                            card(a)
                          ) : (
                            <div
                              className={
                                'empty-slot' +
                                (dropTarget === group + ':' + slot ? ' drop-active' : '')
                              }
                              key={slot}
                              data-testid="empty-slot"
                              data-slot={slot}
                              onDragOver={(e) => dragOver(e, group + ':' + slot)}
                              onDragLeave={dragLeave}
                              onDrop={(e) => drop(e, String(group), slot)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </section>
              {comp!.ungrouped > 0 && (
                <section
                  className={
                    'comp-bench panel' + (dropTarget === 'ungrouped' ? ' drop-active' : '')
                  }
                  aria-label="Unassigned characters"
                  onDragOver={(e) => dragOver(e, 'ungrouped')}
                  onDragLeave={dragLeave}
                  onDrop={(e) => drop(e, 'ungrouped')}
                >
                  <header>
                    <h2>
                      Unassigned <span>{comp!.ungrouped}</span>
                    </h2>
                  </header>
                  <div className="bench-characters">
                    {assignments.filter((a) => a.status === 'lineup' && a.group === null).map(card)}
                  </div>
                </section>
              )}
              <section
                className={'comp-bench panel' + (dropTarget === 'bench' ? ' drop-active' : '')}
                aria-label="Bench"
                onDragOver={(e) => dragOver(e, 'bench')}
                onDragLeave={dragLeave}
                onDrop={(e) => drop(e, 'bench')}
              >
                <header>
                  <h2>
                    Bench <span>{assignments.filter((a) => a.status === 'bench').length}</span>
                  </h2>
                </header>
                <div className="bench-characters">
                  {assignments.filter((a) => a.status === 'bench').map(card)}
                </div>
                {!assignments.some((a) => a.status === 'bench') && (
                  <div className="bench-empty" aria-hidden="true" />
                )}
              </section>
            </div>
            <aside
              className={'character-pool panel' + (dropTarget === 'pool' ? ' drop-active' : '')}
              aria-label="Character pool"
              onDragOver={(e) => dragOver(e, 'pool')}
              onDragLeave={dragLeave}
              onDrop={(e) => drop(e, 'pool')}
            >
              <header>
                <h2>
                  Characters <span>{available.length}</span>
                </h2>
                <button
                  className="icon-button"
                  aria-label={creating ? 'Cancel new character' : 'New character'}
                  aria-expanded={creating}
                  onClick={() => setCreating(!creating)}
                >
                  {creating ? <X size={16} /> : <Plus size={17} />}
                </button>
              </header>
              {creating && (
                <form className="pool-create" onSubmit={add}>
                  <div className="form-grid">
                    <Field label="Class">
                      <select
                        value={playerClass}
                        onChange={(e) => {
                          const cls = e.target.value as CharacterClass;
                          setClass(cls);
                          setSpec(specs[cls][0].id);
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
                      <select value={specId} onChange={(e) => setSpec(e.target.value)}>
                        {specs[playerClass].map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Name (optional)">
                    <input
                      autoFocus
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Character name"
                    />
                  </Field>
                  <button className="button primary full" disabled={busy}>
                    Add character
                  </button>
                </form>
              )}
              <div
                className="coverage-tabs pool-tabs"
                role="group"
                aria-label="Character pool view"
              >
                <button
                  aria-pressed={poolView === 'characters'}
                  onClick={() => setPoolView('characters')}
                >
                  Characters
                </button>
                <button aria-pressed={poolView === 'specs'} onClick={() => setPoolView('specs')}>
                  Specs
                </button>
              </div>
              {poolView === 'specs' ? (
                <>
                  <div className="class-palette" aria-label="Classes">
                    {classes.map((cls) => (
                      <button
                        className="class-name"
                        style={classStyle(cls)}
                        aria-pressed={playerClass === cls}
                        key={cls}
                        onClick={() => setClass(cls)}
                      >
                        <span className="class-dot" />
                        {label(cls)}
                      </button>
                    ))}
                  </div>
                  <div className="pool-characters">
                    {specs[playerClass].map((spec) => (
                      <div
                        className="pool-character class-identity spec-template"
                        key={playerClass + spec.id}
                        style={classStyle(playerClass)}
                        data-testid="spec-template"
                        draggable={!busy}
                        onDragStart={(e) => startDrag(e, 'spec:' + playerClass + ':' + spec.id)}
                        onDragEnd={endDrag}
                      >
                        <CharacterIdentity name={spec.name} cls={playerClass} role={spec.role} />
                        <button
                          className="icon-button"
                          disabled={busy}
                          aria-label={'Add ' + spec.name + ' ' + label(playerClass)}
                          onClick={() => addTemplate(playerClass, spec.id)}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="pool-search">
                    <input
                      type="search"
                      aria-label="Search character pool"
                      placeholder="Search characters"
                      value={poolSearch}
                      onChange={(e) => setPoolSearch(e.target.value)}
                    />
                  </div>
                  <div className="pool-characters">
                    {matching.map((c) => (
                      <div
                        key={c.id}
                        className={
                          'pool-character class-identity' +
                          (dragging === c.id ? ' is-dragging' : '')
                        }
                        data-testid="pool-character"
                        style={classStyle(c.class)}
                        draggable={!busy}
                        onDragStart={(e) => startDrag(e, c.id)}
                        onDragEnd={endDrag}
                      >
                        <button
                          className="character-edit"
                          draggable={!busy}
                          aria-label={'Edit ' + c.name}
                          onClick={() => setEditing(c)}
                        >
                          <CharacterIdentity
                            name={c.name}
                            cls={c.class}
                            role={c.role}
                            spec={specFor(c.class, c.spec)?.name || 'Custom'}
                          />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={'Add ' + c.name + ' to composition'}
                          disabled={busy}
                          onClick={() => addExisting(c.id)}
                        >
                          <Plus size={15} />
                        </button>
                        <button
                          className="icon-button delete-pool-character"
                          aria-label={'Delete ' + c.name}
                          disabled={busy}
                          onClick={() => {
                            setDeleteError('');
                            setDeleting(c);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {!matching.length && (
                      <p className="pool-empty">
                        {available.length ? 'No matching characters.' : 'No available characters.'}
                      </p>
                    )}
                  </div>
                </>
              )}
              <div className="pool-destination">
                <label htmlFor="pool-destination">Add to</label>
                <select
                  id="pool-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="auto">First open group</option>
                  {Array.from({ length: groupCount }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Group {i + 1}
                    </option>
                  ))}
                  <option value="bench">Bench</option>
                </select>
              </div>
            </aside>
          </div>
          <BuffCoverage
            data={comp!}
            onEdit={(id) => setEditing(data.characters.find((c) => c.id === id))}
          />
        </>
      )}
      {(modal === 'new' || modal === 'edit') && (
        <Modal title={modal === 'new' ? 'New raid' : 'Edit raid'} onClose={() => setModal(null)}>
          <PlanForm
            key={modal + (plan?.id || '')}
            guildId={guildId}
            initial={modal === 'edit' ? plan : undefined}
            onDone={(newId) => {
              setModal(null);
              if (newId) navigate('/plans/' + newId);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit character" onClose={() => setEditing(undefined)}>
          <CharacterForm guildId={guildId} initial={editing} onDone={() => setEditing(undefined)} />
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete character?"
          onClose={() => {
            if (!busy) setDeleting(undefined);
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong> from the character pool and all saved raids?
            This cannot be undone.
          </p>
          {deleteError && <ErrorBox message={deleteError} />}
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
            >
              Cancel
            </button>
            <button
              className="button destructive"
              disabled={busy}
              onClick={async () => {
                setDeleteError('');
                try {
                  await command({
                    guildId,
                    path: 'characters/' + deleting.id,
                    method: 'DELETE',
                    body: { revision: deleting.revision },
                  }).unwrap();
                  setDeleting(undefined);
                } catch (e) {
                  setDeleteError(errorMessage(e));
                }
              }}
            >
              Delete character
            </button>
          </div>
        </Modal>
      )}
      {modal === 'delete' && plan && (
        <Modal title="Delete raid?" onClose={() => setModal(null)}>
          <p>Delete {plan.name}?</p>
          <div className="form-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button destructive"
              disabled={busy}
              onClick={async () => {
                const r = await run('plans/' + plan.id, 'DELETE', { revision: plan.revision });
                if (r) {
                  setModal(null);
                  navigate('/');
                }
              }}
            >
              Delete composition
            </button>
          </div>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title="Share raid" onClose={() => setModal(null)}>
          <p className="muted small-copy">
            Read-only snapshot, including character names and bench.
          </p>
          <Field label="Raid link">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
          </Field>
          {shareError && <ErrorBox message={shareError} />}
          <div className="form-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Close
            </button>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                } catch {
                  setShareError('Select and copy the link above.');
                }
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
