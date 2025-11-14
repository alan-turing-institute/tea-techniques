import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import search modal to avoid loading it on initial page load
const SearchModal = dynamic(
  () =>
    import('@/components/search/search-modal').then((mod) => ({
      default: mod.SearchModal,
    })),
  { ssr: false }
);

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link
            className="font-bold text-primary text-xl transition-colors hover:text-primary/80"
            href="/"
          >
            TEA Techniques
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              className="text-foreground transition-colors hover:text-primary"
              href="/techniques"
            >
              Techniques
            </Link>
            <Link
              className="text-foreground transition-colors hover:text-primary"
              href="/categories"
            >
              Categories
            </Link>
            <Link
              className="text-foreground transition-colors hover:text-primary"
              href="/filters"
            >
              Filters
            </Link>
            <Link
              className="text-foreground transition-colors hover:text-primary"
              href="/compare"
            >
              Compare
            </Link>
            <Link
              className="text-foreground transition-colors hover:text-primary"
              href="/about"
            >
              About
            </Link>
          </nav>

          {/* Search */}
          <SearchModal />
        </div>
      </div>
    </header>
  );
}
