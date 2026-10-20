// Static data loading utilities
import fs from 'node:fs/promises';
import path from 'node:path';
import { CATCH_ALL_TAGS } from './constants';
import type {
  AssuranceGoal,
  CategoryData,
  DimensionSummary,
  DimensionsManifest,
  FilterData,
  SearchIndexEntry,
  Tag,
  Technique,
} from './types';

const dataPath = path.join(process.cwd(), 'public', 'data');

// Cache for loaded data to avoid reading files multiple times
const dataCache = new Map<string, unknown>();

async function loadJsonFile<T>(filePath: string): Promise<T> {
  if (dataCache.has(filePath)) {
    return dataCache.get(filePath) as T;
  }

  try {
    const fileContent = await fs.readFile(
      path.join(dataPath, filePath),
      'utf-8'
    );
    const data = JSON.parse(fileContent) as T;
    dataCache.set(filePath, data);
    return data;
  } catch (_error) {
    throw new Error(`Failed to load ${filePath}`);
  }
}

// Load dimensions manifest (generated at build time)
export async function getDimensionsManifest(): Promise<DimensionsManifest> {
  return await loadJsonFile<DimensionsManifest>(
    'categories/dimensions-manifest.json'
  );
}

// Load dimensions for a specific goal
export async function getGoalDimensions(
  goalSlug: string
): Promise<DimensionSummary[]> {
  const manifest = await getDimensionsManifest();
  return manifest[goalSlug] ?? [];
}

// Load all techniques (full data)
export async function getAllTechniques(): Promise<Technique[]> {
  return await loadJsonFile<Technique[]>('techniques.json');
}

// Load lightweight techniques metadata (name, slug, description, goals, tags only - 72% smaller)
export async function getAllTechniquesMetadata(): Promise<Technique[]> {
  return await loadJsonFile<Technique[]>('techniques-metadata.json');
}

// Load a single technique by slug
export async function getTechnique(slug: string): Promise<Technique | null> {
  try {
    return await loadJsonFile<Technique>(`techniques/${slug}.json`);
  } catch {
    return null;
  }
}

// Load all assurance goals
export async function getAssuranceGoals(): Promise<AssuranceGoal[]> {
  return await loadJsonFile<AssuranceGoal[]>('assurance-goals.json');
}

// Load all tags
export async function getTags(): Promise<Tag[]> {
  return await loadJsonFile<Tag[]>('tags.json');
}

// Load search index
export async function getSearchIndex(): Promise<SearchIndexEntry[]> {
  return await loadJsonFile<SearchIndexEntry[]>('search-index.json');
}

// Load category data
export async function getCategoryData(
  goalSlug: string
): Promise<CategoryData | null> {
  try {
    return await loadJsonFile<CategoryData>(`categories/${goalSlug}.json`);
  } catch {
    return null;
  }
}

// Load filter data
export async function getFilterData(
  category: string,
  tagSlug: string
): Promise<FilterData | null> {
  try {
    return await loadJsonFile<FilterData>(
      `filters/${category}/${tagSlug}.json`
    );
  } catch {
    return null;
  }
}

// Get techniques by assurance goal
export async function getTechniquesByGoal(
  goalName: string
): Promise<Technique[]> {
  const techniques = await getAllTechniques();
  return techniques.filter((t) => t.assurance_goals?.includes(goalName));
}

// Get techniques by tag (includes catch-all matches for filtering)
export async function getTechniquesByTag(
  tagName: string
): Promise<Technique[]> {
  const techniques = await getAllTechniques();
  const category = tagName.split('/')[0];
  const catchAllTag = CATCH_ALL_TAGS[category];
  return techniques.filter(
    (technique) =>
      technique.tags?.includes(tagName) ||
      (catchAllTag &&
        catchAllTag !== tagName &&
        technique.tags?.includes(catchAllTag))
  );
}

// Get techniques by exact tag match (no catch-all expansion)
export async function getTechniquesByExactTag(
  tagName: string
): Promise<Technique[]> {
  const techniques = await getAllTechniques();
  return techniques.filter((technique) => technique.tags?.includes(tagName));
}

// Get related techniques in generated ranking order
export async function getRelatedTechniques(
  technique: Technique,
  limit = 3
): Promise<Technique[]> {
  if (!technique.related_techniques?.length) {
    return [];
  }

  const allTechniques = await getAllTechniques();
  const slugsToFind = technique.related_techniques.slice(0, limit);

  const bySlug = new Map(allTechniques.map((item) => [item.slug, item]));
  return slugsToFind
    .map((slug) => bySlug.get(slug))
    .filter((item): item is Technique => item !== undefined);
}

// Search techniques
export async function searchTechniques(query: string): Promise<Technique[]> {
  const searchIndex = await getSearchIndex();
  const searchLower = query.toLowerCase();

  const matchingSlugs = searchIndex
    .filter((entry) => entry.searchText.includes(searchLower))
    .map((entry) => entry.slug);

  const allTechniques = await getAllTechniques();
  return allTechniques.filter((technique) =>
    matchingSlugs.includes(technique.slug)
  );
}

// Generate static params for dynamic routes
export async function generateTechniqueParams() {
  const techniques = await getAllTechniques();
  return techniques.map((technique) => ({
    slug: technique.slug,
  }));
}

export async function generateCategoryParams() {
  const goals = await getAssuranceGoals();
  return goals.map((goal) => ({
    goal: goal.slug,
  }));
}

export async function generateFilterParams() {
  const tags = await getTags();
  const paramsByCategory: Record<string, { category: string; tag: string }[]> =
    {};

  for (const tag of tags) {
    if (!paramsByCategory[tag.category]) {
      paramsByCategory[tag.category] = [];
    }
    paramsByCategory[tag.category].push({
      category: tag.category,
      tag: tag.slug,
    });
  }

  return paramsByCategory;
}
