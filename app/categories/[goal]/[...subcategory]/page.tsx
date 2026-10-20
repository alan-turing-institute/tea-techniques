import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { columns } from '@/components/techniques-columns';
import { TechniquesDataTable } from '@/components/techniques-data-table';
import { Badge } from '@/components/ui/badge';
import { getTags, getTechniquesByExactTag } from '@/lib/data';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import { formatSlugToTitle } from '@/lib/technique-utils';

// Force static rendering for static export
export const dynamic = 'force-static';

interface CategorySubcategoryPageProps {
  params: Promise<{ goal: string; subcategory: string[] }>;
}

export async function generateStaticParams() {
  const tags = await getTags();

  // Get all assurance-goal-category tags with subcategories
  const subcategoryTags = tags.filter((tag) => {
    if (tag.category !== 'assurance-goal-category') {
      return false;
    }
    const parts = tag.name.split('/');
    return parts.length >= 4; // One-segment paths belong to [dimension].
  });

  return subcategoryTags.map((tag) => {
    const parts = tag.name.split('/');
    const goal = parts[1]; // e.g., "explainability"
    const subcategory = parts.slice(2); // e.g., ["feature-analysis"] or ["feature-analysis", "importance-and-attribution"]

    return {
      goal,
      subcategory,
    };
  });
}

export async function generateMetadata({
  params,
}: CategorySubcategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const subcategoryPath = resolvedParams.subcategory.join('/');
  const fullTagName = `assurance-goal-category/${resolvedParams.goal}/${subcategoryPath}`;

  const tags = await getTags();
  const tag = tags.find((t) => t.name === fullTagName);

  if (!tag) {
    return {
      title: 'Subcategory Not Found - TEA Techniques',
    };
  }

  const goalName =
    resolvedParams.goal.charAt(0).toUpperCase() + resolvedParams.goal.slice(1);
  const subcategoryName = formatSlugToTitle(
    resolvedParams.subcategory.at(-1) ?? ''
  );

  return {
    title: `${subcategoryName} - ${goalName} - TEA Techniques`,
    description: `Browse techniques in the ${subcategoryName} subcategory of ${goalName}.`,
  };
}

export default async function CategorySubcategoryPage({
  params,
}: CategorySubcategoryPageProps) {
  const resolvedParams = await params;
  const subcategoryPath = resolvedParams.subcategory.join('/');
  const fullTagName = `assurance-goal-category/${resolvedParams.goal}/${subcategoryPath}`;

  const tags = await getTags();
  const tag = tags.find((t) => t.name === fullTagName);

  if (!tag) {
    notFound();
  }

  const techniques = await getTechniquesByExactTag(tag.name);
  const goalName =
    resolvedParams.goal.charAt(0).toUpperCase() + resolvedParams.goal.slice(1);
  const subcategoryName = formatSlugToTitle(
    resolvedParams.subcategory.at(-1) ?? ''
  );

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
          href={`/categories/${resolvedParams.goal}`}
        >
          {goalName}
        </Link>
        {resolvedParams.subcategory.map((part, index) => {
          const isLast = index === resolvedParams.subcategory.length - 1;
          const partName = formatSlugToTitle(part);
          const partPath = resolvedParams.subcategory
            .slice(0, index + 1)
            .join('/');

          return (
            <span key={part}>
              <span className="mx-2 text-muted-foreground">/</span>
              {isLast ? (
                <span className="text-foreground">{partName}</span>
              ) : (
                <Link
                  className="text-muted-foreground hover:text-primary"
                  href={`/categories/${resolvedParams.goal}/${partPath}`}
                >
                  {partName}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <Badge className="px-3 py-1 text-sm" variant="secondary">
            {goalName}
          </Badge>
          <h1 className="font-bold text-3xl text-foreground">
            {subcategoryName}
          </h1>
        </div>

        {/* Tag Definition if available */}
        {(tagDefinitions[tag.name] ||
          tagDefinitions[`${resolvedParams.goal}/${subcategoryPath}`]) && (
          <div className="mb-4 rounded-lg bg-muted/50 p-4">
            <p className="text-base">
              {tagDefinitions[tag.name] ||
                tagDefinitions[`${resolvedParams.goal}/${subcategoryPath}`]}
            </p>
          </div>
        )}

        <p className="text-lg text-muted-foreground">
          {techniques.length} technique{techniques.length !== 1 ? 's' : ''} in
          this subcategory
        </p>
      </div>

      {/* Techniques Table */}
      {techniques.length > 0 ? (
        <TechniquesDataTable columns={columns} data={techniques} />
      ) : (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No techniques found in this subcategory.
          </p>
        </div>
      )}

      {/* Back Links */}
      <div className="mt-12 flex justify-center gap-4 text-sm">
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href={`/categories/${resolvedParams.goal}`}
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
