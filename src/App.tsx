import { useState, useEffect, useCallback } from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/react/lib/Dashboard';
import Tus from '@uppy/tus';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

type Stage = 'upload' | 'preview' | 'processing' | 'done' | 'error';

function createUppy() {
  return new Uppy({
    restrictions: {
      maxFileSize: 100 * 1024 * 1024,
      allowedFileTypes: ['image/*'],
      maxNumberOfFiles: 1,
    },
  }).use(Tus, {
    endpoint: '/api/tus/',
    parallelUploads: 5,
    retryDelays: [0, 1000, 3000, 5000, 10000],
  });
}

export default function App() {
  const [uppy] = useState(createUppy);
  const [stage, setStage] = useState<Stage>('upload');
  const [fileId, setFileId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [upscaledUrl, setUpscaledUrl] = useState('');
  const [error, setError] = useState('');
  const [scale, setScale] = useState(4);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const onSuccess = (file: any, response: any) => {
      const url: string = response.uploadURL;
      if (!url) return;
      setFileId(url.split('/').pop()!);
      if (file?.data) {
        setPreviewUrl(URL.createObjectURL(file.data as Blob));
      }
      setStage('preview');
    };

    const onError = (_file: any, err: Error) => {
      setError(err.message);
      setStage('error');
    };

    uppy.on('upload-success', onSuccess);
    uppy.on('upload-error', onError);
    return () => {
      uppy.off('upload-success', onSuccess);
      uppy.off('upload-error', onError);
    };
  }, [uppy]);

  const handleUpscale = useCallback(async () => {
    setStage('processing');
    setStatus('Uploading to AI service...');
    setError('');

    try {
      const res = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, scale }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const { taskId } = await res.json();
      setStatus('AI is upscaling your image...');

      const poll = async (): Promise<void> => {
        const r = await fetch(`/api/upscale/${taskId}`);
        const data = await r.json();
        const s = data.data?.status;

        if (s === 'completed' && data.data?.outputs?.length) {
          setUpscaledUrl(data.data.outputs[0]);
          setStage('done');
          return;
        }
        if (s === 'failed') {
          throw new Error(data.data?.error || 'Upscale failed');
        }

        setStatus(s === 'processing' ? 'AI is upscaling your image...' : 'Queued, waiting for GPU...');
        await new Promise((r) => setTimeout(r, 2000));
        return poll();
      };

      await poll();
    } catch (err: any) {
      setError(err.message);
      setStage('error');
    }
  }, [fileId, scale]);

  const reset = useCallback(() => {
    uppy.cancelAll();
    setStage('upload');
    setFileId('');
    setPreviewUrl('');
    setUpscaledUrl('');
    setError('');
    setStatus('');
  }, [uppy]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Image Upscaler</h1>
          <p className="mt-2 text-zinc-400">
            Resumable parallel-chunk upload &middot; AI upscaling via WaveSpeed
          </p>
        </header>

        {stage === 'upload' && (
          <Dashboard
            uppy={uppy}
            theme="dark"
            width="100%"
            height={420}
            proudlyDisplayPoweredByUppy={false}
            note="Images up to 100 MB. Drag & drop or browse."
          />
        )}

        {stage === 'preview' && (
          <div className="space-y-6">
            {previewUrl && (
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                <img src={previewUrl} alt="Preview" className="mx-auto max-h-[420px] object-contain" />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-zinc-400">Scale</label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
              <button
                onClick={handleUpscale}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium transition hover:bg-blue-500"
              >
                Upscale {scale}x
              </button>
              <button onClick={reset} className="ml-auto text-sm text-zinc-500 hover:text-zinc-300">
                Start over
              </button>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-700 border-t-blue-500" />
            <p className="text-zinc-400">{status}</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-500">Original</p>
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  <img src={previewUrl} alt="Original" className="w-full object-contain" />
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-500">Upscaled {scale}x</p>
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                  <img src={upscaledUrl} alt="Upscaled" className="w-full object-contain" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <a
                href={upscaledUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-medium transition hover:bg-emerald-500"
              >
                Download
              </a>
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm transition hover:bg-zinc-800"
              >
                Upload another
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24">
            <p className="text-red-400">{error}</p>
            <button
              onClick={reset}
              className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm transition hover:bg-zinc-800"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
