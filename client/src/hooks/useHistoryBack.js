import { useEffect, useRef, useCallback } from 'react';

/**
 * Pushes a history entry on mount so the browser back button works.
 * Returns `goBack`: call it from in-app back buttons — it pops the
 * history entry AND calls onBack, keeping history in sync.
 */
export function useHistoryBack(onBack) {
  const cbRef   = useRef(onBack);
  const skipRef = useRef(false); // true when in-app button already handled it

  useEffect(() => { cbRef.current = onBack; });

  useEffect(() => {
    window.history.pushState({ _nav: Date.now() }, '');

    const handler = () => {
      if (skipRef.current) { skipRef.current = false; return; }
      cbRef.current();
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Use this for in-app back buttons instead of calling onBack directly.
  // Pops the history entry (so forward-button doesn't re-appear) then calls onBack.
  const goBack = useCallback(() => {
    skipRef.current = true;
    window.history.back(); // async, fires popstate — skipped via skipRef
    cbRef.current();
  }, []);

  return goBack;
}
