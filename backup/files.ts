export type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }> }>;

export async function saveBackupFile(json: string, picker?: SavePicker): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const name = `laptiva-backup-${new Date().toISOString().replaceAll(':', '-')}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: 'Laptiva JSON', accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      try { await writable.write(blob); await writable.close(); }
      catch (error) { await writable.abort().catch(() => undefined); throw error; }
      return 'saved';
    } catch (error) { if (error instanceof Error && error.name === 'AbortError') return 'cancelled'; throw error; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
