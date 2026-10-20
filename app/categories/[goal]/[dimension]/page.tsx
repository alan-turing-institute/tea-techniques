/**
 * Dynamic page for intermediate category dimensions
 *
 * This page handles routes like:
 * - /categories/explainability/property/
 * - /categories/explainability/attribution-methods/
 * - /categories/fairness/bias-detection/
 *
 * It displays all subcategories within a dimension and allows
 * users to navigate the hierarchical tag structure.
 *
 * Route generation is driven by the dimensions manifest (build-time data),
 * while TAG_HIERARCHIES provides optional display enrichment (names, descriptions).
 */

import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { columns } from '@/components/techniques-columns';
import { TechniquesDataTable } from '@/components/techniques-data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDimensionsManifest } from '@/lib/data';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import { TAG_HIERARCHIES } from '@/lib/data/tag-hierarchies';
import { formatSlugToTitle } from '@/lib/technique-utils';

// Force static rendering for static export
export const dynamic = 'force-static';

interface DimensionPageProps {
  params: Promise<{ goal: string; dimension: string }>;
}

/**
 * Generate static params for all dimension routes
 * Driven by the dimensions manifest (covers all goals with depth-3+ tags)
 */
export async function generateStaticParams() {
  const manifest = await getDimensionsManifest();
  const params: { goal: string; dimension: string }[] = [];

  for (const [goal, dimensions] of Object.entries(manifest)) {
    for (const { dimension } of dimensions) {
      params.push({ goal, dimension });
    }
  }

  return params;
}

/**
 * Helper to load dimension data from generated JSON
 */
async function getDimensionData(goal: string, dimension: string) {
  try {
    const { default: data } = await import(
      `@/public/data/categories/${goal}/${dimension}/index.json`
    );
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: DimensionPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { goal, dimension } = resolvedParams;

  // Use TAG_HIERARCHIES for curated name if available, otherwise format slug
  const hierarchy = TAG_HIERARCHIES[goal];
  const dimensionConfig = hierarchy?.dimensions[dimension];
  const dimensionName = dimensionConfig?.name ?? formatSlugToTitle(dimension);
  const goalName = formatSlugToTitle(goal);

  // Validate that this dimension actually exists in generated data
  const dimensionData = await getDimensionData(goal, dimension);
  if (!dimensionData) {
    return {
      title: 'Dimension Not Found - TEA Techniques',
    };
  }

  return {
    title: `${dimensionName} - ${goalName} - TEA Techniques`,
    description:
      dimensionConfig?.description ??
      `Explore ${dimensionName.toLowerCase()} subcategories in ${goalName}.`,
  };
}

export default async function DimensionPage({ params }: DimensionPageProps) {
  const resolvedParams = await params;
  const { goal, dimension } = resolvedParams;

  // Load dimension data — this is the source of truth for route validity
  const dimensionData = await getDimensionData(goal, dimension);
  if (!dimensionData) {
    notFound();
  }

  // Use TAG_HIERARCHIES for display enrichment (optional)
  const hierarchy = TAG_HIERARCHIES[goal];
  const dimensionConfig = hierarchy?.dimensions[dimension];
  const dimensionName = dimensionConfig?.name ?? formatSlugToTitle(dimension);
  const dimensionDescription = dimensionConfig?.description;
  const goalName = formatSlugToTitle(goal);

  // Format subcategory names for display
  const formatSubcategory = (sub: string) => {
    return formatSlugToTitle(sub);
  };

  const subcategoryCount = dimensionData.subcategories?.length ?? 0;
  const hasSubcategories = subcategoryCount > 0;
  const techniqueCount = dimensionData.count || 0;

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
          href="/categories"
        >
          Categories
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          className="text-muted-foreground hover:text-primary"
          href={`/categories/${goal}`}
        >
          {goalName}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{dimensionName}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <Badge className="mb-3 px-3 py-1 text-sm" variant="secondary">
            {goalName}
          </Badge>
          <h1 className="font-bold text-3xl text-foreground">
            {dimensionName}
          </h1>
        </div>

        {/* Dimension Description */}
        {dimensionDescription && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <p className="text-base">{dimensionDescription}</p>
          </div>
        )}

        {/* Statistics */}
        <p className="text-lg text-muted-foreground">
          {hasSubcategories &&
            `${subcategoryCount} subcategor${subcategoryCount === 1 ? 'y' : 'ies'} • `}
          {techniqueCount} technique{techniqueCount === 1 ? '' : 's'}
        </p>
      </div>

      {/* Subcategories Grid, followed by every technique tagged with the value */}
      {hasSubcategories ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dimensionData.subcategories.map((subcategory: string) => {
              const fullTag = `assurance-goal-category/${goal}/${dimension}/${subcategory}`;
              const definition = tagDefinitions[fullTag];
              const subcategoryUrl = `/categories/${goal}/${dimension}/${subcategory}`;

              return (
                <Link href={subcategoryUrl} key={subcategory}>
                  <Card className="h-full transition-colors hover:bg-accent">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>{formatSubcategory(subcategory)}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    {definition && (
                      <CardContent>
                        <p className="text-muted-foreground text-sm">
                          {definition}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>

          <h2 className="mt-10 mb-4 font-semibold text-xl">Techniques</h2>
          <TechniquesDataTable
            columns={columns}
            data={dimensionData.techniques}
          />
        </>
      ) : (
        <TechniquesDataTable
          columns={columns}
          data={dimensionData.techniques}
        />
      )}

      {/* Back Links */}
      <div className="mt-12 flex justify-center gap-4 text-sm">
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href={`/categories/${goal}`}
        >
          ← Back to {goalName}
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href="/categories"
        >
          All categories
        </Link>
      </div>
    </div>
  );
}
