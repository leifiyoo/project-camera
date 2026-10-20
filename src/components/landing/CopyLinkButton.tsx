'use client';
import { useState } from 'react';
import { Check, Copy } from '@/components/ui/studio-icons';

/** Copies the page address, so a visitor on a phone can open the studio on a computer. */
export function CopyLinkButton() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return (
    <>
      <button type="button" className="lp-copy" onClick={() => void copy()}>
        {status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
        {status === 'copied' ? 'Link copied' : 'Copy link'}
      </button>
      <p className="lp-copy-status" role="status">
        {status === 'copied'
          ? 'Open it on your computer to start.'
          : status === 'failed'
            ? `Copy this address instead: ${window.location.href}`
            : ''}
      </p>
    </>
  );
}
