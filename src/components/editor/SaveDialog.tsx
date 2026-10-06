'use client';
import { useState, type FormEvent } from 'react';
import { Dialog } from 'radix-ui';

/**
 * Asks before work is lost. `leave` offers Save / Don't save when switching away from
 * unsaved work; `name` names a project the first time it is saved to Projects.
 */
export default function SaveDialog({
  kind,
  name: initialName,
  stored,
  onSave,
  onDiscard,
  onCancel,
}: {
  kind: 'leave' | 'name';
  name: string;
  stored: boolean;
  onSave: (name: string) => Promise<boolean>;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const title = kind === 'name' ? 'Save to Projects' : 'Save your changes?';
  const note =
    kind === 'name'
      ? 'Give your project a name. You can open it again from Projects at any time.'
      : stored
        ? `“${initialName}” has changes that are not saved yet.`
        : 'This project is not in Projects yet. Save it to keep working on it later.';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    if (!(await onSave(name.trim()))) setBusy(false);
  };
  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-shade panel-shade" />
        <Dialog.Content className="panel save-dialog" data-centered aria-describedby="save-note">
          <form onSubmit={submit}>
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <p id="save-note" className="panel-note">
              {note}
            </p>
            {!stored && (
              <label className="field save-dialog-name">
                <span>Project name</span>
                <input
                  autoFocus
                  value={name}
                  maxLength={120}
                  spellCheck={false}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <div className="save-dialog-actions">
              {kind === 'leave' && (
                <button type="button" className="text-button" disabled={busy} onClick={onDiscard}>
                  Don’t save
                </button>
              )}
              <button type="button" className="secondary" disabled={busy} onClick={onCancel}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={busy || !name.trim()}
                autoFocus={stored}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
