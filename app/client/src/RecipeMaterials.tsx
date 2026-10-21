import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecipeMaterialsQuery } from './api';
import { wowheadLink } from './wowhead';

export default function RecipeMaterials({
  id,
  name,
  link = false,
}: {
  id: number;
  name: string;
  link?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({
    left: 0,
    top: 0,
  });
  const host = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const tooltipId = useId();
  const [ready, setReady] = useState(false);
  const query = useRecipeMaterialsQuery(id, {
    skip: !open,
    pollingInterval: open && !ready ? 2500 : 0,
  });
  // The first response may still be waiting for the existing metadata worker.
  useEffect(
    () => setReady(Boolean(query.data?.ready || query.data?.unavailable || query.error)),
    [query.data?.ready, query.data?.unavailable, query.error],
  );
  function show() {
    clearTimeout(timer.current);
    const rect = host.current?.getBoundingClientRect();
    if (!rect) return;
    const below = innerHeight - rect.bottom;
    setPosition({
      left: Math.max(10, Math.min(rect.left, innerWidth - Math.min(320, innerWidth - 20) - 10)),
      ...(below >= Math.min(330, innerHeight * 0.45) || below >= rect.top
        ? { top: rect.bottom + 8 }
        : { bottom: innerHeight - rect.top + 8 }),
    });
    setOpen(true);
  }
  function hide() {
    timer.current = setTimeout(() => setOpen(false), 140);
  }
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) close();
    };
    const outside = (event: PointerEvent) => {
      if (
        !host.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const props = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: () => setOpen(false),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    },
    'aria-describedby': open ? tooltipId : undefined,
  };
  return (
    <span className={link ? 'profs-character-recipe-link' : 'profs-materials'} ref={host}>
      {link ? (
        <a
          {...props}
          href={wowheadLink(query.data?.gameVersion || '', name, query.data?.items[0]?.id)}
          target="_blank"
          rel="noopener noreferrer"
          data-wh-iconize-link="false"
        >
          {name}
          <img src="/wowhead-rocket.png" width="12" height="12" alt=" (Wowhead)" />
        </a>
      ) : (
        <button
          {...props}
          type="button"
          className="profs-materials-button"
          aria-label={`Materials for ${name}`}
          onClick={show}
        >
          Materials
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={popup}
            id={tooltipId}
            role="tooltip"
            className="profs-materials-tooltip"
            style={position}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={hide}
          >
            <strong>{name}</strong>
            <span className="profs-materials-label">Required reagents</span>
            {query.error || query.data?.unavailable ? (
              <p>Materials unavailable. Try again shortly.</p>
            ) : !query.data?.ready ? (
              <p>Loading materials…</p>
            ) : (
              <>
                {query.data.reagents?.length ? (
                  <ul>
                    {query.data.reagents.map((r, index) => (
                      <li key={`${r.id}:${index}`}>
                        <span>{r.name}</span>
                        <b>{r.quantity === null ? '?' : `× ${r.quantity}`}</b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {query.data.reagents === null
                      ? 'Reagent details unavailable.'
                      : 'No reagents reported.'}
                  </p>
                )}
                {query.data.modifiedReagents && (
                  <p>
                    Additional reagent choices may be required. Check Wowhead for the full recipe.
                  </p>
                )}
              </>
            )}
          </div>,
          host.current?.closest('dialog') || document.body,
        )}
    </span>
  );
}
