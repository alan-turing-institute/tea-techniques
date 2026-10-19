import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TechniqueBreadcrumb } from '@/components/technique/sections/technique-breadcrumb';
import { TechniqueDescription } from '@/components/technique/sections/technique-description';
import { TechniqueHeader } from '@/components/technique/sections/technique-header';
import { TechniqueLimitations } from '@/components/technique/sections/technique-limitations';
import { TechniqueRelatedTable } from '@/components/technique/sections/technique-related-table';
import { TechniqueResources } from '@/components/technique/sections/technique-resources';
import { TechniqueTagsHierarchical } from '@/components/technique/sections/technique-tags-hierarchical';
import { TechniqueUseCases } from '@/components/technique/sections/technique-use-cases';
import { TableOfContents } from '@/components/technique/table-of-contents';
import {
  generateTechniqueParams,
  getRelatedTechniques,
  getTechnique,
} from '@/lib/data';

// Force static rendering for static export
export const dynamic = 'force-static';

interface TechniquePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const params = await generateTechniqueParams();
  return params;
}

export async function generateMetadata({
  params,
}: TechniquePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const technique = await getTechnique(resolvedParams.slug);

  if (!technique) {
    return {
      title: 'Technique Not Found - TEA Techniques',
    };
  }

  return {
    title: `${technique.name} - TEA Techniques`,
    description: technique.description,
    keywords: [
      technique.name,
      ...technique.assurance_goals,
      ...technique.tags.slice(0, 10), // Limit keywords
    ],
  };
}

export default async function TechniquePage({ params }: TechniquePageProps) {
  const resolvedParams = await params;
  const technique = await getTechnique(resolvedParams.slug);

  if (!technique) {
    notFound();
  }

  const relatedTechniques = await getRelatedTechniques(technique, 3);

  // Define sections for table of contents
  const sections = [
    { id: 'description', title: 'Description' },
    ...(technique.example_use_cases && technique.example_use_cases.length > 0
      ? [{ id: 'use-cases', title: 'Example Use Cases' }]
      : []),
    ...(technique.limitations && technique.limitations.length > 0
      ? [{ id: 'limitations', title: 'Limitations' }]
      : []),
    ...(technique.resources && technique.resources.length > 0
      ? [{ id: 'resources', title: 'Resources' }]
      : []),
    ...(relatedTechniques.length > 0
      ? [{ id: 'related-techniques', title: 'Related Techniques' }]
      : []),
    ...(technique.tags && technique.tags.length > 0
      ? [{ id: 'tags', title: 'Tags' }]
      : []),
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <TechniqueBreadcrumb technique={technique} />

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[1fr_250px]">
        {/* Main Content */}
        <div className="max-w-4xl">
          <TechniqueHeader technique={technique} />
          <TechniqueDescription technique={technique} />
          <TechniqueUseCases technique={technique} />
          <TechniqueLimitations technique={technique} />
          <TechniqueResources technique={technique} />
          <TechniqueRelatedTable relatedTechniques={relatedTechniques} />
          <TechniqueTagsHierarchical technique={technique} />
        </div>

        {/* Table of Contents */}
        <div>
          <TableOfContents sections={sections} />
        </div>
      </div>
    </div>
  );
}
