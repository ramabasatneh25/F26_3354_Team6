/**
 * The 1-10 scale used for mood and stress.
 *
 * This is the control students touch every day, so it gets the weight: the
 * current value is set large in the display face, and the two ends are named
 * in plain words rather than left as bare numbers. Usability NFR: a check-in
 * should be completable in under three minutes with no instructions.
 */
export default function Scale({ id, label, value, onChange, lowLabel, highLabel, tint = 'moss' }) {
  const tints = {
    moss: { text: 'text-moss-deep', fill: '#2F6F5E' },
    mulberry: { text: 'text-mulberry', fill: '#7A3A58' },
  };
  const { text, fill } = tints[tint];

  // Paint the filled portion of the track up to the current value.
  const pct = ((value - 1) / 9) * 100;
  const trackStyle = {
    background: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, #D7DEDC ${pct}%, #D7DEDC 100%)`,
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-lg font-medium">
          {label}
        </label>
        <output htmlFor={id} className={`font-display text-5xl leading-none ${text}`}>
          {value}
        </output>
      </div>

      <input
        id={id}
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        style={trackStyle}
        onChange={(event) => onChange(Number(event.target.value))}
        className="scale-input mt-4"
        aria-describedby={`${id}-ends`}
      />

      <div id={`${id}-ends`} className="mt-2 flex justify-between text-sm text-muted">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
