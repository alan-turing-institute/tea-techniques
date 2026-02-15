/**
 * KnowledgeGraph: in-memory graph with query methods for all 10 MCP tools.
 */

import Fuse from 'fuse.js';
import { buildGraphIndex } from './indexes.js';
import type {
  GoalNode,
  GraphIndex,
  JsonLdGraph,
  ResourceNode,
  TagNode,
  TechniqueNode,
} from './types.js';

export type {
  GoalNode,
  GraphIndex,
  ResourceNode,
  TagNode,
  TechniqueNode,
} from './types.js';

const WHITESPACE_RE = /\s+/;

// --- Concept-to-tag mapping for claim-based suggestions ---

const CONCEPT_TAGS: Record<string, string[]> = {
  // Uncertainty & calibration (uncertainty-quantification is a real tag path)
  uncertain: ['uncertainty-quantification'],
  confidence: ['uncertainty-quantification'],
  calibrat: ['uncertainty-quantification'],
  converge: ['uncertainty-quantification'],
  // Detection & monitoring (monitoring is a real tag path under lifecycle + safety)
  detect: ['monitoring'],
  monitor: ['monitoring'],
  'out-of-distribution': ['monitoring'],
  anomal: ['monitoring'],
  // Governance & process (process is technique-type, human-oversight is under safety)
  interpret: ['process', 'human-oversight'],
  clinician: ['process', 'human-oversight', 'documentation'],
  stakeholder: ['process', 'human-oversight'],
  actionable: ['process', 'documentation'],
  governance: ['process', 'governance-disclosure'],
  // Explainability methods (attribution is a real tag path under explainability)
  explain: ['attribution', 'feature-importance'],
  'feature importance': ['attribution', 'feature-importance'],
  // Documentation & transparency (documentation is a real tag path)
  document: ['documentation', 'governance-disclosure'],
  audit: ['documentation', 'governance-disclosure'],
  // Sensitivity & fidelity (sensitivity-testing is a real tag path)
  sensitiv: ['sensitivity-testing'],
  fidelity: ['sensitivity-testing'],
};

// --- Helpers to reduce cognitive complexity ---

function collectByRelationship(
  techniqueIds: Set<string>,
  seen: Set<string>,
  techniques: Map<string, TechniqueNode>,
  relationship: string,
  results: Array<{ technique: TechniqueNode; relationship: string }>
): void {
  for (const tid of techniqueIds) {
    if (seen.has(tid)) {
      continue;
    }
    const t = techniques.get(tid);
    if (t) {
      seen.add(tid);
      results.push({ technique: t, relationship });
    }
  }
}

function categoryMatchesDimension(
  category: string,
  dimension: string
): boolean {
  const dimensionCategoryMap: Record<string, string> = {
    lifecycle: 'lifecycle-stage',
    evidence: 'evidence-type',
    'model-types': 'applicable-models',
  };
  const expected = dimensionCategoryMap[dimension];
  if (expected) {
    return category === expected;
  }
  // 'tags' dimension: include all categories
  return true;
}

function buildTagCategoryCoverage(
  techniques: TechniqueNode[],
  tags: Map<string, TagNode>,
  dimension: string
): Record<string, unknown> {
  const catMap = new Map<string, Map<string, number>>();
  for (const t of techniques) {
    for (const tagId of t.tags) {
      const tag = tags.get(tagId);
      if (!(tag && categoryMatchesDimension(tag.category, dimension))) {
        continue;
      }
      const cat = catMap.get(tag.category) ?? new Map<string, number>();
      cat.set(tag.prefLabel, (cat.get(tag.prefLabel) ?? 0) + 1);
      catMap.set(tag.category, cat);
    }
  }
  const result: Record<string, Record<string, number>> = {};
  for (const [cat, labels] of catMap) {
    result[cat] = Object.fromEntries(labels);
  }
  return { dimension, categories: result, total: techniques.length };
}

/** Extract concept tags from claim text using substring matching. */
export function extractConceptTags(claimText: string): string[] {
  const lower = claimText.toLowerCase();
  const tags = new Set<string>();
  for (const [concept, mappedTags] of Object.entries(CONCEPT_TAGS)) {
    if (lower.includes(concept)) {
      for (const tag of mappedTags) {
        tags.add(tag);
      }
    }
  }
  return Array.from(tags);
}

/** Check if a technique matches any of the given concept tag fragments. */
function techniqueMatchesConceptTags(
  technique: TechniqueNode,
  conceptTags: string[]
): boolean {
  return conceptTags.some((concept) =>
    technique.tags.some((tag) => tag.toLowerCase().includes(concept))
  );
}

/** Filter out techniques matching any exclude tag fragment. */
function applyExcludeTags(
  techniques: TechniqueNode[],
  excludeTags: string[]
): TechniqueNode[] {
  const excludeTerms = excludeTags.map((t) => t.toLowerCase());
  return techniques.filter(
    (t) =>
      !excludeTerms.some((term) =>
        t.tags.some((tag) => tag.toLowerCase().includes(term))
      )
  );
}

/** Filter by context tag (include only techniques matching the tag fragment). */
function applyContextFilter(
  techniques: TechniqueNode[],
  term: string
): TechniqueNode[] {
  const lower = term.toLowerCase();
  return techniques.filter((t) =>
    t.tags.some((tag) => tag.toLowerCase().includes(lower))
  );
}

// --- Goal inference from claim keywords ---

const GOAL_KEYWORDS: Record<string, string[]> = {
  explainability: [
    'explain',
    'interpret',
    'understand',
    'transparent',
    'feature importance',
    'attribution',
  ],
  fairness: [
    'fair',
    'bias',
    'equit',
    'discriminat',
    'parity',
    'protected',
    'demographic',
  ],
  privacy: [
    'privacy',
    'confidential',
    'personal data',
    'anonymi',
    'differential privacy',
  ],
  reliability: [
    'reliable',
    'robust',
    'consistent',
    'calibrat',
    'uncertainty',
    'confidence',
    'valid',
    'stable',
  ],
  safety: ['safe', 'harm', 'risk', 'hazard', 'guardrail', 'alignment'],
  security: [
    'secur',
    'attack',
    'adversarial',
    'vulnerab',
    'malicious',
    'injection',
  ],
  transparency: [
    'transparen',
    'document',
    'audit',
    'accountab',
    'model card',
    'datasheet',
    'clinician',
    'stakeholder',
    'actionable',
  ],
};

/** Infer assurance goals from claim text using keyword matching. */
export function inferGoals(claimText: string): string[] {
  const lower = claimText.toLowerCase();
  const goals: string[] = [];
  for (const [goal, keywords] of Object.entries(GOAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      goals.push(goal);
    }
  }
  return goals;
}

/**
 * Build auto-exclusion tags based on which goals were NOT matched.
 * If the claim is not about fairness, exclude fairness-metric noise.
 * Always exclude neural-networks unless modelType suggests otherwise.
 */
export function buildAutoExclusions(
  matchedGoals: string[],
  modelType?: string
): string[] {
  const exclusions: string[] = [];
  // Exclude NN techniques unless the user explicitly specified a NN model type
  const isNnContext =
    modelType?.toLowerCase().includes('neural') ||
    modelType?.toLowerCase().includes('deep');
  if (!isNnContext) {
    exclusions.push('neural-networks');
  }
  // Exclude fairness-metric noise unless the claim is about fairness
  if (!matchedGoals.includes('fairness')) {
    exclusions.push('fairness-metric');
  }
  return exclusions;
}

interface ClaimEntry {
  text: string;
  slug: string;
  techniqueId: string;
}

export class KnowledgeGraph {
  private index: GraphIndex;
  private claimsFuse: Fuse<ClaimEntry>;

  constructor(graphData: JsonLdGraph) {
    this.index = buildGraphIndex(graphData['@graph']);

    // Build flattened claims index for semantic matching
    const claimEntries: ClaimEntry[] = [];
    for (const technique of this.index.techniques.values()) {
      for (const claim of technique.sampleClaims) {
        claimEntries.push({
          text: claim.text,
          slug: technique.slug,
          techniqueId: technique.id,
        });
      }
    }
    this.claimsFuse = new Fuse(claimEntries, {
      keys: ['text'],
      threshold: 0.4,
      distance: 1000,
      includeScore: true,
    });
  }

  // --- Accessors ---

  getTechnique(slug: string): TechniqueNode | undefined {
    return this.index.techniques.get(`tea:technique/${slug}`);
  }

  getGoal(slug: string): GoalNode | undefined {
    return this.index.goals.get(`tea:goal/${slug}`);
  }

  getTag(id: string): TagNode | undefined {
    return this.index.tags.get(id);
  }

  getResource(id: string): ResourceNode | undefined {
    return this.index.resources.get(id);
  }

  getAllTechniques(): TechniqueNode[] {
    return Array.from(this.index.techniques.values());
  }

  getAllGoals(): GoalNode[] {
    return Array.from(this.index.goals.values());
  }

  getAllTags(): TagNode[] {
    return Array.from(this.index.tags.values());
  }

  getAllResources(): ResourceNode[] {
    return Array.from(this.index.resources.values());
  }

  // --- Query methods ---

  findTechniques(filters: {
    query?: string;
    goals?: string[];
    tags?: string[];
    excludeTags?: string[];
    maxComplexity?: number;
    limit?: number;
  }): TechniqueNode[] {
    let results = this.getAllTechniques();
    const maxComplexity = filters.maxComplexity;

    if (filters.goals?.length) {
      const goalIds = new Set(filters.goals.map((g) => `tea:goal/${g}`));
      results = results.filter((t) => t.goals.some((g) => goalIds.has(g)));
    }

    if (filters.tags?.length) {
      const tagTerms = filters.tags.map((t) => t.toLowerCase());
      results = results.filter((t) =>
        tagTerms.every((term) =>
          t.tags.some((tag) => tag.toLowerCase().includes(term))
        )
      );
    }

    if (filters.excludeTags?.length) {
      results = applyExcludeTags(results, filters.excludeTags);
    }

    if (maxComplexity != null) {
      results = results.filter(
        (t) => t.complexityRating == null || t.complexityRating <= maxComplexity
      );
    }

    if (filters.query) {
      // Build a Fuse index over the pre-filtered set for scoped search
      const scopedFuse = new Fuse(results, {
        keys: [
          { name: 'name', weight: 0.4 },
          { name: 'description', weight: 0.3 },
          { name: 'acronym', weight: 0.1 },
        ],
        threshold: 0.3,
        includeScore: true,
        minMatchCharLength: 2,
      });
      results = scopedFuse.search(filters.query).map((r) => r.item);
    }

    const limit = filters.limit ?? 20;
    return results.slice(0, limit);
  }

  compareTechniques(slugs: string[]): Array<{
    technique: TechniqueNode;
    goalNames: string[];
    tagCategories: string[];
    resourceCount: number;
  }> {
    return slugs
      .map((slug) => {
        const technique = this.getTechnique(slug);
        if (!technique) {
          return null;
        }
        const goalNames = technique.goals.map((gId) => {
          const goal = this.index.goals.get(gId);
          return goal?.name ?? gId;
        });
        const tagCategories = [
          ...new Set(
            technique.tags.map((tId) => {
              const tag = this.index.tags.get(tId);
              return tag?.category ?? 'unknown';
            })
          ),
        ];
        return {
          technique,
          goalNames,
          tagCategories,
          resourceCount: technique.resources.length,
        };
      })
      .filter(
        (
          r
        ): r is {
          technique: TechniqueNode;
          goalNames: string[];
          tagCategories: string[];
          resourceCount: number;
        } => r !== null
      );
  }

  findRelated(
    slug: string,
    maxDepth = 1
  ): Array<{
    technique: TechniqueNode;
    relationship: string;
  }> {
    const technique = this.getTechnique(slug);
    if (!technique) {
      return [];
    }

    const results: Array<{ technique: TechniqueNode; relationship: string }> =
      [];
    const seen = new Set<string>([technique.id]);

    // Explicit related
    collectByRelationship(
      new Set(technique.relatedTo),
      seen,
      this.index.techniques,
      'explicit',
      results
    );

    // Same-goal techniques
    if (maxDepth >= 1) {
      for (const goalId of technique.goals) {
        const goalTechniques =
          this.index.goalToTechniques.get(goalId) ?? new Set<string>();
        collectByRelationship(
          goalTechniques,
          seen,
          this.index.techniques,
          'same-goal',
          results
        );
      }
    }

    // Same-tag techniques (only if maxDepth > 1)
    if (maxDepth >= 2) {
      for (const tagId of technique.tags) {
        const tagTechniques =
          this.index.tagToTechniques.get(tagId) ?? new Set<string>();
        collectByRelationship(
          tagTechniques,
          seen,
          this.index.techniques,
          'same-tag',
          results
        );
      }
    }

    return results;
  }

  suggestForClaim(
    claimText: string,
    context?: {
      modelType?: string;
      dataType?: string;
      lifecycleStage?: string;
      excludeModelTypes?: string[];
    }
  ): TechniqueNode[] {
    const matchedGoals = inferGoals(claimText);
    const autoExclusions = buildAutoExclusions(
      matchedGoals,
      context?.modelType
    );

    // Combine auto-exclusions with explicit exclusions
    const allExclusions = [
      ...autoExclusions,
      ...(context?.excludeModelTypes ?? []),
    ];

    // Get goal-filtered base set with auto-exclusions applied
    let results = this.findTechniques({
      goals: matchedGoals.length > 0 ? matchedGoals : undefined,
      excludeTags: allExclusions.length > 0 ? allExclusions : undefined,
      limit: 50,
    });

    // Stage 2a: Narrow by concept tags, with Fuse.js fallback
    const narrowed = this.narrowByConceptTags(results, claimText);

    // Stage 2b: Claims search (parallel path)
    const candidateIds = new Set(results.map((t) => t.id));
    const claimsMatched = this.searchClaims(claimText, candidateIds, 10);

    // Stage 2c: Merge (union, deduplicate, claims-matched first)
    const mergedIds = new Set<string>();
    const merged: TechniqueNode[] = [];
    for (const t of [...claimsMatched, ...narrowed]) {
      if (!mergedIds.has(t.id)) {
        mergedIds.add(t.id);
        merged.push(t);
      }
    }
    results = merged;

    // Stage 3: Apply context filters (include)
    results = this.applyClaimContextFilters(results, context);

    return results.slice(0, 10);
  }

  /** Search the flattened claims index, scoped to candidate techniques. */
  private searchClaims(
    claimText: string,
    candidateIds: Set<string>,
    limit: number
  ): TechniqueNode[] {
    const results = this.claimsFuse.search(claimText);
    const seen = new Set<string>();
    const techniques: TechniqueNode[] = [];
    for (const r of results) {
      const id = r.item.techniqueId;
      if (seen.has(id) || !candidateIds.has(id)) {
        continue;
      }
      seen.add(id);
      const t = this.index.techniques.get(id);
      if (t) {
        techniques.push(t);
      }
      if (techniques.length >= limit) {
        break;
      }
    }
    return techniques;
  }

  /** Narrow results by concept-tag matching with Fuse.js fallback. */
  private narrowByConceptTags(
    results: TechniqueNode[],
    claimText: string
  ): TechniqueNode[] {
    const conceptTags = extractConceptTags(claimText);
    const goalFiltered = results;

    if (conceptTags.length > 0) {
      const conceptMatched = results.filter((t) =>
        techniqueMatchesConceptTags(t, conceptTags)
      );
      if (conceptMatched.length > 0) {
        return conceptMatched;
      }
    }

    // Fall back to Fuse.js search; if nothing matches, keep goal-filtered set
    const fuseResults = this.fuseSearchWithin(results, claimText);
    return fuseResults.length > 0 ? fuseResults : goalFiltered;
  }

  /** Apply include-style context filters from claim context. */
  private applyClaimContextFilters(
    results: TechniqueNode[],
    context?: { modelType?: string; dataType?: string; lifecycleStage?: string }
  ): TechniqueNode[] {
    let filtered = results;
    if (context?.modelType) {
      filtered = applyContextFilter(filtered, context.modelType);
    }
    if (context?.dataType) {
      filtered = applyContextFilter(filtered, context.dataType);
    }
    if (context?.lifecycleStage) {
      filtered = applyContextFilter(filtered, context.lifecycleStage);
    }
    return filtered;
  }

  /** Run Fuse.js fuzzy search scoped to a pre-filtered technique list. */
  private fuseSearchWithin(
    techniques: TechniqueNode[],
    query: string
  ): TechniqueNode[] {
    if (techniques.length === 0) {
      return [];
    }
    const scopedFuse = new Fuse(techniques, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'acronym', weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
    return scopedFuse.search(query).map((r) => r.item);
  }

  findEvidenceTypes(): Array<{
    evidenceType: string;
    techniques: TechniqueNode[];
  }> {
    const evidenceMap = new Map<string, Set<string>>();

    for (const tag of this.index.tags.values()) {
      if (tag.category === 'evidence-type') {
        const techniques = this.index.tagToTechniques.get(tag.id) ?? new Set();
        evidenceMap.set(tag.prefLabel, techniques);
      }
    }

    return Array.from(evidenceMap.entries()).map(([evidenceType, techIds]) => ({
      evidenceType,
      techniques: Array.from(techIds)
        .map((id) => this.index.techniques.get(id))
        .filter((t): t is TechniqueNode => t !== undefined),
    }));
  }

  exploreTaxonomy(
    path?: string,
    _depth = 1,
    includeTechniques = false
  ): {
    tag?: TagNode;
    children: Array<{
      tag: TagNode;
      techniqueCount: number;
      techniques?: TechniqueNode[];
    }>;
  } {
    if (!path) {
      return this.exploreTaxonomyRoot();
    }

    const tagId = path.startsWith('tea:tag/') ? path : `tea:tag/${path}`;
    const tag = this.index.tags.get(tagId);

    const childIds = tag?.narrower ?? [];
    const children = childIds
      .map((cId) => this.buildTaxonomyChild(cId, includeTechniques))
      .filter(
        (
          c
        ): c is {
          tag: TagNode;
          techniqueCount: number;
          techniques?: TechniqueNode[];
        } => c !== null
      );

    return { tag: tag ?? undefined, children };
  }

  private exploreTaxonomyRoot(): {
    children: Array<{
      tag: TagNode;
      techniqueCount: number;
    }>;
  } {
    const categories = new Set<string>();
    for (const tag of this.index.tags.values()) {
      categories.add(tag.category);
    }
    return {
      children: Array.from(categories)
        .sort()
        .map((cat) => {
          const catTags = this.index.tagsByCategory.get(cat) ?? new Set();
          const allTechIds = new Set<string>();
          for (const tagId of catTags) {
            const techs = this.index.tagToTechniques.get(tagId) ?? new Set();
            for (const tid of techs) {
              allTechIds.add(tid);
            }
          }
          return {
            tag: {
              id: `tea:tag/${cat}`,
              prefLabel: cat.replace(/-/g, ' '),
              path: cat,
              category: cat,
              narrower: [],
            },
            techniqueCount: allTechIds.size,
          };
        }),
    };
  }

  private buildTaxonomyChild(
    tagId: string,
    includeTechniques: boolean
  ): {
    tag: TagNode;
    techniqueCount: number;
    techniques?: TechniqueNode[];
  } | null {
    const childTag = this.index.tags.get(tagId);
    if (!childTag) {
      return null;
    }
    const techIds = this.index.tagToTechniques.get(tagId) ?? new Set();
    return {
      tag: childTag,
      techniqueCount: techIds.size,
      ...(includeTechniques
        ? {
            techniques: Array.from(techIds)
              .map((tid) => this.index.techniques.get(tid))
              .filter((t): t is TechniqueNode => t !== undefined),
          }
        : {}),
    };
  }

  coverageStatistics(
    dimension:
      | 'goals'
      | 'tags'
      | 'lifecycle'
      | 'evidence'
      | 'model-types'
      | 'complexity'
      | 'cross-goal'
  ): Record<string, unknown> {
    const techniques = this.getAllTechniques();

    switch (dimension) {
      case 'goals':
        return this.coverageByGoals(techniques);
      case 'complexity':
        return this.coverageByComplexity(techniques);
      case 'cross-goal':
        return this.coverageCrossGoal(techniques);
      default:
        return buildTagCategoryCoverage(techniques, this.index.tags, dimension);
    }
  }

  private coverageByGoals(
    techniques: TechniqueNode[]
  ): Record<string, unknown> {
    const goalCounts: Record<string, number> = {};
    for (const goal of this.index.goals.values()) {
      goalCounts[goal.name] = goal.techniqueCount;
    }
    return { dimension: 'goals', counts: goalCounts, total: techniques.length };
  }

  private coverageByComplexity(
    techniques: TechniqueNode[]
  ): Record<string, unknown> {
    const dist: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      unrated: 0,
    };
    for (const t of techniques) {
      if (t.complexityRating != null) {
        dist[String(t.complexityRating)]++;
      } else {
        dist.unrated++;
      }
    }
    return {
      dimension: 'complexity',
      distribution: dist,
      total: techniques.length,
    };
  }

  private coverageCrossGoal(
    techniques: TechniqueNode[]
  ): Record<string, unknown> {
    const combos: Record<string, number> = {};
    for (const t of techniques) {
      const goals = t.goals
        .map((g) => this.index.goals.get(g)?.name ?? g)
        .sort()
        .join(' + ');
      combos[goals] = (combos[goals] ?? 0) + 1;
    }
    return {
      dimension: 'cross-goal',
      combinations: combos,
      total: techniques.length,
    };
  }

  searchResources(filters: {
    query?: string;
    type?: string;
    technique?: string;
    limit?: number;
  }): Array<{ resource: ResourceNode; techniques: string[] }> {
    let resources = this.getAllResources();

    if (filters.technique) {
      const techId = `tea:technique/${filters.technique}`;
      const resIds = this.index.techniqueToResources.get(techId) ?? new Set();
      resources = resources.filter((r) => resIds.has(r.id));
    }

    if (filters.type) {
      resources = resources.filter((r) => r.sourceType === filters.type);
    }

    if (filters.query) {
      const terms = filters.query.toLowerCase().split(WHITESPACE_RE);
      resources = resources.filter((r) => {
        const text =
          `${r.name} ${r.abstract ?? ''} ${(r.authors ?? []).join(' ')}`.toLowerCase();
        return terms.every((term) => text.includes(term));
      });
    }

    const limit = filters.limit ?? 20;
    return resources.slice(0, limit).map((resource) => ({
      resource,
      techniques: Array.from(
        this.index.resourceToTechniques.get(resource.id) ?? new Set<string>()
      ).map((tid: string) => {
        const t = this.index.techniques.get(tid);
        return t?.slug ?? tid;
      }),
    }));
  }

  getSummary(): {
    techniques: number;
    goals: number;
    tags: number;
    resources: number;
    relationships: {
      techniqueGoal: number;
      techniqueTag: number;
      techniqueRelated: number;
      techniqueResource: number;
    };
  } {
    let techniqueGoal = 0;
    let techniqueTag = 0;
    let techniqueRelated = 0;
    let techniqueResource = 0;

    for (const set of this.index.techniqueToGoals.values()) {
      techniqueGoal += set.size;
    }
    for (const set of this.index.techniqueToTags.values()) {
      techniqueTag += set.size;
    }
    for (const set of this.index.techniqueToRelated.values()) {
      techniqueRelated += set.size;
    }
    for (const set of this.index.techniqueToResources.values()) {
      techniqueResource += set.size;
    }

    return {
      techniques: this.index.techniques.size,
      goals: this.index.goals.size,
      tags: this.index.tags.size,
      resources: this.index.resources.size,
      relationships: {
        techniqueGoal,
        techniqueTag,
        techniqueRelated,
        techniqueResource,
      },
    };
  }
}
