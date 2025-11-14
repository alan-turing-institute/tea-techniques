import type { Metadata } from 'next';
import { ComparisonContainer } from '@/components/compare/comparison-container';
import { getAllTechniquesMetadata } from '@/lib/data';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Compare Techniques - TEA Techniques',
  description:
    'Compare AI assurance techniques side-by-side to understand their differences and choose the best approach for your needs.',
};

export default async function ComparePage() {
  // Load metadata for technique selection
  const techniques = await getAllTechniquesMetadata();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 font-bold text-3xl text-foreground">
          Compare Techniques
        </h1>
        <p className="text-muted-foreground">
          Select 2-3 techniques to compare their features, use cases, and
          limitations side-by-side.
        </p>
      </div>

      <ComparisonContainer techniques={techniques} />
    </div>
  );
}
