import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { X, Shield, Heart, Swords, WandSparkles } from 'lucide-react';
import { classColors, label, type Character, type CharacterClass, type Role } from '@spf/shared';
export const classTextColors: Record<CharacterClass, string> = {
  druid: '#b45309',
  hunter: '#3f6212',
  mage: '#0369a1',
  paladin: '#9d174d',
  priest: '#4b5563',
  rogue: '#854d0e',
  shaman: '#1d4ed8',
  warlock: '#6d28d9',
  warrior: '#78350f',
};
export const classStyle = (cls: CharacterClass): CSSProperties =>
  ({
    '--class-color': classColors[cls],
    '--class-ink': classTextColors[cls],
    borderLeftColor: classColors[cls],
  }) as CSSProperties;
export function ClassName({ cls }: { cls: CharacterClass }) {
  return (
    <span className="class-name" style={classStyle(cls)}>
      {label(cls)}
    </span>
  );
}
export function CharacterIdentity({
  name,
  cls,
  spec,
  role,
}: {
  name: string;
  cls: CharacterClass;
  spec?: string;
  role: Role;
}) {
  return (
    <span className="character-identity">
      <strong className="character-name">{name}</strong>
      <span className="character-meta">
        <span className="character-class">
          <RoleIcon role={role} size={13} />
          {label(cls)}
        </span>
        {spec && <span className="character-spec">{spec}</span>}
      </span>
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal modal-wide' : 'modal'}
      aria-labelledby={heading}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={heading}>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label: text,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children) ? children : null;
  const id = control?.props.id || generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      {control ? cloneElement(control, { id }) : children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
export function RoleIcon({ role, size = 16 }: { role: Role; size?: number }) {
  const Icon = { tank: Shield, healer: Heart, melee: Swords, ranged: WandSparkles }[role];
  return <Icon size={size} aria-hidden="true" />;
}
export function ClassMark({ character, small = false }: { character: Character; small?: boolean }) {
  return (
    <span
      className={`class-mark ${small ? 'small' : ''}`}
      style={
        {
          '--class-color': classColors[character.class],
          color: `var(--class-label, ${classTextColors[character.class]})`,
          borderColor: `${classColors[character.class]}55`,
          background: `${classColors[character.class]}0e`,
        } as CSSProperties
      }
      title={label(character.class)}
    >
      {label(character.class).slice(0, 2)}
    </span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error" role="alert">
      {message}
    </div>
  );
}
