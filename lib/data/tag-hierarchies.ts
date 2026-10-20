import { tagDefinitions } from './tag-definitions';

/**
 * Tag Hierarchies Configuration
 *
 * This file defines the hierarchical structure for assurance goal tags in the TEA Techniques database.
 * It enables dynamic grouping of tags into meaningful dimensions for better organization and navigation.
 *
 * USAGE:
 * - Import this configuration in components that need to display hierarchical tags
 * - The system automatically groups tags based on their path structure
 * - Each assurance goal can define its own dimensional organisation
 *
 * EXTENDING:
 * To add hierarchical tagging for a new assurance goal:
 * 1. Add a new entry to TAG_HIERARCHIES with the goal name as key
 * 2. Define dimensions with their prefixes and display names
 * 3. Optionally set displayOrder to control the order of dimension groups
 * 4. Add descriptions for each dimension to help users understand the grouping
 *
 * EXAMPLE:
 * fairness: {
 *   dimensions: {
 *     'bias-measurement': { name: 'Bias Measurement', order: 1 },
 *     'bias-diagnosis': { name: 'Bias Diagnosis', order: 2 }
 *   }
 * }
 */

export interface DimensionConfig {
  /** Display name for this dimension category */
  name: string;
  /** Optional order for displaying dimension groups (lower numbers appear first) */
  order?: number;
  /** Optional description explaining this dimension */
  description?: string;
  /** Icon name or component to use for this dimension (optional) */
  icon?: string;
}

export interface HierarchyConfig {
  /**
   * Map of dimension prefixes to their configuration
   * The key is the path segment that identifies this dimension
   * e.g., 'attribution-methods', 'property', 'explains'
   */
  dimensions: Record<string, DimensionConfig>;
  /**
   * Optional display order for dimensions not explicitly ordered
   * Defaults to alphabetical if not specified
   */
  defaultOrder?: string[];
  /**
   * Whether to show dimensions even if they have no tags
   * Useful during development or for placeholder dimensions
   */
  showEmptyDimensions?: boolean;
}

/**
 * Main configuration object for tag hierarchies
 * Each assurance goal that uses hierarchical tagging should have an entry here
 */
export const TAG_HIERARCHIES: Record<string, HierarchyConfig> = {
  /**
   * EXPLAINABILITY HIERARCHY
   * Based on the three-dimensional classification system:
   * 1. Method - HOW the technique works
   * 2. Target - WHAT the technique explains
   * 3. Property - QUALITY characteristics
   */
  explainability: {
    dimensions: {
      // METHOD DIMENSION - Primary algorithmic approaches
      'attribution-methods': {
        name: 'Attribution Methods',
        order: 1,
        description:
          'Techniques that assign importance scores to inputs/features',
        icon: 'chart-bar',
      },
      'surrogate-models': {
        name: 'Surrogate Models',
        order: 2,
        description:
          'Techniques that approximate complex models with interpretable ones',
        icon: 'layers',
      },
      'visualization-methods': {
        name: 'Visualization Methods',
        order: 3,
        description:
          'Techniques focused on visual representation of model behavior',
        icon: 'image',
      },
      'representation-analysis': {
        name: 'Representation Analysis',
        order: 4,
        description: 'Techniques analyzing internal model representations',
        icon: 'cpu',
      },
      'instance-based': {
        name: 'Instance-Based Methods',
        order: 5,
        description: 'Techniques using example-based explanations',
        icon: 'database',
      },
      'causal-analysis': {
        name: 'Causal Analysis',
        order: 7,
        description: 'Techniques examining causal relationships',
        icon: 'git-branch',
      },

      'explanation-evaluation': {
        name: 'Explanation Evaluation',
        order: 6,
        description:
          tagDefinitions[
            'assurance-goal-category/explainability/explanation-evaluation'
          ],
      },
      'human-evaluation': {
        name: 'Human Evaluation',
        order: 8,
        description:
          tagDefinitions[
            'assurance-goal-category/explainability/human-evaluation'
          ],
      },

      // TARGET DIMENSION - What aspect is being explained
      explains: {
        name: 'Explanation Target',
        order: 10,
        description:
          'The aspect of model behavior or data that the technique reveals',
        icon: 'target',
      },

      // PROPERTY DIMENSION - Quality characteristics
      property: {
        name: 'Properties',
        order: 20,
        description: 'Key quality characteristics of the explanation',
        icon: 'check-circle',
      },

      // SCOPE DIMENSION - Explanatory scope
      'explanatory-scope': {
        name: 'Explanatory Scope',
        order: 25,
        description:
          'Whether explanations apply to individual predictions or the entire model',
        icon: 'network',
      },
    },
    defaultOrder: ['Method', 'Target', 'Property', 'Scope'],
    showEmptyDimensions: false,
  },

  /**
   * APPLICABLE MODELS HIERARCHY
   * Three-dimensional classification system for model applicability:
   * 1. Architecture - MODEL FAMILY (what type of model)
   * 2. Paradigm - COMPUTATIONAL APPROACH (how it learns)
   * 3. Requirements - TECHNICAL PREREQUISITES (what access is needed)
   *
   * Note: Unlike assurance goals, this hierarchy applies to the 'applicable-models'
   * category directly, not through 'assurance-goal-category'.
   */
  'applicable-models': {
    dimensions: {
      // ARCHITECTURE DIMENSION - Model family/type
      architecture: {
        name: 'Architecture',
        order: 1,
        description:
          'The fundamental architectural pattern or learning paradigm of the model',
        icon: 'cpu',
      },

      // PARADIGM DIMENSION - Computational approach
      paradigm: {
        name: 'Paradigm',
        order: 2,
        description: 'The computational paradigm or learning approach',
        icon: 'git-branch',
      },

      // REQUIREMENTS DIMENSION - Technical prerequisites
      requirements: {
        name: 'Requirements',
        order: 3,
        description: 'Technical requirements or access levels needed',
        icon: 'shield',
      },
    },
    defaultOrder: ['Architecture', 'Paradigm', 'Requirements'],
    showEmptyDimensions: false,
  },

  /**
   * LIFECYCLE STAGE HIERARCHY
   * 12-stage project lifecycle model organized into three main categories:
   * 1. Project Design - Planning, formulation, data procurement, and analysis
   * 2. Model Development - Preprocessing, training, testing, and documentation
   * 3. System Deployment - Implementation, training, monitoring, and deprovisioning
   * Plus an "Other" category for cross-cutting concerns
   */
  'lifecycle-stage': {
    dimensions: {
      // PROJECT DESIGN - Early-stage planning and data work
      'project-design': {
        name: 'Project Design',
        order: 1,
        description:
          'Early-stage activities focused on scoping, planning, and understanding the problem domain and data landscape',
        icon: 'clipboard',
      },

      // MODEL DEVELOPMENT - Building and validating the model
      'model-development': {
        name: 'Model Development',
        order: 2,
        description:
          'Activities focused on preparing data, building, training, testing, and documenting the AI model',
        icon: 'cpu',
      },

      // SYSTEM DEPLOYMENT - Production deployment and operations
      'system-deployment': {
        name: 'System Deployment',
        order: 3,
        description:
          'Activities focused on deploying, operating, maintaining, and monitoring the AI system in production',
        icon: 'rocket',
      },

      // OTHER - Cross-cutting concerns
      other: {
        name: 'Other',
        order: 4,
        description:
          'Techniques that apply across several stages; each also carries the stages it applies to',
        icon: 'more-horizontal',
      },
    },
    defaultOrder: [
      'Project Design',
      'Model Development',
      'System Deployment',
      'Other',
    ],
    showEmptyDimensions: false,
  },

  ...Object.fromEntries(
    [
      'safety',
      'security',
      'reliability',
      'privacy',
      'fairness',
      'transparency',
      'general',
    ].map((goal) => [
      goal,
      {
        dimensions: Object.fromEntries(
          Object.entries(tagDefinitions)
            .filter(
              ([tag]) =>
                tag.startsWith(`assurance-goal-category/${goal}/`) &&
                tag.split('/').length === 3
            )
            .map(([tag, description], order) => {
              const value = tag.split('/')[2];
              return [
                value,
                { name: formatSlugToSentence(value), description, order },
              ];
            })
        ),
        showEmptyDimensions: false,
      },
    ])
  ),
};

/**
 * Helper to get dimension config from a hierarchy
 */
function getDimensionConfig(
  hierarchyKey: string,
  dimensionKey: string
): { dimension: string; config: DimensionConfig } | null {
  const hierarchy = TAG_HIERARCHIES[hierarchyKey];
  if (!hierarchy) {
    return null;
  }

  const config = hierarchy.dimensions[dimensionKey];
  if (!config) {
    return null;
  }

  return { dimension: dimensionKey, config };
}

/**
 * Helper function to get dimension info for a tag
 * @param tag - The full tag path (e.g., 'assurance-goal-category/explainability/property/completeness' or 'applicable-models/architecture/model-agnostic')
 * @returns The dimension configuration if found, null otherwise
 */
export function getDimensionForTag(
  tag: string
): { dimension: string; config: DimensionConfig } | null {
  const parts = tag.split('/');

  if (parts.length < 2) {
    return null;
  }

  const category = parts[0];

  // Handle assurance-goal-category tags (e.g., explainability, fairness)
  if (category === 'assurance-goal-category' && parts.length >= 3) {
    const goal = parts[1];
    const dimensionKey = parts[2];
    return getDimensionConfig(goal, dimensionKey);
  }

  // Handle applicable-models tags
  if (category === 'applicable-models' && parts.length >= 2) {
    const dimensionKey = parts[1];
    return getDimensionConfig('applicable-models', dimensionKey);
  }

  // Handle lifecycle-stage tags
  if (category === 'lifecycle-stage' && parts.length >= 2) {
    const dimensionKey = parts[1];
    return getDimensionConfig('lifecycle-stage', dimensionKey);
  }

  return null;
}

/**
 * Helper function to add a tag to a grouped dimension
 */
function addTagToGroup(
  grouped: Record<string, { config: DimensionConfig; tags: string[] }>,
  dimension: string,
  config: DimensionConfig,
  tag: string
): void {
  if (!grouped[dimension]) {
    grouped[dimension] = { config, tags: [] };
  }
  grouped[dimension].tags.push(tag);
}

/**
 * Handle special case tags like explanatory-scope
 */
function handleSpecialTag(
  tag: string,
  goal: string,
  hierarchy: HierarchyConfig,
  grouped: Record<string, { config: DimensionConfig; tags: string[] }>
): boolean {
  // Special handling for explanatory-scope tags in explainability
  if (goal === 'explainability' && tag.startsWith('explanatory-scope/')) {
    const scopeConfig = hierarchy.dimensions['explanatory-scope'];
    if (scopeConfig) {
      addTagToGroup(grouped, 'explanatory-scope', scopeConfig, tag);
    }
    return true;
  }
  return false;
}

/**
 * Process a single tag for categorized hierarchies (applicable-models, lifecycle-stage)
 */
function processCategorizedTag(
  tag: string,
  goal: string,
  grouped: Record<string, { config: DimensionConfig; tags: string[] }>
): boolean {
  if (
    (goal === 'applicable-models' && tag.startsWith('applicable-models/')) ||
    (goal === 'lifecycle-stage' && tag.startsWith('lifecycle-stage/'))
  ) {
    const dimensionInfo = getDimensionForTag(tag);
    if (dimensionInfo) {
      const { dimension, config } = dimensionInfo;
      addTagToGroup(grouped, dimension, config, tag);
    }
    return true;
  }
  return false;
}

/**
 * Process a single tag for assurance goal hierarchies
 */
function processAssuranceGoalTag(
  tag: string,
  goal: string,
  grouped: Record<string, { config: DimensionConfig; tags: string[] }>
): void {
  const dimensionInfo = getDimensionForTag(tag);
  if (dimensionInfo && tag.includes(`assurance-goal-category/${goal}/`)) {
    const { dimension, config } = dimensionInfo;
    addTagToGroup(grouped, dimension, config, tag);
  }
}

/**
 * Groups hierarchical tags by their dimensions
 * @param tags - Array of tag strings
 * @param goal - The assurance goal to group tags for (or 'applicable-models' or 'lifecycle-stage')
 * @returns Object with dimension names as keys and arrays of tags as values
 */
export function groupTagsByDimension(
  tags: string[],
  goal: string
): Record<string, { config: DimensionConfig; tags: string[] }> {
  const hierarchy = TAG_HIERARCHIES[goal];
  if (!hierarchy) {
    return {};
  }

  const grouped: Record<string, { config: DimensionConfig; tags: string[] }> =
    {};

  for (const tag of tags) {
    // Handle categorized tags (applicable-models, lifecycle-stage)
    if (processCategorizedTag(tag, goal, grouped)) {
      continue;
    }

    // Handle special case tags (for assurance goals)
    if (handleSpecialTag(tag, goal, hierarchy, grouped)) {
      continue;
    }

    // Handle regular assurance goal tags
    processAssuranceGoalTag(tag, goal, grouped);
  }

  return grouped;
}

/**
 * Format a slug to title case (e.g. "attribution-methods" → "Attribution Methods")
 */
export function formatSlugToTitle(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format a slug as a sentence with only the first word capitalised
 * (e.g. "confidence-and-limits" → "Confidence and limits")
 */
function formatSlugToSentence(slug: string): string {
  const sentence = slug.replaceAll('-', ' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Resolved display info for a dimension, combining TAG_HIERARCHIES enrichment with fallbacks
 */
export interface ResolvedDimension {
  slug: string;
  name: string;
  description?: string;
  order: number;
  subcategoryCount: number;
  techniqueCount: number;
}

/**
 * Resolves display properties for a goal's dimensions.
 * Uses TAG_HIERARCHIES for curated name/description/order when available,
 * falling back to auto-formatted slugs for unconfigured dimensions.
 */
export function resolveGoalDimensions(
  goalSlug: string,
  dimensions: {
    dimension: string;
    subcategoryCount: number;
    techniqueCount: number;
  }[]
): ResolvedDimension[] {
  const hierarchy = TAG_HIERARCHIES[goalSlug];

  return dimensions
    .map((d, index) => {
      const config = hierarchy?.dimensions[d.dimension];
      return {
        slug: d.dimension,
        name: config?.name ?? formatSlugToTitle(d.dimension),
        description: config?.description,
        order: config?.order ?? 1000 + index,
        subcategoryCount: d.subcategoryCount,
        techniqueCount: d.techniqueCount,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Checks if a goal has hierarchical tagging configured
 * @param goal - The assurance goal name
 * @returns True if hierarchical configuration exists
 */
export function hasHierarchicalTags(goal: string): boolean {
  return goal in TAG_HIERARCHIES;
}

/**
 * Gets the display order for dimensions of a specific goal
 * @param goal - The assurance goal name
 * @returns Ordered array of dimension keys
 */
export function getDimensionOrder(goal: string): string[] {
  const hierarchy = TAG_HIERARCHIES[goal];
  if (!hierarchy) {
    return [];
  }

  // Sort dimensions by their configured order
  return Object.entries(hierarchy.dimensions)
    .sort((a, b) => {
      const orderA = a[1].order ?? 999;
      const orderB = b[1].order ?? 999;
      return orderA - orderB;
    })
    .map(([key]) => key);
}
