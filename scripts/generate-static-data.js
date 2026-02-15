#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateJsonLd } from './generate-jsonld.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'public', 'data');
const techniquesPath = path.join(dataDir, 'techniques.json');

async function generateStaticData() {
  try {
    // Read the source techniques data
    const techniquesData = JSON.parse(
      await fs.readFile(techniquesPath, 'utf-8')
    );

    // Read Zotero resources
    const zoteroPath = path.join(dataDir, 'zotero-resources.json');
    let zoteroItems = [];
    try {
      const zoteroData = JSON.parse(await fs.readFile(zoteroPath, 'utf-8'));
      zoteroItems = zoteroData.items || [];
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: build script warning output
      console.warn(
        'Warning: Could not load zotero-resources.json',
        error.message
      );
    }

    // Create Zotero lookup map
    const zoteroLookup = new Map(
      zoteroItems.map((item) => [item.citationKey, item])
    );

    // Hydrate techniques with Zotero resources
    const hydratedTechniques = techniquesData.map((technique) => {
      const hydrated = { ...technique };
      if (hydrated.resources && Array.isArray(hydrated.resources)) {
        hydrated.resources = hydrated.resources
          .map((resource) => {
            if (typeof resource === 'string') {
              // Resolve citekey
              const item = zoteroLookup.get(resource);
              if (item) {
                return mapZoteroItemToResource(item);
              }
              // biome-ignore lint/suspicious/noConsole: build script warning output
              console.warn(
                `Warning: Citekey "${resource}" not found in Zotero library for technique "${technique.slug}"`
              );
              return null;
            }
            // Return existing object as-is (legacy support)
            return resource;
          })
          .filter(Boolean);
      }
      return hydrated;
    });

    // Generate lightweight techniques metadata (using hydrated data? No, metadata doesn't need resources)
    // Actually, if we want to search by resource title, we might need it.
    // But metadata is usually for lists.
    const techniquesMetadata = hydratedTechniques.map((technique) => ({
      slug: technique.slug,
      name: technique.name,
      description: technique.description,
      assurance_goals: technique.assurance_goals,
      tags: technique.tags,
      sample_claims: technique.sample_claims,
    }));
    await fs.writeFile(
      path.join(dataDir, 'techniques-metadata.json'),
      JSON.stringify(techniquesMetadata, null, 2)
    );

    // Generate assurance goals data
    const assuranceGoals = extractAssuranceGoals(hydratedTechniques);
    await fs.writeFile(
      path.join(dataDir, 'assurance-goals.json'),
      JSON.stringify(assuranceGoals, null, 2)
    );

    // Generate tags data
    const tags = extractTags(hydratedTechniques);
    await fs.writeFile(
      path.join(dataDir, 'tags.json'),
      JSON.stringify(tags, null, 2)
    );

    // Generate individual technique files
    const techniquesDir = path.join(dataDir, 'techniques');
    await fs.mkdir(techniquesDir, { recursive: true });

    await Promise.all(
      hydratedTechniques.map((technique) =>
        fs.writeFile(
          path.join(techniquesDir, `${technique.slug}.json`),
          JSON.stringify(technique, null, 2)
        )
      )
    );

    // Generate search index
    const searchIndex = generateSearchIndex(hydratedTechniques);
    await fs.writeFile(
      path.join(dataDir, 'search-index.json'),
      JSON.stringify(searchIndex, null, 2)
    );

    // Generate category-specific search indices
    await generateCategorySearchIndices(hydratedTechniques, assuranceGoals);

    // Generate category pages data
    await generateCategoryData(hydratedTechniques, assuranceGoals);

    // Generate filter combinations
    await generateFilterData(hydratedTechniques, tags);

    // Generate JSON-LD knowledge graph files
    await generateJsonLd(hydratedTechniques, assuranceGoals);
  } catch (_error) {
    process.exit(1);
  }
}

function extractAssuranceGoals(techniques) {
  const goalCounts = {};

  for (const technique of techniques) {
    if (technique.assurance_goals) {
      for (const goal of technique.assurance_goals) {
        if (!goalCounts[goal]) {
          goalCounts[goal] = {
            name: goal,
            slug: goal.toLowerCase().replace(/\s+/g, '-'),
            count: 0,
            description: getGoalDescription(goal),
          };
        }
        goalCounts[goal].count++;
      }
    }
  }

  return Object.values(goalCounts).sort((a, b) => a.name.localeCompare(b.name));
}

function extractTags(techniques) {
  const tagCounts = {};

  for (const technique of techniques) {
    if (technique.tags) {
      for (const tag of technique.tags) {
        if (!tagCounts[tag]) {
          tagCounts[tag] = {
            name: tag,
            slug: tag.replace(/\//g, '-').replace(/\s+/g, '-').toLowerCase(),
            count: 0,
            category: tag.split('/')[0] || 'other',
          };
        }
        tagCounts[tag].count++;
      }
    }
  }

  return Object.values(tagCounts).sort((a, b) => a.name.localeCompare(b.name));
}

function generateSearchIndex(techniques) {
  return techniques.map((technique) => ({
    slug: technique.slug,
    name: technique.name,
    description: technique.description,
    assurance_goals: technique.assurance_goals || [],
    tags: technique.tags || [],
    // Create searchable text for full-text search
    searchText: [
      technique.name,
      technique.description,
      ...(technique.assurance_goals || []),
      ...(technique.tags || []),
      ...(technique.sample_claims?.map((c) => c.text) || []),
    ]
      .join(' ')
      .toLowerCase(),
  }));
}

async function generateCategoryData(techniques, assuranceGoals) {
  const categoriesDir = path.join(dataDir, 'categories');
  await fs.mkdir(categoriesDir, { recursive: true });

  // Generate main category files
  await Promise.all(
    assuranceGoals.map((goal) => {
      const categoryTechniques = techniques.filter((technique) =>
        technique.assurance_goals?.includes(goal.name)
      );

      return fs.writeFile(
        path.join(categoriesDir, `${goal.slug}.json`),
        JSON.stringify(
          {
            goal,
            techniques: categoryTechniques,
            count: categoryTechniques.length,
          },
          null,
          2
        )
      );
    })
  );

  // Generate hierarchical subcategory files for explainability
  await generateHierarchicalCategoryData(techniques);
}

/**
 * Generates JSON files for hierarchical category subcategories
 * This enables routes like /categories/explainability/property/
 */
async function generateHierarchicalCategoryData(techniques) {
  const hierarchicalTags = collectHierarchicalTags(techniques);
  const hierarchyMap = buildHierarchyMap(hierarchicalTags, techniques);
  await writeHierarchicalFiles(hierarchyMap);
}

/**
 * Collects all hierarchical assurance-goal-category tags
 */
function collectHierarchicalTags(techniques) {
  const hierarchicalTags = new Set();

  for (const technique of techniques) {
    if (!technique.tags) {
      continue;
    }

    for (const tag of technique.tags) {
      if (
        tag.startsWith('assurance-goal-category/') &&
        tag.split('/').length >= 3
      ) {
        hierarchicalTags.add(tag);
      }
    }
  }

  return hierarchicalTags;
}

/**
 * Builds a hierarchy map from tags and techniques
 */
function buildHierarchyMap(hierarchicalTags, techniques) {
  const hierarchyMap = {};

  for (const tag of hierarchicalTags) {
    const parts = tag.split('/');
    const goal = parts[1]; // e.g., 'explainability'
    const dimension = parts[2]; // e.g., 'property'
    const subcategory = parts.slice(3).join('/'); // e.g., 'completeness'

    // Initialize goal and dimension if needed
    if (!hierarchyMap[goal]) {
      hierarchyMap[goal] = {};
    }
    if (!hierarchyMap[goal][dimension]) {
      hierarchyMap[goal][dimension] = {
        techniques: new Set(),
        subcategories: new Set(),
      };
    }

    // Add subcategory if it exists
    if (subcategory) {
      hierarchyMap[goal][dimension].subcategories.add(subcategory);
    }

    // Find techniques with this tag
    for (const technique of techniques) {
      if (technique.tags?.includes(tag)) {
        hierarchyMap[goal][dimension].techniques.add(technique);
      }
    }
  }

  return hierarchyMap;
}

/**
 * Writes hierarchy JSON files to disk
 */
async function writeHierarchicalFiles(hierarchyMap) {
  // Prepare all file write operations
  const writeOperations = [];

  for (const [goal, dimensions] of Object.entries(hierarchyMap)) {
    const goalDir = path.join(dataDir, 'categories', goal);

    for (const [dimension, data] of Object.entries(dimensions)) {
      const dimensionDir = path.join(goalDir, dimension);
      const dimensionTechniques = Array.from(data.techniques);
      const subcategories = Array.from(data.subcategories).sort();

      // Create directory and file write promises
      writeOperations.push(
        fs.mkdir(dimensionDir, { recursive: true }).then(() =>
          fs.writeFile(
            path.join(dimensionDir, 'index.json'),
            JSON.stringify(
              {
                goal,
                dimension,
                subcategories,
                techniques: dimensionTechniques,
                count: dimensionTechniques.length,
              },
              null,
              2
            )
          )
        )
      );
    }
  }

  // Execute all operations in parallel
  await Promise.all(writeOperations);
}

async function generateFilterData(techniques, tags) {
  const filtersDir = path.join(dataDir, 'filters');
  await fs.mkdir(filtersDir, { recursive: true });

  // Group tags by category
  const tagsByCategory = {};
  for (const tag of tags) {
    if (!tagsByCategory[tag.category]) {
      tagsByCategory[tag.category] = [];
    }
    tagsByCategory[tag.category].push(tag);
  }

  // Generate filter data for each category
  await Promise.all(
    Object.entries(tagsByCategory).map(async ([category, categoryTags]) => {
      const categoryDir = path.join(filtersDir, category);
      await fs.mkdir(categoryDir, { recursive: true });

      return Promise.all(
        categoryTags.map((tag) => {
          const filteredTechniques = techniques.filter((technique) =>
            technique.tags?.includes(tag.name)
          );

          return fs.writeFile(
            path.join(categoryDir, `${tag.slug}.json`),
            JSON.stringify(
              {
                tag,
                techniques: filteredTechniques,
                count: filteredTechniques.length,
              },
              null,
              2
            )
          );
        })
      );
    })
  );
}

async function generateCategorySearchIndices(techniques, assuranceGoals) {
  const searchDir = path.join(dataDir, 'search');
  await fs.mkdir(searchDir, { recursive: true });

  // Generate search index for each assurance goal
  await Promise.all(
    assuranceGoals.map(async (goal) => {
      const categoryTechniques = techniques.filter((technique) =>
        technique.assurance_goals?.includes(goal.name)
      );

      const categorySearchIndex = generateSearchIndex(categoryTechniques);

      await fs.writeFile(
        path.join(searchDir, `${goal.slug}-index.json`),
        JSON.stringify(categorySearchIndex, null, 2)
      );
    })
  );

  // Generate a search index manifest
  const searchManifest = {
    global: '/data/search-index.json',
    categories: assuranceGoals.reduce((acc, goal) => {
      acc[goal.slug] = `/data/search/${goal.slug}-index.json`;
      return acc;
    }, {}),
  };

  await fs.writeFile(
    path.join(dataDir, 'search-manifest.json'),
    JSON.stringify(searchManifest, null, 2)
  );
}

function getGoalDescription(goal) {
  const descriptions = {
    Explainability:
      'Understanding how AI systems make decisions and what factors influence their outputs.',
    Fairness:
      'Ensuring AI systems treat different groups and individuals equitably.',
    Privacy:
      'Protecting personal data and maintaining confidentiality in AI systems.',
    Reliability:
      'Building AI systems that perform consistently and predictably.',
    Safety: 'Ensuring AI systems operate safely and do not cause harm.',
    Security:
      'Protecting AI systems from malicious attacks and unauthorized access.',
    Transparency:
      'Making AI systems and their decision-making processes open and understandable.',
  };
  return descriptions[goal] || `Techniques related to ${goal.toLowerCase()}.`;
}

function mapZoteroItemToResource(item) {
  // Check for type override tag
  const typeTag = item.tags?.find((t) => t.tag.startsWith('type:'));
  let sourceType;

  if (typeTag) {
    // Convert tag format (e.g. type:technical-paper) to enum format (technical_paper)
    sourceType = typeTag.tag.replace('type:', '').replace(/-/g, '_');
  } else {
    // Fallback to itemType mapping
    const typeMapping = {
      journalArticle: 'technical_paper',
      preprint: 'technical_paper',
      conferencePaper: 'technical_paper',
      report: 'technical_paper',
      thesis: 'technical_paper',
      book: 'technical_paper',
      bookSection: 'technical_paper',
      computerProgram: 'software_package',
      software: 'software_package',
      webpage: 'documentation',
      blogPost: 'tutorial',
      presentation: 'tutorial',
      videoRecording: 'tutorial',
    };
    sourceType = typeMapping[item.itemType] || 'other';
  }

  // Extract authors
  let authors = [];
  if (item.creators) {
    authors = item.creators
      .filter((c) => c.creatorType === 'author')
      .map((c) => {
        if (c.firstName && c.lastName) {
          return `${c.firstName} ${c.lastName}`;
        }
        return c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim();
      });
  }

  return {
    title: item.title || 'Untitled',
    url: item.url || '',
    source_type: sourceType,
    authors: authors.length > 0 ? authors : undefined,
    publication_date: item.date,
    citationKey: item.citationKey,
    abstract: item.abstractNote,
  };
}

// Run the script
generateStaticData();
