/**
 * TypeScript interfaces for the in-memory knowledge graph.
 */

export interface TechniqueNode {
  id: string;
  slug: string;
  name: string;
  description: string;
  acronym?: string;
  complexityRating?: number;
  computationalCostRating?: number;
  goals: string[];
  tags: string[];
  relatedTo: string[];
  resources: string[];
  exampleUseCases: Array<{ description: string; goal: string }>;
  limitations: Array<{ description: string }>;
  sampleClaims: Array<{ text: string; domain: string; assuranceGoal: string }>;
}

export interface GoalNode {
  id: string;
  slug: string;
  name: string;
  description: string;
  techniqueCount: number;
  techniques: string[];
}

export interface TagNode {
  id: string;
  prefLabel: string;
  path: string;
  category: string;
  broader?: string;
  narrower: string[];
}

export interface ResourceNode {
  id: string;
  name: string;
  citationKey: string;
  url?: string;
  sourceType?: string;
  authors?: string[];
  publicationDate?: string;
  abstract?: string;
}

export interface GraphIndex {
  techniques: Map<string, TechniqueNode>;
  goals: Map<string, GoalNode>;
  tags: Map<string, TagNode>;
  resources: Map<string, ResourceNode>;
  // Adjacency lists
  techniqueToGoals: Map<string, Set<string>>;
  goalToTechniques: Map<string, Set<string>>;
  techniqueToTags: Map<string, Set<string>>;
  tagToTechniques: Map<string, Set<string>>;
  techniqueToRelated: Map<string, Set<string>>;
  techniqueToResources: Map<string, Set<string>>;
  resourceToTechniques: Map<string, Set<string>>;
  // Tag hierarchy
  tagChildren: Map<string, Set<string>>;
  tagsByCategory: Map<string, Set<string>>;
}

export interface JsonLdGraph {
  '@context': string;
  '@graph': JsonLdNode[];
}

export interface JsonLdNode {
  '@id': string;
  '@type': string;
  [key: string]: unknown;
}
