import { useCallback, useEffect, useRef, useState } from 'react';
import { readJSON, removeStored, writeJSON } from '@/lib/storage';

const RECENT_KEY = 'addon-recent-searches-v1';
const MAX_RECENT = 6;

export function readRecentSearches(): string[] {
  const value = readJSON<unknown>(RECENT_KEY, []);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, MAX_RECENT);
}

/** Newest first, no repeats (ignoring case), at most six. */
export function rememberSearch(query: string): void {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) return;
  const rest = readRecentSearches().filter((item) => item.toLowerCase() !== q.toLowerCase());
  writeJSON(RECENT_KEY, [q, ...rest].slice(0, MAX_RECENT));
}

export function clearRecentSearches(): void {
  removeStored(RECENT_KEY);
}

export function searchPath(query: string): string {
  return `/search?q=${encodeURIComponent(query.trim())}`;
}

/* ---- voice input ---- */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type VoiceState = 'idle' | 'listening' | 'error';

/**
 * Speech to text in Indian English, where the browser offers it (Chrome on Android does).
 * `supported` is false elsewhere: hide the microphone then. `onText` gets the words as they are heard;
 * `onDone` the final words once the shopper stops talking.
 */
export function useVoiceInput({ onText, onDone }: { onText: (text: string) => void; onDone: (text: string) => void }) {
  const [supported] = useState(() => recognitionClass() !== null);
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const handlers = useRef({ onText, onDone });
  useEffect(() => {
    handlers.current = { onText, onDone };
  });

  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Klass = recognitionClass();
    if (!Klass) return;
    recognition.current?.abort();
    const rec = new Klass();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? '';
        text += transcript;
        if (result?.isFinal) finalText = text;
      }
      handlers.current.onText(text.trim());
    };
    rec.onerror = (event) => {
      setState('error');
      setError(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in the browser settings, or type instead.'
          : event.error === 'no-speech'
            ? 'We did not hear anything. Try again, or type instead.'
            : 'Voice search stopped. Try again, or type instead.',
      );
    };
    rec.onend = () => {
      recognition.current = null;
      setState((now) => (now === 'error' ? now : 'idle'));
      if (finalText.trim()) handlers.current.onDone(finalText.trim());
    };
    recognition.current = rec;
    setError('');
    setState('listening');
    try {
      rec.start();
    } catch {
      setState('error');
      setError('Voice search could not start. Type instead.');
    }
  }, []);

  return { supported, state, error, start, stop };
}
