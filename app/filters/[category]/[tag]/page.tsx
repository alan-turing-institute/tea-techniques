import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { columns } from '@/components/techniques-columns';
import { TechniquesDataTable } from '@/components/techniques-data-table';
import { Badge } from '@/components/ui/badge';
import { getTags, getTechniquesByTag } from '@/lib/data';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import { findTagByUrlPart, getTagUrlPart } from '@/lib/tag-utils';

// Force static rendering for static export
export const dynamic = 'force-static';

interface FilterPageProps {
  params: Promise<{ category: string; tag: string }>;
}

export async function generateStaticParams() {
  const tags = await getTags();

  // Include all main filter categories for direct /filters/[category]/[tag] routes
  // assurance-goal-category is handled by categories routes
  const allowedCategories = [
    'applicable-models',
    'lifecycle-stage',
    'expertise-needed',
    'technique-type',
    'evidence-type',
    'data-requirements',
    'data-type',
    'explanatory-scope',
  ];

  return tags
    .filter((tag) => allowedCategories.includes(tag.category))
    .map((tag) => ({
      category: tag.category,
      tag: getTagUrlPart(tag.name, tag.category),
    }));
}

export async function generateMetadata({
  params,
}: FilterPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const tags = await getTags();
  const tag = findTagByUrlPart(
    tags,
    resolvedParams.category,
    resolvedParams.tag
  );

  if (!tag) {
    return {
      title: 'Filter Not Found - TEA Techniques',
    };
  }

  const tagName = tag.name.split('/').pop()?.replace(/-/g, ' ') || tag.name;
  const categoryName = resolvedParams.category.replace(/-/g, ' ');

  return {
    title: `${tagName} Techniques - TEA Techniques`,
    description: `Browse AI techniques filtered by ${categoryName}: ${tagName}. Find specific techniques matching your requirements.`,
  };
}

export default async function FilterPage({ params }: FilterPageProps) {
  const resolvedParams = await params;
  const tags = await getTags();
  const tag = findTagByUrlPart(
    tags,
    resolvedParams.category,
    resolvedParams.tag
  );

  if (!tag) {
    notFound();
  }

  const techniques = await getTechniquesByTag(tag.name);
  const tagName = tag.name.split('/').pop()?.replace(/-/g, ' ') || tag.name;
  const categoryName = resolvedParams.category.replace(/-/g, ' ');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <Link className="text-muted-foreground hover:text-primary" href="/">
          Home
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          className="text-muted-foreground hover:text-primary"
          href="/filters"
        >
          Filters
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          className="text-muted-foreground capitalize hover:text-primary"
          href={`/filters/${resolvedParams.category}`}
        >
          {categoryName}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground capitalize">{tagName}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <Badge className="px-3 py-1 text-sm" variant="secondary">
            {categoryName}
          </Badge>
          <h1 className="font-bold text-3xl text-foreground capitalize">
            {tagName}
          </h1>
        </div>

        {/* Tag Definition */}
        {(tagDefinitions[tag.name] || tagDefinitions[tag.category]) && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <p className="text-base">
              {tagDefinitions[tag.name] || tagDefinitions[tag.category]}
            </p>
          </div>
        )}
      </div>

      {/* Techniques Table */}
      {techniques.length > 0 ? (
        <TechniquesDataTable columns={columns} data={techniques} />
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No techniques found with this filter.
          </p>
        </div>
      )}

      {/* Back Links */}
      <div className="mt-12 flex justify-center gap-4 text-sm">
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href={`/filters/${resolvedParams.category}`}
        >
          ← Back to {categoryName}
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href="/filters"
        >
          All filters
        </Link>
      </div>
    </div>
  );
}
