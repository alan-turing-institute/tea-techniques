/**
 * Build in-memory indexes from parsed JSON-LD graph nodes.
 */

import type {
  GoalNode,
  GraphIndex,
  JsonLdNode,
  ResourceNode,
  TagNode,
  TechniqueNode,
} from './types.js';

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function parseTechnique(node: JsonLdNode): TechniqueNode {
  return {
    id: node['@id'],
    slug: node.slug as string,
    name: node.name as string,
    description: node.description as string,
    acronym: node.acronym as string | undefined,
    complexityRating: node.complexityRating as number | undefined,
    computationalCostRating: node.computationalCostRating as number | undefined,
    goals: asStringArray(node.addressesGoal),
    tags: asStringArray(node.hasTag),
    relatedTo: asStringArray(node.relatedTo),
    resources: asStringArray(node.citesResource),
    exampleUseCases:
      (node.exampleUseCases as TechniqueNode['exampleUseCases']) ?? [],
    limitations: (node.limitations as TechniqueNode['limitations']) ?? [],
    sampleClaims: (node.sampleClaims as TechniqueNode['sampleClaims']) ?? [],
  };
}

function parseGoal(node: JsonLdNode): GoalNode {
  return {
    id: node['@id'],
    slug: node.slug as string,
    name: node.name as string,
    description: node.description as string,
    techniqueCount: node.techniqueCount as number,
    techniques: asStringArray(node.hasTechnique),
  };
}

function parseTag(node: JsonLdNode): TagNode {
  return {
    id: node['@id'],
    prefLabel: node.prefLabel as string,
    path: node.path as string,
    category: node.category as string,
    broader: node.broader as string | undefined,
    narrower: asStringArray(node.narrower),
  };
}

function parseResource(node: JsonLdNode): ResourceNode {
  return {
    id: node['@id'],
    name: node.name as string,
    citationKey: node.citationKey as string,
    url: node.url as string | undefined,
    sourceType: node.sourceType as string | undefined,
    authors: node.authors as string[] | undefined,
    publicationDate: node.publicationDate as string | undefined,
    abstract: node.abstract as string | undefined,
  };
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

export function buildGraphIndex(nodes: JsonLdNode[]): GraphIndex {
  const index: GraphIndex = {
    techniques: new Map(),
    goals: new Map(),
    tags: new Map(),
    resources: new Map(),
    techniqueToGoals: new Map(),
    goalToTechniques: new Map(),
    techniqueToTags: new Map(),
    tagToTechniques: new Map(),
    techniqueToRelated: new Map(),
    techniqueToResources: new Map(),
    resourceToTechniques: new Map(),
    tagChildren: new Map(),
    tagsByCategory: new Map(),
  };

  // First pass: parse all entities
  for (const node of nodes) {
    const type = node['@type'];
    switch (type) {
      case 'Technique':
        index.techniques.set(node['@id'], parseTechnique(node));
        break;
      case 'AssuranceGoal':
        index.goals.set(node['@id'], parseGoal(node));
        break;
      case 'Tag':
        index.tags.set(node['@id'], parseTag(node));
        break;
      case 'Resource':
        index.resources.set(node['@id'], parseResource(node));
        break;
      default:
        break;
    }
  }

  // Second pass: build adjacency lists from techniques
  for (const technique of index.techniques.values()) {
    const tid = technique.id;

    for (const goalId of technique.goals) {
      getOrCreate(index.techniqueToGoals, tid, () => new Set()).add(goalId);
      getOrCreate(index.goalToTechniques, goalId, () => new Set()).add(tid);
    }

    for (const tagId of technique.tags) {
      getOrCreate(index.techniqueToTags, tid, () => new Set()).add(tagId);
      getOrCreate(index.tagToTechniques, tagId, () => new Set()).add(tid);
    }

    for (const relId of technique.relatedTo) {
      getOrCreate(index.techniqueToRelated, tid, () => new Set()).add(relId);
    }

    for (const resId of technique.resources) {
      getOrCreate(index.techniqueToResources, tid, () => new Set()).add(resId);
      getOrCreate(index.resourceToTechniques, resId, () => new Set()).add(tid);
    }
  }

  // Third pass: build tag hierarchy indexes
  for (const tag of index.tags.values()) {
    if (tag.broader) {
      getOrCreate(index.tagChildren, tag.broader, () => new Set()).add(tag.id);
    }
    getOrCreate(index.tagsByCategory, tag.category, () => new Set()).add(
      tag.id
    );
  }

  return index;
}
