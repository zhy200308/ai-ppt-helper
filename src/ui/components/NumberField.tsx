import { useEffect, useRef, useState } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function NumberField({ label, value, onChange, step = 1, min, max }: Props) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(roundOut(value)));
  }, [value]);

  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (Number.isFinite(v)) {
      let next = v;
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(next);
    } else {
      setText(String(value));
    }
  };

  return (
    <label className="number-field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        step={step}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commit(text); }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = (parseFloat(text) || 0) + (e.shiftKey ? step * 10 : step);
            setText(String(next));
            onChange(next);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (parseFloat(text) || 0) - (e.shiftKey ? step * 10 : step);
            setText(String(next));
            onChange(next);
          }
        }}
      />
    </label>
  );
}

function roundOut(v: number) {
  return Math.round(v * 100) / 100;
}
