'use client';

import dynamic from 'next/dynamic';

// Load the search modal on the client only, as the header does, so no search
// button appears with JavaScript off
const SearchModal = dynamic(
  () =>
    import('@/components/search/search-modal').then((mod) => ({
      default: mod.SearchModal,
    })),
  { ssr: false }
);

export function NotFoundSearch() {
  // The sidebar layout's SearchModal already answers Cmd/Ctrl + K
  return <SearchModal enableShortcut={false} />;
}
