'use client';

import { useActionState, useState } from 'react';
import { saveDraftAction, type DraftState } from '@/lib/server/staff-actions';
import { STAFF_ERRORS } from '@/lib/staff-text';

/** M13-AC-2.1 / 2.2 · Edit an item as JSON; a refused draft keeps the text and lists the reasons. */
export function DraftEditor({ kind, itemKey, initial }: { kind: string; itemKey?: string; initial: string }) {
  const [state, action, pending] = useActionState<DraftState, FormData>(saveDraftAction, {});
  // Controlled, because React resets uncontrolled fields after a form action and a refused draft must keep its text.
  const [data, setData] = useState(initial);
  const [note, setNote] = useState('');
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {itemKey && <input type="hidden" name="key" value={itemKey} />}
      {state.error && (
        <div role="alert" data-testid="draft-error" className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-semibold text-coral-700">
          <p>{STAFF_ERRORS[state.error] ?? 'The draft was not saved.'}</p>
          {state.details && state.details.length > 0 && (
            <ul className="mt-2 list-disc ps-6 font-mono text-[0.8125rem]">
              {state.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="data">
          Item (JSON)
        </label>
        <textarea id="data" name="data" className="field-input min-h-96 font-mono text-[0.8125rem]" value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} dir="ltr" />
      </div>
      <div>
        <label className="field-label" htmlFor="note">
          What changed and why (shown in the history)
        </label>
        <input id="note" name="note" className="field-input" maxLength={500} required value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary disabled:opacity-60" disabled={pending}>
        {pending ? 'Saving…' : 'Save as draft'}
      </button>
    </form>
  );
}
