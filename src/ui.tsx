import { ReactNode, useEffect } from 'react';
import { clockError, fmtClock } from './rules';
import { nowHHMM } from './store';

export function Chips<T extends string | number>(props: {
  options: readonly T[];
  value: T | '' | undefined;
  onChange: (v: T | '') => void;
  render?: (v: T) => ReactNode;
  allowClear?: boolean;
  big?: boolean;
  label?: string;
}) {
  const { options, value, onChange, render, allowClear, big, label } = props;
  return (
    <div className={`chips${big ? ' big' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o)}
          className={`chip${o === value ? ' on' : ''}`}
          aria-pressed={o === value}
          onClick={() => onChange(allowClear && o === value ? '' : o)}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

export function Field(props: { label: string; children: ReactNode; hint?: ReactNode; error?: string }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      {props.children}
      {props.error ? <span className="field-error">{props.error}</span> : props.hint ? <span className="field-hint">{props.hint}</span> : null}
    </label>
  );
}

export function Group(props: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="group">
      <div className="group-label">
        <span>{props.label}</span>
        {props.aside}
      </div>
      {props.children}
    </div>
  );
}

export function ClockInput(props: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <input
      id={props.id}
      className="clock"
      inputMode="numeric"
      autoComplete="off"
      placeholder="mm:ss"
      value={props.value}
      onChange={(e) => props.onChange(fmtClock(e.target.value))}
      aria-invalid={!!clockError(props.value)}
    />
  );
}

export function WallTimeInput(props: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="walltime">
      <input aria-label={props.label} placeholder="7:00 PM" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      <button type="button" className="btn small ghost" onClick={() => props.onChange(nowHHMM())}>
        Now
      </button>
    </div>
  );
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [props.onClose]);
  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <button type="button" className="btn ghost" onClick={props.onClose}>
            Cancel
          </button>
          <h2>{props.title}</h2>
          <span className="spacer" />
        </header>
        <div className="modal-body">{props.children}</div>
        {props.footer && <footer className="modal-foot">{props.footer}</footer>}
      </div>
    </div>
  );
}
