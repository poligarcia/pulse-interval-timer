'use client';

import { BRAND_NAME } from '../../branding.ts';
import type { ModelController } from '../model/model-controller.ts';
import {
  MENTRIA_QUOTES_ADAPTER_SIZE_BYTES,
  MENTRIA_TEXT_MODEL_SIZE_BYTES,
} from '../model/config.ts';
import type { MentriaStatus } from '../types.ts';

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1_048_576)} MB`;
}

function statusCopy(status: MentriaStatus): string {
  switch (status.kind) {
    case 'unsupported': return status.reason;
    case 'idle': return status.cached ? 'Model assets are cached on this device but the engine is unloaded.' : 'The local model has not been downloaded.';
    case 'awaiting-consent': return 'Waiting for your download choice.';
    case 'loading-runtime': return 'Loading the pinned local runtime…';
    case 'downloading': return status.message || 'Downloading model assets…';
    case 'compiling': return status.message || 'Preparing the model on this GPU…';
    case 'ready': return `${status.adapter === 'quotes' ? 'Quote LoRA' : 'Base model'} ready.`;
    case 'generating': return 'Generating locally on this device…';
    case 'error': return status.message;
  }
}

export function ModelManager({ controller, status }: { controller: ModelController; status: MentriaStatus }) {
  const busy = ['loading-runtime', 'downloading', 'compiling', 'generating'].includes(status.kind);
  const percentage = status.kind === 'downloading' && status.total
    ? Math.round((status.loaded / status.total) * 100)
    : null;

  const deleteModel = async () => {
    if (!window.confirm(`Delete only the model and adapter assets owned by ${BRAND_NAME} Labs? Timers, settings, candidates, and the offline app shell will stay.`)) return;
    await controller.deleteModel();
  };

  return (
    <section className="labs-panel" aria-labelledby="model-manager-title">
      <div className="labs-panel-heading">
        <div><p className="eyebrow">LOCAL MODEL</p><h2 id="model-manager-title">Model manager</h2></div>
        <span className={`labs-status-chip status-${status.kind}`}>{status.kind.replace('-', ' ')}</span>
      </div>
      <p className="labs-status-copy" role="status" aria-live="polite">{statusCopy(status)}</p>

      {status.kind === 'unsupported' && (
        <p className="labs-note">Phrase preview still works with this device&apos;s system voices. {BRAND_NAME} timers do not require WebGPU.</p>
      )}

      {status.kind === 'awaiting-consent' && (
        <div className="labs-consent" role="group" aria-labelledby="model-consent-title">
          <h3 id="model-consent-title">Download the text model?</h3>
          <p>The pinned Mentria Qwen3.5 0.8B text model is approximately <strong>{formatMegabytes(MENTRIA_TEXT_MODEL_SIZE_BYTES)}</strong>. It is cached locally after download. No vision assets are included.</p>
          <p>The experimental quote LoRA is a separate optional <strong>{formatMegabytes(MENTRIA_QUOTES_ADAPTER_SIZE_BYTES)}</strong> download and asks again before it is fetched.</p>
          <div className="labs-actions">
            <button className="labs-primary-button" onClick={() => { void controller.approveLoad(); }}>Download and load</button>
            <button className="labs-secondary-button" onClick={() => controller.declineLoad()}>Not now</button>
          </div>
        </div>
      )}

      {status.kind === 'downloading' && (
        <progress className="labs-progress" max={status.total ?? undefined} value={status.total ? status.loaded : undefined} aria-label="Model download progress">
          {percentage === null ? 'Downloading' : `${percentage}%`}
        </progress>
      )}

      <div className="labs-actions">
        {(status.kind === 'idle' || status.kind === 'error') && (
          <button className="labs-primary-button" onClick={() => controller.requestLoad()}>
            {status.kind === 'idle' && status.cached ? 'Load cached model' : status.kind === 'error' ? 'Retry model load' : 'Load model'}
          </button>
        )}
        {(status.kind === 'ready' || status.kind === 'generating') && (
          <button className="labs-secondary-button" disabled={status.kind === 'generating'} onClick={() => { void controller.unload(); }}>Unload engine</button>
        )}
        {status.kind !== 'unsupported' && (
          <button className="labs-danger-button" disabled={busy} onClick={() => { void deleteModel(); }}>Delete model</button>
        )}
      </div>
      <p className="labs-fine-print">Mentria supplies the open-source browser runtime and model bundle. Mentria does not sponsor or endorse {BRAND_NAME}. Generation stays in this browser after the pinned assets are retrieved.</p>
    </section>
  );
}
