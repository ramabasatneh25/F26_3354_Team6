import { useEffect, useRef, useState } from 'react';

/**
 * FR-6 / UC-1 A1 crisis alert.
 *
 * The Safety NFR requires an unskippable message listing emergency services
 * and phone numbers whenever a check-in crosses the threshold. "Unskippable"
 * is implemented literally: there is no close button, Escape does nothing,
 * clicking the backdrop does nothing, and focus is trapped inside the dialog.
 * The only way out is the acknowledgement button, which is disabled for a
 * short beat so the numbers are actually read.
 *
 * The copy never tells a student they do or do not need professional care -
 * the Legislative-Safety NFR requires ClearMind to be clear that it is a
 * wellness tool and not a replacement for emergency services.
 */
export default function CrisisOverlay({ reasons = [], resources = [], onAcknowledge }) {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const dialogRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    document.body.style.overflow = 'hidden';

    // Trap focus and swallow Escape - this dialog cannot be dismissed.
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-signal-deep/95 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="crisis-heading"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg bg-surface p-6 shadow-2xl sm:p-8"
      >
        <h2 id="crisis-heading" className="text-3xl text-signal">
          Before you go, please read this
        </h2>

        <p className="mt-3 max-w-reading text-ink">
          {reasons.length
            ? `You told us ${reasons.join(' and ')}. `
            : 'This check-in crossed the threshold we watch for. '}
          Support is available right now, and it is free.
        </p>

        <ul className="mt-6 divide-y divide-line border-y border-line">
          {resources.map((resource) => (
            <li key={resource.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
              <a
                href={resource.action}
                className="font-display text-2xl text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
              >
                {resource.hotlineNumber}
              </a>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{resource.title}</p>
                <p className="text-sm text-muted">{resource.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 max-w-reading text-sm text-muted">
          ClearMind is a wellness tool, not a medical service or an emergency responder. If you are
          in immediate danger, call 911.
        </p>

        <button
          type="button"
          onClick={onAcknowledge}
          disabled={secondsLeft > 0}
          className="mt-6 w-full rounded bg-signal px-4 py-3 font-medium text-white transition-colors hover:bg-signal-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {secondsLeft > 0
            ? `Continue in ${secondsLeft}`
            : 'I have read this, continue to my feedback'}
        </button>
      </div>
    </div>
  );
}
