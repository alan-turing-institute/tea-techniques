'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAssetPath } from '@/lib/config';
import type { Technique } from '@/lib/types';

interface SearchResult<T> {
  item: T;
  score?: number;
}

type FuseInstance<T> = {
  search: (query: string) => SearchResult<T>[];
};

interface UseFuseSearchOptions {
  category?: string;
}

export function useFuseSearch(options: UseFuseSearchOptions = {}) {
  const [fuse, setFuse] = useState<FuseInstance<Technique> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (fuse) {
      return; // Already initialized
    }

    setIsLoading(true);

    // Determine which search index to load
    const loadSearchData = async () => {
      let searchIndexUrl = getAssetPath('/data/search-index.json');

      // If category is specified, try to load category-specific index
      if (options.category) {
        try {
          const manifest = await fetch(
            getAssetPath('/data/search-manifest.json')
          ).then((res) => res.json());
          const categorySlug = options.category
            .toLowerCase()
            .replace(/\s+/g, '-');
          if (manifest.categories?.[categorySlug]) {
            searchIndexUrl = getAssetPath(manifest.categories[categorySlug]);
          }
        } catch {
          // Fall back to global index if manifest doesn't exist
        }
      }

      return fetch(searchIndexUrl).then((res) => res.json());
    };

    Promise.all([import('fuse.js'), loadSearchData()]).then(
      ([{ default: Fuse }, searchData]) => {
        const fuseInstance = new Fuse<Technique>(searchData, {
          keys: [
            { name: 'name', weight: 0.4 },
            { name: 'description', weight: 0.3 },
            { name: 'tags', weight: 0.2 },
            { name: 'assurance_goals', weight: 0.1 },
          ],
          threshold: 0.3,
          includeScore: true,
          minMatchCharLength: 2,
        });
        setFuse(fuseInstance);
        setIsLoading(false);
      }
    );
  }, [fuse, options.category]);

  const search = useCallback(
    (query: string, limit?: number): SearchResult<Technique>[] => {
      if (!(fuse && query)) {
        return [];
      }
      const results = fuse.search(query);
      return limit ? results.slice(0, limit) : results;
    },
    [fuse]
  );

  return { search, isLoading, isReady: !!fuse };
}
