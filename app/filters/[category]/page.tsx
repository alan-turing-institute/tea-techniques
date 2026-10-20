import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FilterTable, type FilterTableItem } from '@/components/filter-table';
import { getAllTechniquesMetadata, getTags } from '@/lib/data';
import { tagDefinitions } from '@/lib/data/tag-definitions';
import { getTagUrlPart } from '@/lib/tag-utils';

// Force static rendering for static export
export const dynamic = 'force-static';

interface FilterCategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const tags = await getTags();

  // Include all main filter categories for direct /filters/[category] routes
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

  const categories = [...new Set(tags.map((tag) => tag.category))].filter(
    (category) => allowedCategories.includes(category)
  );

  return categories.map((category) => ({
    category,
  }));
}

export async function generateMetadata({
  params,
}: FilterCategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categoryName = resolvedParams.category.replace(/-/g, ' ');

  return {
    title: `${categoryName} Filters - TEA Techniques`,
    description: `Browse techniques by ${categoryName}. Filter and explore AI techniques based on specific characteristics.`,
  };
}

export default async function FilterCategoryPage({
  params,
}: FilterCategoryPageProps) {
  const resolvedParams = await params;
  const [tags, techniques] = await Promise.all([
    getTags(),
    getAllTechniquesMetadata(),
  ]);

  // Get tags for this category
  const categoryTags = tags.filter(
    (tag) => tag.category === resolvedParams.category
  );

  if (categoryTags.length === 0) {
    notFound();
  }

  // Prepare data for FilterTable
  const tableData: FilterTableItem[] = categoryTags.map((tag) => {
    const techniqueCount = techniques.filter((t) =>
      t.tags?.includes(tag.name)
    ).length;
    return {
      name: tag.name,
      slug: tag.slug,
      definition:
        tagDefinitions[tag.name] ||
        tagDefinitions[tag.category] ||
        'No description available',
      techniqueCount,
      href: `/filters/${resolvedParams.category}/${getTagUrlPart(tag.name, tag.category)}`,
    };
  });

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
        <span className="text-foreground capitalize">{categoryName}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-4 font-bold text-3xl text-foreground capitalize">
          {categoryName} Filters
        </h1>
        <p className="text-lg text-muted-foreground">
          Browse and search through available filters in this category. Click on
          any filter to view related techniques.
        </p>
      </div>

      {/* Filter Table */}
      <FilterTable
        data={tableData}
        searchPlaceholder={`Search ${categoryName} filters...`}
      />

      {/* Back Link */}
      <div className="mt-12 text-center">
        <Link
          className="font-medium text-primary hover:text-primary/80"
          href="/filters"
        >
          ← Back to all filters
        </Link>
      </div>
    </div>
  );
}
