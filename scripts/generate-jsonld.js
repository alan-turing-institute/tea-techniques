#!/usr/bin/env node

/**
 * Generate JSON-LD knowledge graph files from hydrated technique data.
 *
 * Produces:
 *   /public/data/ld/context.jsonld        (committed source — not overwritten)
 *   /public/data/ld/graph.jsonld          (complete knowledge graph)
 *   /public/data/ld/techniques.jsonld     (all techniques collection)
 *   /public/data/ld/techniques/{slug}.jsonld
 *   /public/data/ld/goals.jsonld
 *   /public/data/ld/goals/{slug}.jsonld
 *   /public/data/ld/tags.jsonld
 *   /public/data/ld/resources.jsonld
 *   /public/data/ld/index.json            (API discovery document)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'public', 'data');
const ldDir = path.join(dataDir, 'ld');

const CONTEXT_URL =
  'https://alan-turing-institute.github.io/tea-techniques/data/ld/context.jsonld';
const BASE_URL = 'https://alan-turing-institute.github.io/tea-techniques';

// --- IRI helpers ---

function techniqueIri(slug) {
  return `tea:technique/${slug}`;
}

function goalIri(slug) {
  return `tea:goal/${slug}`;
}

function tagIri(tagPath) {
  return `tea:tag/${tagPath}`;
}

function resourceIri(citationKey) {
  return `tea:resource/${citationKey}`;
}

function goalSlug(goalName) {
  return goalName.toLowerCase().replace(/\s+/g, '-');
}

// --- Transformers ---

function transformTechnique(technique) {
  const node = {
    '@context': CONTEXT_URL,
    '@id': techniqueIri(technique.slug),
    '@type': 'Technique',
    name: technique.name,
    slug: technique.slug,
    description: technique.description,
    addressesGoal: technique.assurance_goals.map((g) => goalIri(goalSlug(g))),
    hasTag: technique.tags.map((t) => tagIri(t)),
  };

  if (technique.acronym) {
    node.acronym = technique.acronym;
  }

  if (technique.complexity_rating != null) {
    node.complexityRating = technique.complexity_rating;
  }

  if (technique.computational_cost_rating != null) {
    node.computationalCostRating = technique.computational_cost_rating;
  }

  if (technique.related_techniques?.length) {
    node.relatedTo = technique.related_techniques.map((slug) =>
      techniqueIri(slug)
    );
  }

  if (technique.resources?.length) {
    node.citesResource = technique.resources
      .filter((r) => typeof r === 'object' && r.citationKey)
      .map((r) => resourceIri(r.citationKey));
  }

  if (technique.example_use_cases?.length) {
    node.exampleUseCases = technique.example_use_cases;
  }

  if (technique.limitations?.length) {
    node.limitations = technique.limitations;
  }

  if (technique.sample_claims?.length) {
    node.sampleClaims = technique.sample_claims;
  }

  return node;
}

function transformGoal(goalObj, techniques) {
  const slug = goalObj.slug;
  const techniqueSlugs = techniques
    .filter((t) => t.assurance_goals.includes(goalObj.name))
    .map((t) => techniqueIri(t.slug));

  return {
    '@context': CONTEXT_URL,
    '@id': goalIri(slug),
    '@type': 'AssuranceGoal',
    name: goalObj.name,
    slug,
    description: goalObj.description,
    techniqueCount: goalObj.count,
    hasTechnique: techniqueSlugs,
  };
}

function transformTag(tagPath) {
  const parts = tagPath.split('/');
  const category = parts[0];
  const label = parts.at(-1).replace(/-/g, ' ');

  const node = {
    '@id': tagIri(tagPath),
    '@type': 'Tag',
    prefLabel: label,
    path: tagPath,
    category,
  };

  // Add hierarchy relationships
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join('/');
    node.broader = tagIri(parentPath);
  }

  return node;
}

function transformResource(resource) {
  if (typeof resource === 'string' || !resource.citationKey) {
    return null;
  }

  const node = {
    '@id': resourceIri(resource.citationKey),
    '@type': 'Resource',
    name: resource.title,
    citationKey: resource.citationKey,
  };

  if (resource.url) {
    node.url = resource.url;
  }
  if (resource.source_type) {
    node.sourceType = resource.source_type;
  }
  if (resource.authors?.length) {
    node.authors = resource.authors;
  }
  if (resource.publication_date) {
    node.publicationDate = resource.publication_date;
  }
  if (resource.abstract) {
    node.abstract = resource.abstract;
  }

  return node;
}

// --- Build tag hierarchy with narrower links ---

function buildTagHierarchy(allTagPaths) {
  // Build set of all paths including implicit parent paths
  const allPaths = new Set();
  for (const tagPath of allTagPaths) {
    const parts = tagPath.split('/');
    for (let i = 1; i <= parts.length; i++) {
      allPaths.add(parts.slice(0, i).join('/'));
    }
  }

  // Transform all tags
  const tagNodes = [];
  for (const tagPath of allPaths) {
    tagNodes.push(transformTag(tagPath));
  }

  // Add narrower references
  const nodeMap = new Map(tagNodes.map((n) => [n['@id'], n]));
  for (const node of tagNodes) {
    if (node.broader) {
      const parent = nodeMap.get(node.broader);
      if (parent) {
        if (!parent.narrower) {
          parent.narrower = [];
        }
        parent.narrower.push(node['@id']);
      }
    }
  }

  return tagNodes;
}

// --- Collect all unique resources ---

function collectResources(techniques) {
  const seen = new Map();
  for (const technique of techniques) {
    if (!technique.resources) {
      continue;
    }
    for (const resource of technique.resources) {
      if (
        typeof resource === 'object' &&
        resource.citationKey &&
        !seen.has(resource.citationKey)
      ) {
        seen.set(resource.citationKey, resource);
      }
    }
  }
  return Array.from(seen.values());
}

// --- Main generation function ---

export async function generateJsonLd(hydratedTechniques, assuranceGoals) {
  // Ensure directories
  await fs.mkdir(path.join(ldDir, 'techniques'), { recursive: true });
  await fs.mkdir(path.join(ldDir, 'goals'), { recursive: true });

  // Transform all entities
  const techniqueNodes = hydratedTechniques.map(transformTechnique);
  const goalNodes = assuranceGoals.map((g) =>
    transformGoal(g, hydratedTechniques)
  );

  // Collect all unique tag paths
  const allTagPaths = new Set();
  for (const technique of hydratedTechniques) {
    for (const tag of technique.tags || []) {
      allTagPaths.add(tag);
    }
  }
  const tagNodes = buildTagHierarchy(allTagPaths);

  // Collect and transform resources
  const resources = collectResources(hydratedTechniques);
  const resourceNodes = resources.map(transformResource).filter(Boolean);

  // --- Write individual technique files ---
  await Promise.all(
    techniqueNodes.map((node) => {
      const slug = node.slug;
      return fs.writeFile(
        path.join(ldDir, 'techniques', `${slug}.jsonld`),
        JSON.stringify(node, null, 2)
      );
    })
  );

  // --- Write individual goal files ---
  await Promise.all(
    goalNodes.map((node) => {
      const slug = node.slug;
      return fs.writeFile(
        path.join(ldDir, 'goals', `${slug}.jsonld`),
        JSON.stringify(node, null, 2)
      );
    })
  );

  // --- Write collection files ---

  // Techniques collection (strip individual @context to reduce size)
  const techniquesCollection = {
    '@context': CONTEXT_URL,
    '@graph': techniqueNodes.map(({ '@context': _ctx, ...rest }) => rest),
  };
  await fs.writeFile(
    path.join(ldDir, 'techniques.jsonld'),
    JSON.stringify(techniquesCollection, null, 2)
  );

  // Goals collection
  const goalsCollection = {
    '@context': CONTEXT_URL,
    '@graph': goalNodes.map(({ '@context': _ctx, ...rest }) => rest),
  };
  await fs.writeFile(
    path.join(ldDir, 'goals.jsonld'),
    JSON.stringify(goalsCollection, null, 2)
  );

  // Tags taxonomy
  const tagsCollection = {
    '@context': CONTEXT_URL,
    '@graph': tagNodes,
  };
  await fs.writeFile(
    path.join(ldDir, 'tags.jsonld'),
    JSON.stringify(tagsCollection, null, 2)
  );

  // Resources collection
  const resourcesCollection = {
    '@context': CONTEXT_URL,
    '@graph': resourceNodes,
  };
  await fs.writeFile(
    path.join(ldDir, 'resources.jsonld'),
    JSON.stringify(resourcesCollection, null, 2)
  );

  // --- Complete graph (all entities in one @graph) ---
  const graph = {
    '@context': CONTEXT_URL,
    '@graph': [
      ...techniqueNodes.map(({ '@context': _ctx, ...rest }) => rest),
      ...goalNodes.map(({ '@context': _ctx, ...rest }) => rest),
      ...tagNodes,
      ...resourceNodes,
    ],
  };
  await fs.writeFile(
    path.join(ldDir, 'graph.jsonld'),
    JSON.stringify(graph, null, 2)
  );

  // --- API discovery document ---
  const index = {
    name: 'TEA Techniques Knowledge Graph',
    version: '1.0.0',
    description:
      'JSON-LD knowledge graph of AI assurance techniques from the TEA project',
    generated: new Date().toISOString(),
    baseUrl: `${BASE_URL}/data/ld`,
    endpoints: {
      context: `${BASE_URL}/data/ld/context.jsonld`,
      graph: `${BASE_URL}/data/ld/graph.jsonld`,
      techniques: `${BASE_URL}/data/ld/techniques.jsonld`,
      goals: `${BASE_URL}/data/ld/goals.jsonld`,
      tags: `${BASE_URL}/data/ld/tags.jsonld`,
      resources: `${BASE_URL}/data/ld/resources.jsonld`,
    },
    entityCounts: {
      techniques: techniqueNodes.length,
      goals: goalNodes.length,
      tags: tagNodes.length,
      resources: resourceNodes.length,
    },
    note: 'GitHub Pages serves .jsonld files as application/octet-stream. Consumers should parse as JSON regardless of Content-Type.',
  };
  await fs.writeFile(
    path.join(ldDir, 'index.json'),
    JSON.stringify(index, null, 2)
  );

  // biome-ignore lint/suspicious/noConsole: build script output
  console.log(
    `✓ Generated JSON-LD: ${techniqueNodes.length} techniques, ${goalNodes.length} goals, ${tagNodes.length} tags, ${resourceNodes.length} resources`
  );
}

// --- Standalone execution ---

async function main() {
  // Load hydrated data from already-generated files
  const techniques = JSON.parse(
    await fs.readFile(path.join(dataDir, 'techniques.json'), 'utf-8')
  );

  // Try to load hydrated individual technique files (which have resolved resources)
  // If individual files exist, they have hydrated resources; fall back to source
  let hydratedTechniques;
  try {
    const files = await fs.readdir(path.join(dataDir, 'techniques'));
    const jsonFiles = files.filter((f) => f.endsWith('.json'));
    if (jsonFiles.length > 0) {
      hydratedTechniques = await Promise.all(
        jsonFiles.map(async (f) => {
          const content = await fs.readFile(
            path.join(dataDir, 'techniques', f),
            'utf-8'
          );
          return JSON.parse(content);
        })
      );
    } else {
      hydratedTechniques = techniques;
    }
  } catch {
    hydratedTechniques = techniques;
  }

  const assuranceGoals = JSON.parse(
    await fs.readFile(path.join(dataDir, 'assurance-goals.json'), 'utf-8')
  );

  await generateJsonLd(hydratedTechniques, assuranceGoals);
}

// Run standalone if executed directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-jsonld.js') ||
    process.argv[1].includes('generate-jsonld'))
) {
  main().catch((error) => {
    // biome-ignore lint/suspicious/noConsole: build script error output
    console.error('Failed to generate JSON-LD:', error);
    process.exit(1);
  });
}
