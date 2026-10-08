// Core data types for TEA Techniques static site

export interface Technique {
  slug: string;
  name: string;
  description: string;
  assurance_goals: string[];
  tags: string[];
  example_use_cases?: ExampleUseCase[];
  limitations?: Limitation[];
  resources?: Resource[] | string[];
  complexity_rating?: number;
  computational_cost_rating?: number;
  acronym?: string;
  related_techniques?: string[];
  sample_claims?: SampleClaim[];
}

export interface SampleClaim {
  text: string;
  assuranceGoal: string;
  domain?: string;
}

export interface ExampleUseCase {
  description: string;
  goal: string;
}

export interface Limitation {
  description: string;
}

export interface Resource {
  title: string;
  url: string;
  source_type?:
    | 'technical_paper'
    | 'software_package'
    | 'documentation'
    | 'tutorial'
    | 'application_paper';
  description?: string;
  authors?: string[];
  publication_date?: string;
  citationKey?: string;
  abstract?: string;
}

export interface AssuranceGoal {
  name: string;
  slug: string;
  count: number;
  description: string;
}

export interface Tag {
  name: string;
  slug: string;
  count: number;
  category: string;
}

export interface SearchIndexEntry {
  slug: string;
  name: string;
  description: string;
  assurance_goals: string[];
  tags: string[];
  searchText: string;
}

export interface CategoryData {
  goal: AssuranceGoal;
  techniques: Technique[];
  count: number;
}

export interface FilterData {
  tag: Tag;
  techniques: Technique[];
  count: number;
}

// Dimensions manifest types (generated at build time)
export interface DimensionSummary {
  dimension: string;
  subcategoryCount: number;
  techniqueCount: number;
}

export type DimensionsManifest = Record<string, DimensionSummary[]>;

// Utility types for static generation
export interface StaticPageData<T = unknown> {
  data: T;
  lastModified: string;
}

export interface NavigationItem {
  title: string;
  href: string;
  count?: number;
  children?: NavigationItem[];
}

// Props for page components
export interface TechniquePageProps {
  technique: Technique;
  relatedTechniques?: Technique[];
}

export interface TechniquesListProps {
  techniques: Technique[];
  title?: string;
  description?: string;
  totalCount: number;
}

export interface CategoryPageProps {
  categoryData: CategoryData;
}

export interface FilterPageProps {
  filterData: FilterData;
}
