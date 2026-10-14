import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { HttpError } from '@/lib/http';
import { searchOff } from './openFoodFacts';
import { mergeHits, searchLocal, type ResultSection } from './searchService';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Below this many local hits the online search starts automatically. */
const AUTO_ONLINE_THRESHOLD = 8;

/**
 * Instant offline results on every keystroke; Open Food Facts is queried after a pause when local
 * results are thin, or on demand. OFF limits searches per minute, hence debounce + opt-in.
 */
export function useFoodSearch(query: string) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'de';
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, 700);
  const [forcedOnline, setForcedOnline] = useState<string | null>(null);

  const local = useMemo<ResultSection[]>(
    () => (trimmed.length >= 2 ? searchLocal(trimmed, t('food.onePortion')) : []),
    [trimmed, t],
  );
  const localCount = local.reduce((s, sec) => s + sec.hits.length, 0);

  const wantOnline =
    debounced.length >= 3 && (localCount < AUTO_ONLINE_THRESHOLD || forcedOnline === debounced);
  const online = useQuery({
    queryKey: ['offSearch', lang, debounced],
    queryFn: ({ signal }) => searchOff(debounced, lang, signal),
    enabled: wantOnline,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const sections = useMemo<ResultSection[]>(() => {
    const known = local.flatMap((s) => s.hits);
    const onlineHits = (online.data ?? []).map((food, i) => ({ food, score: 1 - i / 100 }));
    const fresh = mergeHits(known, onlineHits).slice(known.length);
    return [...local, { key: 'online', hits: fresh }];
  }, [local, online.data]);

  return {
    sections,
    localCount,
    online: {
      enabled: wantOnline,
      loading: wantOnline && online.isFetching,
      error: online.error instanceof HttpError ? online.error.kind : online.error ? 'server' : null,
      /** Offer a manual online search when it did not start automatically. */
      canRequest: !wantOnline && trimmed.length >= 3,
      request: () => setForcedOnline(trimmed),
    },
  };
}
