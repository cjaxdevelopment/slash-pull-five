import { createElement, useEffect, useRef, type ReactNode } from 'react';

declare global {
  interface Window {
    whTooltips?: {
      colorLinks: boolean;
      iconizeLinks: boolean;
      renameLinks: boolean;
      iconSize: string;
    };
    $WowheadPower?: { refreshLinks: (force?: boolean) => void };
  }
}
let loading: Promise<void> | undefined;
function loadTooltips() {
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      window.whTooltips = {
        colorLinks: true,
        iconizeLinks: true,
        renameLinks: false,
        iconSize: 'large',
      };
      const script = document.createElement('script');
      script.src = 'https://wow.zamimg.com/js/tooltips.js';
      script.async = true;
      script.id = 'wowhead-tooltips';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        loading = undefined;
        reject(new Error('Tooltip service unavailable'));
      };
      document.head.append(script);
    });
  return loading;
}
export function useWowheadTooltips(contentKey: string) {
  useEffect(() => {
    let current = true;
    const moved = new Set<HTMLElement>();
    // Native dialogs live above document.body. Keep the widget in that same top layer.
    const positionTooltips = () => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (dialog) {
        const nodes = document.querySelectorAll<HTMLElement>('.wowhead-tooltip, body > .iconlarge');
        for (const node of nodes) {
          if (!dialog.contains(node)) dialog.append(node);
          moved.add(node);
          node.classList.add('profs-dialog-tooltip');
          const offset = `${window.scrollY}px`;
          if (node.style.getPropertyValue('--profs-tooltip-scroll') !== offset)
            node.style.setProperty('--profs-tooltip-scroll', offset);
        }
      } else {
        for (const node of moved) {
          node.classList.remove('profs-dialog-tooltip');
          node.style.removeProperty('--profs-tooltip-scroll');
          document.body.append(node);
        }
        moved.clear();
      }
    };
    const observer = new MutationObserver(positionTooltips);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open', 'style'],
    });
    window.addEventListener('scroll', positionTooltips, { passive: true });
    positionTooltips();
    // Links remain usable when Wowhead is unavailable or blocked by the visitor.
    void loadTooltips()
      .then(() => {
        if (current) window.$WowheadPower?.refreshLinks();
      })
      .catch(() => {});
    return () => {
      current = false;
      observer.disconnect();
      window.removeEventListener('scroll', positionTooltips);
      for (const node of moved) {
        node.classList.remove('profs-dialog-tooltip');
        node.style.removeProperty('--profs-tooltip-scroll');
        document.body.append(node);
      }
    };
  }, [contentKey]);
}
export function wowheadLink(gameVersion: string, name: string, itemId?: number) {
  if (gameVersion === 'retail' && itemId) return `https://www.wowhead.com/item=${itemId}`;
  return `https://www.wowhead.com/search?q=${encodeURIComponent(name)}`;
}

// Wowhead adds icon nodes and quality classes to anchors. Give it an isolated
// DOM subtree so React never reconciles the third-party children.
export function WowheadItemLink({
  gameVersion,
  name,
  itemId,
  fallback,
  description,
  onInspect,
}: {
  gameVersion: string;
  name: string;
  itemId?: number;
  fallback: ReactNode;
  description?: ReactNode;
  onInspect?: () => void;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const inspect = useRef(onInspect);
  inspect.current = onInspect;
  const inspectable = Boolean(onInspect);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let current = true;
    const link = document.createElement('a');
    link.href = inspectable ? '#' : wowheadLink(gameVersion, name, itemId);
    if (inspectable) {
      link.setAttribute('role', 'button');
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', (e) => {
        e.preventDefault();
        inspect.current?.();
      });
      link.addEventListener('auxclick', (e) => e.preventDefault());
      link.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          inspect.current?.();
        }
      });
    } else {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    link.textContent = name;
    if (gameVersion === 'retail' && itemId) {
      link.dataset.wowhead = `item=${itemId}`;
      link.dataset.whIconSize = 'large';
    }
    root.replaceChildren(link);
    void loadTooltips()
      .then(() => {
        if (current) window.$WowheadPower?.refreshLinks();
      })
      .catch(() => {});
    return () => {
      current = false;
      root.replaceChildren();
    };
  }, [gameVersion, name, itemId, inspectable]);
  return createElement(
    'span',
    { className: `profs-wowhead-item${description ? ' profs-wowhead-item-detailed' : ''}` },
    createElement(
      'a',
      {
        className: 'profs-wowhead-fallback',
        href: inspectable ? '#' : wowheadLink(gameVersion, name, itemId),
        target: inspectable ? undefined : '_blank',
        rel: 'noopener noreferrer',
        role: inspectable ? 'button' : undefined,
        'aria-haspopup': inspectable ? 'dialog' : undefined,
        'aria-label': inspectable ? `Crafters for ${name} (icon)` : `View ${name} on Wowhead`,
        onClick: onInspect
          ? (e: React.MouseEvent) => {
              e.preventDefault();
              onInspect();
            }
          : undefined,
        onAuxClick: onInspect ? (e: React.MouseEvent) => e.preventDefault() : undefined,
        onKeyDown: onInspect
          ? (e: React.KeyboardEvent) => {
              if (e.key === ' ') {
                e.preventDefault();
                onInspect();
              }
            }
          : undefined,
        'data-wh-iconize-link': 'false',
        'data-wh-rename-link': 'false',
        'data-wowhead': gameVersion === 'retail' && itemId ? `item=${itemId}` : undefined,
      },
      fallback,
    ),
    createElement(
      'span',
      { className: 'profs-wowhead-title-line' },
      createElement('span', { className: 'profs-wowhead-widget', ref: host }),
      onInspect &&
        createElement(
          'a',
          {
            className: 'profs-wowhead-external',
            href: wowheadLink(gameVersion, name, itemId),
            target: '_blank',
            rel: 'noopener noreferrer',
            title: 'Open on Wowhead',
            'aria-label': `View ${name} on Wowhead`,
            'data-wh-iconize-link': 'false',
            'data-wh-rename-link': 'false',
          },
          createElement('img', { src: '/wowhead-rocket.png', width: 16, height: 16, alt: '' }),
        ),
    ),
    description && createElement('span', { className: 'profs-wowhead-description' }, description),
  );
}
