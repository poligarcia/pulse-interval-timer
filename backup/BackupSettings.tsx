'use client';
import { useRef, useState } from 'react';
import { createBackup, prepareImport, restoreBackup, MAX_BACKUP_BYTES } from './backup';
import type { AppState, ImportPlan } from './backup';
import { saveBackupFile } from './files';
import type { SavePicker } from './files';
import { backupCopy } from './copy';
import { urlWithLocale } from '../i18n/locales';
import type { Locale } from '../i18n/locales';

export function BackupSettings({ state, locale, disabled }: { state: AppState; locale: Locale; disabled: boolean }) {
  const copy = backupCopy[locale];
  const fieldName = (path: string) => path.replace(/[a-zA-Z]+/g, key => copy.fields[key as keyof typeof copy.fields] ?? key).replace(/\[(\d+)\]/g, (_, index) => ` ${Number(index) + 1}`).replaceAll('.', ' · ');
  const displayValue = (value: unknown) => value === undefined ? copy.missing : JSON.stringify(value).slice(0, 160);
  const input = useRef<HTMLInputElement>(null);
  const review = useRef<HTMLHeadingElement>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const showError = (error: unknown) => {
    const key = error instanceof Error ? error.message : 'other';
    setError(Object.hasOwn(copy.errors, key) ? copy.errors[key as keyof typeof copy.errors] : copy.errors.other);
  };
  async function exportFile() {
    setBusy(true); setError(''); setMessage('');
    try {
      const json = JSON.stringify(createBackup(state, window.localStorage), null, 2);
      if (new Blob([json]).size > MAX_BACKUP_BYTES) throw new Error('size');
      const picker = (window as Window & { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
      const result = await saveBackupFile(json, picker?.bind(window));
      if (result !== 'cancelled') setMessage(result === 'saved' ? copy.saved : copy.downloaded);
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }
  async function readFile(file?: File) {
    if (!file || disabled) return;
    setBusy(true); setPlan(null); setError(''); setMessage('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('size');
      const voices = window.speechSynthesis?.getVoices().map(voice => voice.voiceURI) ?? [];
      const next = prepareImport(await file.text(), voices);
      setPlan(next);
      requestAnimationFrame(() => review.current?.focus());
    } catch (error) { showError(error); }
    finally { setBusy(false); }
  }
  function restore() {
    if (!plan || disabled || busy) return;
    setBusy(true); setError('');
    try {
      restoreBackup(window.localStorage, plan.backup);
      window.location.replace(urlWithLocale(window.location.href, plan.backup.state.locale));
    } catch (error) { showError(error); setBusy(false); }
  }
  return <div className="settings-group backup-settings">
    <p className="settings-kicker">{copy.title}</p>
    <p className="setting-note">{copy.intro}</p>
    <button type="button" className="setting-row setting-action" disabled={disabled || busy} onClick={exportFile}><strong>{copy.export}</strong><span aria-hidden="true">↓</span></button>
    <button type="button" className="setting-row setting-action" disabled={disabled || busy} onClick={() => input.current?.click()}><strong>{copy.upload}</strong><span aria-hidden="true">↑</span></button>
    <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => { void readFile(event.target.files?.[0]); event.target.value = ''; }} />
    <p className="setting-note">{copy.note}</p>
    {disabled && <p className="setting-note">{copy.busy}</p>}
    {message && <p className="setting-note" role="status">{message}</p>}
    {error && <p className="setting-note" role="alert">{error}</p>}
    {plan && <section className="backup-review" aria-labelledby="backup-review-title">
      <h3 id="backup-review-title" ref={review} tabIndex={-1}>{copy.review}</h3>
      <p>{copy.counts(plan.backup.state.timers.length, plan.backup.state.workoutSessions.length)}</p>
      <p>{new Date(plan.backup.exportedAt).toLocaleString(locale)}</p>
      <p>{copy.replace}</p>
      {plan.issues.length ? <ul>{plan.issues.map((issue, index) => <li key={index}>{copy.issues[issue.kind]}: <strong>{fieldName(issue.path)}</strong>{(issue.kind === 'changed' || issue.kind === 'defaults') && <div>{displayValue(issue.before)} → {displayValue(issue.after)}</div>}</li>)}</ul> : <p>{copy.ready}</p>}
      <div className="backup-actions">
        <button type="button" className="text-button" disabled={busy} onClick={() => { setPlan(null); setError(''); }}>{copy.cancel}</button>
        <button type="button" className="text-button accent" disabled={disabled || busy} onClick={restore}>{plan.issues.length ? copy.partial : copy.proceed}</button>
      </div>
    </section>}
  </div>;
}
