'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useReducer } from 'react';
import { ArrowRight, Search, X } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { GoalIcon } from '@/components/ui/goal-icon';
import { useFuseSearch } from '@/lib/hooks/use-fuse-search';
import type { Technique } from '@/lib/types';

interface SearchResult {
  item: Technique;
  score?: number;
}

interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  selectedIndex: number;
}

type SearchAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SEARCH'; query: string; results: SearchResult[] }
  | { type: 'NAVIGATE'; direction: 'up' | 'down' };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'OPEN':
      return { ...state, isOpen: true };
    case 'CLOSE':
      return { isOpen: false, query: '', results: [], selectedIndex: 0 };
    case 'SEARCH':
      return {
        ...state,
        query: action.query,
        results: action.results,
        selectedIndex: 0,
      };
    case 'NAVIGATE':
      return {
        ...state,
        selectedIndex:
          action.direction === 'down'
            ? Math.min(state.selectedIndex + 1, state.results.length - 1)
            : Math.max(state.selectedIndex - 1, 0),
      };
    default:
      return state;
  }
}

const initialSearchState: SearchState = {
  isOpen: false,
  query: '',
  results: [],
  selectedIndex: 0,
};

interface SearchModalProps {
  category?: string;
  /** Set to false when another SearchModal on the page already answers Cmd/Ctrl + K */
  enableShortcut?: boolean;
}

export function SearchModal({
  category,
  enableShortcut = true,
}: SearchModalProps = {}) {
  const [state, dispatch] = useReducer(searchReducer, initialSearchState);
  const { search, isLoading } = useFuseSearch({ category });
  const router = useRouter();

  // Keyboard shortcut (Cmd/Ctrl + K) and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (enableShortcut && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch({ type: 'OPEN' });
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'CLOSE' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableShortcut]);

  // Inline search on input change (synchronous Fuse.js, no effect needed)
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      const newResults = newQuery ? search(newQuery, 10) : [];
      dispatch({ type: 'SEARCH', query: newQuery, results: newResults });
    },
    [search]
  );

  // Keyboard navigation within results
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        dispatch({ type: 'NAVIGATE', direction: 'down' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        dispatch({ type: 'NAVIGATE', direction: 'up' });
      } else if (e.key === 'Enter' && state.results[state.selectedIndex]) {
        e.preventDefault();
        router.push(
          `/techniques/${state.results[state.selectedIndex].item.slug}`
        );
        dispatch({ type: 'CLOSE' });
      }
    },
    [state.results, state.selectedIndex, router]
  );

  if (!state.isOpen) {
    return (
      <button
        aria-label="Search techniques (Cmd+K)"
        className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-secondary/50 group-data-[collapsible=icon]:hidden"
        onClick={() => dispatch({ type: 'OPEN' })}
        type="button"
      >
        <Search size={16} />
        <span className="group-data-[collapsible=icon]:hidden">Search</span>
        <kbd className="ml-auto inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs group-data-[collapsible=icon]:hidden">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl px-4">
        <div className="overflow-hidden rounded-lg border bg-background shadow-lg">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b p-4">
            <Search className="text-muted-foreground" size={20} />
            <input
              autoFocus
              className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              onChange={handleQueryChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Search techniques..."
              type="text"
              value={state.query}
            />
            <button
              aria-label="Close search"
              className="rounded p-1 hover:bg-secondary"
              onClick={() => dispatch({ type: 'CLOSE' })}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {(() => {
              if (isLoading) {
                return (
                  <div className="p-8 text-center text-muted-foreground">
                    Loading search...
                  </div>
                );
              }
              if (state.query && state.results.length === 0) {
                return (
                  <div className="p-8 text-center text-muted-foreground">
                    No techniques found for "{state.query}"
                  </div>
                );
              }
              if (state.results.length > 0) {
                return (
                  <div className="py-2">
                    {state.results.map((result, index) => (
                      <button
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50 ${
                          index === state.selectedIndex ? 'bg-secondary/50' : ''
                        }`}
                        key={result.item.slug}
                        onClick={() => {
                          router.push(`/techniques/${result.item.slug}`);
                          dispatch({ type: 'CLOSE' });
                        }}
                        type="button"
                      >
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {result.item.name}
                            </span>
                            {result.score && (
                              <span className="text-muted-foreground text-xs">
                                {Math.round((1 - result.score) * 100)}% match
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-1 text-muted-foreground text-sm">
                            {result.item.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {result.item.assurance_goals
                              ?.slice(0, 2)
                              .map((goal) => (
                                <div
                                  className="flex items-center gap-1"
                                  key={goal}
                                >
                                  <GoalIcon goalName={goal} size={12} />
                                  <span className="text-muted-foreground text-xs">
                                    {goal}
                                  </span>
                                </div>
                              ))}
                            {result.item.tags?.slice(0, 3).map((tag) => (
                              <Badge
                                className="h-5 text-xs"
                                key={tag}
                                variant="secondary"
                              >
                                {tag.split('/').pop()?.replace(/-/g, ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <ArrowRight
                          className="mt-1 text-muted-foreground"
                          size={16}
                        />
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <div className="p-8 text-center text-muted-foreground">
                  Start typing to search techniques
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2 text-muted-foreground text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1 py-0.5">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1 py-0.5">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1 py-0.5">esc</kbd>
                Close
              </span>
            </div>
            {state.results.length > 0 && (
              <span>{state.results.length} results</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
