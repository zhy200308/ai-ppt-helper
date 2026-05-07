interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorField({ label, value, onChange }: Props) {
  return (
    <label className="color-field">
      <span className="field-label">{label}</span>
      <span className="color-control">
        <input
          type="color"
          value={normalize(value)}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      </span>
    </label>
  );
}

function normalize(v: string) {
  if (!v) return '#000000';
  if (v.startsWith('#') && (v.length === 7 || v.length === 4)) return v;
  return '#000000';
}
