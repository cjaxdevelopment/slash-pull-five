import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  composition,
  expandSharedRaid,
  specFor,
  type SharedRaid,
  type Assignment,
} from '@spf/shared';
import BuffCoverage, { GroupBuffs } from '../BuffCoverage';
import { ErrorBox, CharacterIdentity, classStyle } from '../ui';
import { ThemeToggle } from '../theme';
import { readRaidLink } from '../sharing';
export default function SharedRaidPage() {
  const [snapshot, setSnapshot] = useState<SharedRaid>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    readRaidLink(location.hash)
      .then((s) => {
        if (live) setSnapshot(s);
      })
      .catch(() => {
        if (live) setError('This raid link is invalid, too large, or uses unsupported rules.');
      });
    return () => {
      live = false;
    };
  }, []);
  const raid = snapshot ? expandSharedRaid(snapshot) : null,
    coverage = raid ? composition(raid.plan, raid.characters) : null;
  function card(a: Assignment) {
    const c = raid!.characters.find((c) => c.id === a.characterId)!;
    return (
      <div className="shared-character class-identity" style={classStyle(c.class)}>
        <CharacterIdentity
          name={c.name}
          cls={c.class}
          role={c.role}
          spec={specFor(c.class, c.spec)?.name || 'Custom'}
        />
      </div>
    );
  }
  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            Rewound
          </Link>
          <span className="shared-label">Read-only snapshot</span>
          <div className="header-account">
            <ThemeToggle />
            <Link className="text-link" to="/">
              Open planner
            </Link>
          </div>
        </div>
      </header>
      <main className="main-shell main-content shared-raid">
        {error ? (
          <ErrorBox message={error} />
        ) : raid ? (
          <>
            <div className="raid-toolbar">
              <h1>{raid.plan.name}</h1>
              <span className="raid-capacity">
                {coverage!.total}/{raid.plan.capacity}
              </span>
            </div>
            <section className="composition-groups" aria-label="Raid groups">
              {Array.from({ length: raid.plan.capacity / 5 }, (_, i) => i + 1).map((group) => (
                <section className="comp-group panel" aria-label={'Group ' + group} key={group}>
                  <header>
                    <h2>Group {group}</h2>
                    <span>
                      {
                        raid.plan.assignments.filter(
                          (a) => a.group === group && a.status === 'lineup',
                        ).length
                      }
                      /5
                    </span>
                  </header>
                  <GroupBuffs data={coverage!} group={group} />
                  <div className="group-characters">
                    {[1, 2, 3, 4, 5].map((slot) => {
                      const a = raid.plan.assignments.find(
                        (a) => a.status === 'lineup' && a.group === group && a.slot === slot,
                      );
                      return a ? (
                        <div key={slot}>{card(a)}</div>
                      ) : (
                        <div className="empty-slot" key={slot} />
                      );
                    })}
                  </div>
                </section>
              ))}
            </section>
            {['lineup', 'bench'].map((status) => {
              const rows = raid.plan.assignments.filter((a) =>
                status === 'bench'
                  ? a.status === 'bench'
                  : a.status === 'lineup' && a.group === null,
              );
              return rows.length ? (
                <section className="comp-bench panel" key={status}>
                  <header>
                    <h2>
                      {status === 'bench' ? 'Bench' : 'Unassigned'} <span>{rows.length}</span>
                    </h2>
                  </header>
                  <div className="bench-characters">
                    {rows.map((a) => (
                      <div key={a.id}>{card(a)}</div>
                    ))}
                  </div>
                </section>
              ) : null;
            })}
            <BuffCoverage data={coverage!} />
          </>
        ) : (
          <p className="muted">Loading raid...</p>
        )}
      </main>
    </>
  );
}
