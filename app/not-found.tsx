'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BookOpen, FileQuestion } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Load the search modal on the client only, as the header does, so the page
// reads the same with JavaScript off
const SearchModal = dynamic(
  () =>
    import('@/components/search/search-modal').then((mod) => ({
      default: mod.SearchModal,
    })),
  { ssr: false }
);

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="mx-auto max-w-2xl border-none shadow-none">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="mb-8">
              <FileQuestion className="mx-auto h-24 w-24 text-muted-foreground/50" />
            </div>

            <h1 className="mb-4 font-bold text-4xl text-foreground">
              Page not found
            </h1>

            <p className="mx-auto mb-8 max-w-md text-muted-foreground text-xl">
              We couldn't find this page. If you followed a link to a technique,
              it may have been removed or renamed as the catalogue is revised.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild className="gap-2" size="lg">
                <Link href="/techniques">
                  <BookOpen className="h-4 w-4" />
                  Browse the catalogue
                </Link>
              </Button>

              <div className="w-full max-w-xs sm:w-56 [&>button]:h-10">
                <SearchModal />
              </div>
            </div>

            <div className="mt-12 border-t pt-8">
              <p className="mb-4 text-muted-foreground text-sm">
                Here are some helpful links:
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link className="text-primary hover:underline" href="/">
                  Home
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  className="text-primary hover:underline"
                  href="/categories"
                >
                  Categories
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link className="text-primary hover:underline" href="/filters">
                  Filters
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link className="text-primary hover:underline" href="/about">
                  About
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link
                  className="text-primary hover:underline"
                  href="/docs/community-contributions"
                >
                  Contribute
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
