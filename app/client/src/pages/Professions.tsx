import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Hammer,
  RefreshCw,
  Search,
  ArrowRight,
  FlaskConical,
  Utensils,
  Pickaxe,
  Gem,
  Scissors,
  Leaf,
  ScrollText,
  Fish,
} from 'lucide-react';
import type { DirectoryCharacter, DirectoryRecipe, ProfessionDirectory } from '@spf/shared';
import {
  useProfessionsQuery,
  useProfessionCharacterQuery,
  useRecipeProvidersQuery,
  usePrioritizeRecipeDetailsMutation,
  useProfessionCommandMutation,
  errorMessage,
} from '../api';
import { Empty, ErrorBox, Field, Modal } from '../ui';
import { useWowheadTooltips, WowheadItemLink } from '../wowhead';
import CharacterName, { characterNameStyle } from '../CharacterName';
import RecipeMaterials from '../RecipeMaterials';

function fetchedAt(value: string | null) {
  if (!value) return 'Never fetched';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  const age =
    minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
  return age;
}
const stateLabel = (c: DirectoryCharacter) =>
  c.queued
    ? 'Refresh queued'
    : c.error
      ? c.lastSuccess
        ? 'Refresh failed · cached data'
        : 'Data unavailable'
      : c.lastSuccess
        ? 'Fetched'
        : 'Not fetched';
const identity = (c: DirectoryCharacter) => `${c.name} — ${c.realm}`;
function CharacterLabel({ character: c }: { character: DirectoryCharacter }) {
  return (
    <span>
      <CharacterName name={c.name} classId={c.classId} />
      <span className="profs-realm"> — {c.realm}</span>
    </span>
  );
}
function knownCharacters(ids: string[], characters: DirectoryCharacter[]) {
  const known = new Set(ids);
  return characters
    .filter((c) => known.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name) || a.realm.localeCompare(b.realm));
}
function CrafterCount({
  recipe,
  characters,
  openModal,
}: {
  recipe: DirectoryRecipe;
  characters: DirectoryCharacter[];
  openModal: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ above: false, height: 280 });
  const group = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useId();
  const providers = knownCharacters(recipe.characterIds, characters);
  const count = recipe.characterIds.length;
  function showNames() {
    if (!button.current) return;
    const rect = button.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top > below;
    setPlacement({ above, height: Math.min(280, Math.max(80, (above ? rect.top : below) - 20)) });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && group.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  return (
    <div
      className="profs-count-wrap"
      ref={group}
      data-open={open || undefined}
      data-above={placement.above || undefined}
      onMouseEnter={showNames}
      onMouseLeave={() => {
        if (!group.current?.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={showNames}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          e.stopPropagation();
        }
      }}
    >
      <button
        ref={button}
        className="profs-count-button"
        aria-label={`${count} ${count === 1 ? 'crafter' : 'crafters'} for ${recipe.name}`}
        aria-haspopup="dialog"
        aria-describedby={open ? tooltip : undefined}
        onClick={() => {
          setOpen(false);
          openModal();
        }}
      >
        <span>
          <strong>{count}</strong> {count === 1 ? 'crafter' : 'crafters'}
        </span>
        <ArrowRight size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={tooltip}
          role="tooltip"
          className={`profs-count-popover${placement.above ? ' above' : ''}`}
          style={{ maxHeight: placement.height }}
        >
          <ul>
            {providers.map((c) => (
              <li key={c.id}>
                <CharacterLabel character={c} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
function CrafterButton({
  character: c,
  select,
}: {
  character: DirectoryCharacter;
  select: (c: DirectoryCharacter) => void;
}) {
  const freshness = c.lastSuccess
    ? `Updated ${fetchedAt(c.lastSuccess)} · ${new Date(c.lastSuccess).toLocaleString()}`
    : 'Not fetched';
  const status = `${freshness}${c.error ? ' · Latest refresh failed; showing cached data' : ''}`;
  return (
    <button
      className="profs-crafter-button"
      aria-label={identity(c)}
      aria-description={status}
      title={`${identity(c)}\n${status}`}
      onClick={() => select(c)}
    >
      <span className="profs-crafter-identity">
        <CharacterName name={c.name} classId={c.classId} />
        <span className="profs-crafter-realm">
          {c.realm}
          {c.error ? ' · cached' : ''}
        </span>
      </span>
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  );
}
function Updated({ value }: { value: string | null }) {
  return (
    <span className="muted" title={value ? new Date(value).toLocaleString() : undefined}>
      {value ? `Updated ${fetchedAt(value)}` : 'Not fetched'}
    </span>
  );
}
function CharacterStatus({ character: c }: { character: DirectoryCharacter }) {
  return c.lastSuccess ? (
    <span>
      <Updated value={c.lastSuccess} />
      {(c.queued || c.error) && ` · ${stateLabel(c)}`}
    </span>
  ) : (
    <span className="muted">{stateLabel(c)}</span>
  );
}
function Member({
  character: c,
  characters = [],
}: {
  character: DirectoryCharacter;
  characters?: DirectoryCharacter[];
}) {
  if (!c.member && !c.discord) return null;
  const main = characters.find((char) => char.memberId === c.memberId && char.isMain);
  return (
    <div className="profs-contact">
      <span>
        {c.member}
        {c.isMain === true && ' · Main'}
        {c.isMain === false && (
          <>
            {' '}
            · Alt of <CharacterName name={c.main || ''} classId={main?.classId} />
          </>
        )}
      </span>
      {c.discord && <small>Discord: {c.discord}</small>}
    </div>
  );
}

export default function Professions({ userId }: { userId: string | null }) {
  const [tab, setTab] = useState<'recipes' | 'characters' | 'account'>('recipes');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [profession, setProfession] = useState('');
  const [expansion, setExpansion] = useState('');
  const [character, setCharacter] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DirectoryCharacter | null>(null);
  const [recipe, setRecipe] = useState<DirectoryRecipe | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [command, commandState] = useProfessionCommandMutation();
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);
  const query = useProfessionsQuery(
    { q: search, profession, expansion, character, page },
    { pollingInterval: 15000, refetchOnFocus: true, refetchOnReconnect: true },
  );
  const data = query.data;
  const recipeKey = JSON.stringify(data?.recipes.map((r) => r.id) || []);
  useWowheadTooltips(`${recipeKey}:${recipe?.id || ''}:${data?.itemDetailsPending || 0}`);
  const [prioritizeDetails] = usePrioritizeRecipeDetailsMutation();
  useEffect(() => {
    const ids = JSON.parse(recipeKey) as number[];
    if (userId && data?.configured && tab === 'recipes' && ids.length)
      void prioritizeDetails(ids)
        .unwrap()
        .catch(() => {});
  }, [recipeKey, data?.configured, tab, prioritizeDetails, userId]);
  async function act(path: string, body?: unknown, method: 'POST' | 'PUT' = 'POST') {
    setError('');
    setNotice('');
    try {
      await command({ path, body, method }).unwrap();
      setNotice(path.includes('refresh') ? 'Refresh queued.' : 'Saved.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  if (!data)
    return query.error ? (
      <ErrorBox message={errorMessage(query.error)} />
    ) : (
      <div className="empty">Loading professions...</div>
    );
  const fetched = data.characters.filter((c) => c.lastSuccess).length;
  const roster = data.characters.filter((c) => c.inRoster).length;
  const visibleCharacters = data.characters.filter((c) =>
    `${c.name} ${c.realm} ${c.member || ''}`.toLowerCase().includes(memberSearch.toLowerCase()),
  );
  const activeCharacter = selected
    ? data.characters.find((c) => c.id === selected.id) || selected
    : null;
  const activeRecipe = recipe
    ? data.recipes.find(
        (r) =>
          r.id === recipe.id &&
          r.profession === recipe.profession &&
          r.expansion === recipe.expansion,
      )
    : null;
  return (
    <section className="profs-page">
      <div className="profs-heading profs-guild-banner">
        <div className="profs-guild-brand">
          <img className="profs-guild-emblem" src="/horde-emblem.png" alt="" />
          <h1>
            <span className="profs-guild-name">{data.guild}</span>{' '}
            <span className="profs-guild-subtitle">Professions</span>
          </h1>
        </div>
        <button
          className="icon-button profs-banner-refresh"
          aria-label="Update view"
          title="Update view"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      {!data.configured && <div className="profs-banner">Blizzard connection pending.</div>}
      {data.rosterError && <ErrorBox message={`Roster refresh: ${data.rosterError}`} />}
      {(error || query.error) && <ErrorBox message={error || errorMessage(query.error)} />}
      {notice && (
        <p className="profs-notice" role="status">
          {notice}
        </p>
      )}
      <div className="profs-tabs" role="group" aria-label="Directory views">
        <button className={tab === 'recipes' ? 'active' : ''} onClick={() => setTab('recipes')}>
          Recipes
        </button>
        <button
          className={tab === 'characters' ? 'active' : ''}
          onClick={() => setTab('characters')}
        >
          Characters
        </button>
        {userId && (
          <button className={tab === 'account' ? 'active' : ''} onClick={() => setTab('account')}>
            My characters
          </button>
        )}
      </div>
      {tab === 'recipes' && (
        <>
          <div className="profs-filters">
            <Field label="Recipe or crafted item">
              <div className="profs-search">
                <Search size={16} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search recipes or items"
                  maxLength={150}
                  aria-label="Recipe or crafted item"
                />
              </div>
            </Field>
            <Field label="Profession">
              <select
                value={profession}
                onChange={(e) => {
                  setProfession(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All professions</option>
                {data.professions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Expansion">
              <select
                value={expansion}
                onChange={(e) => {
                  setExpansion(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All expansions</option>
                {data.expansions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Character">
              <select
                value={character}
                onChange={(e) => {
                  setCharacter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All characters</option>
                {data.characters.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    style={characterNameStyle(c.classId)}
                    className="wow-character-name"
                  >
                    {identity(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="profs-caption">
            {data.totalRecipes} {data.totalRecipes === 1 ? 'recipe' : 'recipes'}
          </p>
          <div className="profs-results" aria-busy={query.isFetching}>
            {data.recipes.length ? (
              data.recipes.map((r) => (
                <article className="profs-recipe" key={`${r.id}:${r.profession}:${r.expansion}`}>
                  <button
                    className="profs-card-open"
                    aria-label={`Crafters for ${r.name}`}
                    onClick={() => setRecipe(r)}
                  />
                  <div className="profs-recipe-identity">
                    <WowheadItemLink
                      gameVersion={data.gameVersion}
                      name={r.name}
                      itemId={r.items[0]?.id}
                      fallback={<RecipeIcon recipe={r} />}
                      onInspect={() => setRecipe(r)}
                      description={
                        <>
                          {r.profession} · {r.expansion}
                          {r.items.length > 1 && ` · ${r.items.length} items`}
                          <RecipeMaterials id={r.id} name={r.name} />
                        </>
                      }
                    />
                  </div>
                  <CrafterCount
                    recipe={r}
                    characters={data.characters}
                    openModal={() => setRecipe(r)}
                  />
                </article>
              ))
            ) : (
              <Empty
                title={
                  search || profession || expansion || character ? 'No matches' : 'No recipes yet'
                }
              >
                {data.characters.length
                  ? 'Try another search. Unfetched characters may know this recipe.'
                  : 'The roster has not been imported.'}
              </Empty>
            )}
          </div>
          {data.totalRecipes > data.pageSize && (
            <div className="profs-pagination">
              <button
                className="button secondary"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(data.totalRecipes / data.pageSize)}
              </span>
              <button
                className="button secondary"
                disabled={page * data.pageSize >= data.totalRecipes || query.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {tab === 'characters' && (
        <>
          <div className="profs-section-heading">
            <span className="muted">
              {visibleCharacters.length} characters
              {visibleCharacters.length !== data.characters.length &&
                ` · ${data.characters.length} total`}
            </span>
            {data.admin && (
              <button
                className="button secondary"
                disabled={!data.configured || data.rosterQueued || commandState.isLoading}
                onClick={() => act('refresh-roster')}
              >
                {data.rosterQueued ? 'Queued' : 'Refresh roster'}
              </button>
            )}
          </div>
          <Field label="Find a guild character">
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Character, realm, or member"
              maxLength={100}
            />
          </Field>
          <div className="profs-character-grid">
            {visibleCharacters.map((c) => (
              <article className="profs-character-card" key={c.id}>
                <button className="profs-recipe-title" onClick={() => setSelected(c)}>
                  <CharacterLabel character={c} />
                  <ArrowRight size={14} />
                </button>
                {!c.inRoster && <small className="profs-seed">Outside guild roster</small>}
                {userId && <Member character={c} characters={data.characters} />}
                <small>
                  <CharacterStatus character={c} />
                </small>
              </article>
            ))}
          </div>
          {!data.characters.length && (
            <Empty title="Roster not imported yet">Waiting for the first roster import.</Empty>
          )}
        </>
      )}
      {tab === 'account' && userId && (
        <Account data={data} userId={userId} act={act} busy={commandState.isLoading} />
      )}
      {activeCharacter && (
        <CharacterDetail
          character={activeCharacter}
          characters={data.characters}
          onClose={() => setSelected(null)}
          configured={data.configured}
          signedIn={Boolean(userId)}
          busy={commandState.isLoading}
          refresh={() => act(`characters/${activeCharacter.id}/refresh`)}
          browse={() => {
            setCharacter(activeCharacter.id);
            setQ('');
            setProfession('');
            setExpansion('');
            setPage(1);
            setTab('recipes');
            setSelected(null);
          }}
        />
      )}
      {recipe && (
        <Modal title={recipe.name} onClose={() => setRecipe(null)}>
          <div className="profs-item-heading">
            <div>
              <p className="profs-caption">
                {recipe.profession} · {recipe.expansion}
              </p>
              <div className="profs-wowhead-links">
                {(activeRecipe || recipe).items.length ? (
                  (activeRecipe || recipe).items.map((item) => (
                    <WowheadItemLink
                      key={item.id}
                      gameVersion={data.gameVersion}
                      name={item.name}
                      itemId={item.id}
                      fallback={<RecipeIcon recipe={activeRecipe || recipe} />}
                    />
                  ))
                ) : (
                  <WowheadItemLink
                    gameVersion={data.gameVersion}
                    name={recipe.name}
                    fallback={<RecipeIcon recipe={activeRecipe || recipe} />}
                  />
                )}
              </div>
            </div>
          </div>
          {activeRecipe ? (
            <RecipeMembers
              recipe={activeRecipe}
              characters={data.characters}
              select={(c) => {
                setRecipe(null);
                setSelected(c);
              }}
            />
          ) : (
            <p>
              This recipe is no longer in the current results. Close this view to review the latest
              data.
            </p>
          )}
        </Modal>
      )}
      <footer className="profs-footer">
        <span>Arrange crafts in Discord.</span>
        <details className="profs-data-status">
          <summary>
            Data status · {fetched}/{data.characters.length} updated
          </summary>
          <div>
            <p>
              {roster} roster characters · {data.characters.length - fetched} not fetched. Missing
              data does not mean a recipe is unknown.
            </p>
            <p>
              Roster: <Updated value={data.rosterSynced} />.{' '}
              {data.configured &&
                (data.automaticRefresh.enabled
                  ? `Automatic refresh every ${data.automaticRefresh.intervalMinutes === 60 ? 'hour' : `${data.automaticRefresh.intervalMinutes} minutes`}.`
                  : 'Automatic refresh is off.')}
            </p>
            {data.automaticRefresh.queued > 0 && (
              <p>{data.automaticRefresh.queued} refreshes queued.</p>
            )}
            {data.automaticRefresh.backoffUntil &&
              new Date(data.automaticRefresh.backoffUntil).getTime() > Date.now() && (
                <p>
                  Blizzard requests paused until{' '}
                  {new Date(data.automaticRefresh.backoffUntil).toLocaleTimeString()}.
                </p>
              )}
            {data.itemDetailsPending > 0 && (
              <p>
                Item search is indexing {data.itemDetailsPending} recipes. Recipe-name search is
                available.
              </p>
            )}
            <p>Blizzard data can lag the game. Confirm with your crafter.</p>
            <p>Forever Profile API and learned recipes remain unverified.</p>
          </div>
        </details>
      </footer>
    </section>
  );
}

function RecipeIcon({ recipe }: { recipe: DirectoryRecipe }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [recipe.iconUrl]);
  if (recipe.iconUrl && !broken)
    return (
      <img
        className="profs-item-icon"
        src={recipe.iconUrl}
        width={68}
        height={68}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  const name = recipe.profession.toLowerCase();
  const Icon = name.includes('alchemy')
    ? FlaskConical
    : name.includes('cook')
      ? Utensils
      : name.includes('mining')
        ? Pickaxe
        : name.includes('jewel')
          ? Gem
          : name.includes('tailor') || name.includes('leather')
            ? Scissors
            : name.includes('herb')
              ? Leaf
              : name.includes('inscript') || name.includes('enchant')
                ? ScrollText
                : name.includes('fish')
                  ? Fish
                  : Hammer;
  return (
    <span className="profs-item-icon profs-icon-placeholder" aria-hidden="true">
      <Icon size={32} />
    </span>
  );
}

function RecipeMembers({
  recipe,
  characters,
  select,
}: {
  recipe: DirectoryRecipe;
  characters: DirectoryCharacter[];
  select: (c: DirectoryCharacter) => void;
}) {
  const [search, setSearch] = useState('');
  const query = useRecipeProvidersQuery(recipe.id);
  if (query.error) return <ErrorBox message={errorMessage(query.error)} />;
  if (!query.data) return <p>Loading recipe coverage...</p>;
  const providers = knownCharacters(query.data.characterIds, characters);
  const filtered = providers.filter((c) =>
    `${c.name} ${c.realm} ${c.member || ''} ${c.main || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <div className="profs-modal-list">
      <section>
        <div className="profs-crafters-heading">
          <h3>
            {providers.length} {providers.length === 1 ? 'crafter' : 'crafters'}
          </h3>
          {search && <small className="muted">{filtered.length} shown</small>}
        </div>
        {(providers.length > 6 || search) && (
          <div className="profs-crafter-search">
            <Field label="Find a crafter">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, realm, or member"
                maxLength={100}
              />
            </Field>
          </div>
        )}
        <div
          className="profs-crafter-list"
          role="list"
          aria-label="Recipe crafters"
          tabIndex={providers.length > 6 ? 0 : undefined}
        >
          {filtered.map((c) => {
            return (
              <article className="profs-provider-row" key={c.id} role="listitem">
                <CrafterButton character={c} select={select} />
                {(c.member || c.discord) && <Member character={c} characters={characters} />}
              </article>
            );
          })}
        </div>
        {!filtered.length && (
          <p className="profs-caption" role="status">
            {search ? 'No crafters match this search.' : 'No crafters in the latest data.'}
          </p>
        )}
      </section>
    </div>
  );
}

function CharacterDetail({
  character: c,
  characters,
  onClose,
  configured,
  signedIn,
  busy,
  refresh,
  browse,
}: {
  character: DirectoryCharacter;
  characters: DirectoryCharacter[];
  onClose: () => void;
  configured: boolean;
  signedIn: boolean;
  busy: boolean;
  refresh: () => void;
  browse: () => void;
}) {
  const query = useProfessionCharacterQuery(c.id);
  return (
    <Modal title={<CharacterLabel character={c} />} onClose={onClose} wide>
      <div className="profs-modal-list">
        {signedIn && <Member character={c} characters={characters} />}
        <p className="profs-caption">
          <CharacterStatus character={c} />
        </p>
        {c.error && <ErrorBox message={c.error} />}
        <div className="profs-actions">
          {signedIn ? (
            <button
              className="button secondary"
              disabled={
                !configured ||
                c.queued ||
                busy ||
                Boolean(c.refreshAfter && new Date(c.refreshAfter).getTime() > Date.now())
              }
              onClick={refresh}
            >
              <RefreshCw size={14} />
              {c.queued ? 'Refresh queued' : 'Request refresh'}
            </button>
          ) : (
            <Link className="button secondary" to="/planner">
              Officer sign in to refresh
            </Link>
          )}
          <button className="button secondary" onClick={browse}>
            View recipes
          </button>
        </div>
        {c.refreshAfter && new Date(c.refreshAfter).getTime() > Date.now() && (
          <small className="muted">
            Refresh available{' '}
            {new Date(c.refreshAfter).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
            .
          </small>
        )}
        {query.error ? (
          <ErrorBox message={errorMessage(query.error)} />
        ) : query.isLoading ? (
          <p>Loading professions...</p>
        ) : !query.data?.snapshot ? (
          <p>Not fetched yet. Recipes are unknown.</p>
        ) : query.data.snapshot.tiers.length === 0 ? (
          <p>No professions returned.</p>
        ) : (
          <div className="profs-tiers">
            {query.data.snapshot.tiers.map((t, i) => (
              <details key={`${t.professionId}:${t.tierId}:${i}`}>
                <summary>
                  <strong>{t.profession}</strong> · {t.expansion}
                  <span>
                    {t.skill ?? '?'} / {t.maxSkill ?? '?'} ·{' '}
                    {t.recipesAvailable ? `${t.recipes.length} recipes` : 'Recipes unavailable'}
                  </span>
                </summary>
                {!t.recipesAvailable ? (
                  <p className="profs-caption">Recipe data unavailable.</p>
                ) : t.recipes.length ? (
                  <ul>
                    {t.recipes.map((r) => (
                      <li key={r.id}>
                        <RecipeMaterials id={r.id} name={r.name} link />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profs-caption">No recipes reported.</p>
                )}
              </details>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Account({
  data,
  userId,
  act,
  busy,
}: {
  data: ProfessionDirectory;
  userId: string;
  act: (path: string, body?: unknown, method?: 'POST' | 'PUT') => Promise<void>;
  busy: boolean;
}) {
  const [discord, setDiscord] = useState(data.myProfile.discord);
  const [main, setMain] = useState(data.myProfile.mainCharacterId || '');
  const [claim, setClaim] = useState('');
  const [verified, setVerified] = useState(false);
  const own = data.characters.filter((c) => c.memberId === userId);
  function save(e: FormEvent) {
    e.preventDefault();
    void act('member', { discord, mainCharacterId: main || null }, 'PUT');
  }
  return (
    <div className="profs-account">
      <section className="profs-panel">
        <h2>Contact & main</h2>
        <p className="profs-caption">Visible to signed-in members.</p>
        <form onSubmit={save}>
          <Field label="Preferred Discord contact">
            <input
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              maxLength={100}
              placeholder="Discord username"
            />
          </Field>
          <Field label="Main character">
            <select value={main} onChange={(e) => setMain(e.target.value)}>
              <option value="">Not selected</option>
              {own.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  className="wow-character-name"
                  style={characterNameStyle(c.classId)}
                >
                  {identity(c)}
                </option>
              ))}
            </select>
          </Field>
          <button className="button primary" disabled={busy}>
            Save contact & main
          </button>
        </form>
      </section>
      <section className="profs-panel">
        <h2>Link a character</h2>
        <p className="profs-caption">An administrator verifies and approves each link.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act('claims', { characterId: claim });
          }}
        >
          <Field label="Character to link">
            <select value={claim} onChange={(e) => setClaim(e.target.value)} required>
              <option value="">Choose a roster character</option>
              {data.characters
                .filter((c) => !c.memberId)
                .map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    className="wow-character-name"
                    style={characterNameStyle(c.classId)}
                  >
                    {identity(c)}
                  </option>
                ))}
            </select>
          </Field>
          <button className="button secondary" disabled={!claim || busy}>
            Request administrator approval
          </button>
        </form>
        <div className="profs-modal-list">
          {data.claims
            .filter((c) => c.userId === userId)
            .map((c) => (
              <p key={c.id}>
                <CharacterName
                  name={c.characterName}
                  classId={data.characters.find((char) => char.id === c.characterId)?.classId}
                />{' '}
                · {c.status}
              </p>
            ))}
        </div>
      </section>
      {data.admin && (
        <section className="profs-panel profs-admin">
          <h2>Character link approvals</h2>
          <p className="profs-caption">Confirm ownership with the member before approving.</p>
          <label className="profs-verify">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{' '}
            I have independently verified ownership for the approval I am making.
          </label>
          {data.claims
            .filter((c) => c.status !== 'rejected')
            .map((c) => (
              <article className="profs-approval" key={c.id}>
                <span>
                  <strong>
                    <CharacterName
                      name={c.characterName}
                      classId={data.characters.find((char) => char.id === c.characterId)?.classId}
                    />
                  </strong>{' '}
                  → {c.username} · {c.status}
                </span>
                <div className="profs-actions">
                  {c.status === 'pending' && (
                    <button
                      className="button primary"
                      disabled={!verified || busy}
                      onClick={async () => {
                        await act(`claims/${c.id}`, { status: 'approved' }, 'PUT');
                        setVerified(false);
                      }}
                    >
                      Approve
                    </button>
                  )}
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => act(`claims/${c.id}`, { status: 'rejected' }, 'PUT')}
                  >
                    {c.status === 'approved' ? 'Revoke' : 'Reject'}
                  </button>
                </div>
              </article>
            ))}
          {!data.claims.some((c) => c.status === 'pending') && (
            <p className="profs-caption">No pending requests.</p>
          )}
        </section>
      )}
    </div>
  );
}
