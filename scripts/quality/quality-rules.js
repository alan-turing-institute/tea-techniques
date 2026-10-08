/**
 * Quality rules configuration for the TEA Techniques data quality scoring system.
 *
 * Defines universal tag requirements, goal-conditional rules, outlier detection
 * thresholds, and completeness score weights.
 */

/**
 * Level 1: Universal tag categories that every technique must have at least one tag from.
 */
export const UNIVERSAL_TAG_CATEGORIES = [
  'applicable-models',
  'lifecycle-stage',
  'technique-type',
  'data-requirements',
  'data-type',
  'evidence-type',
  'expertise-needed',
];

/**
 * Level 1 (subtag): Some categories require specific subtag paths.
 * Key = tag category prefix, Value = array of required subtag path prefixes.
 * A technique must have at least one tag matching each prefix.
 */
export const REQUIRED_SUBTAG_RULES = {
  'applicable-models': [
    'applicable-models/architecture/',
    'applicable-models/requirements/',
  ],
};

/**
 * Level 2: Goal-conditional rules.
 * Key = assurance goal name, Value = object with `must` and `should` arrays.
 * - `must`: tag category prefixes that MUST be present (hard gap)
 * - `should`: tag category prefixes that SHOULD be present (soft gap)
 */
export const GOAL_CONDITIONAL_RULES = {
  Explainability: {
    must: ['explanatory-scope/', 'assurance-goal-category/explainability/'],
    should: [],
  },
  Fairness: {
    must: ['assurance-goal-category/fairness/'],
    should: [],
  },
  Privacy: {
    must: ['assurance-goal-category/privacy/'],
    should: [],
  },
  Reliability: {
    must: ['assurance-goal-category/reliability/'],
    should: [],
  },
  Safety: {
    must: ['assurance-goal-category/safety/'],
    should: [],
  },
  Security: {
    must: ['assurance-goal-category/security/'],
    should: [],
  },
  Transparency: {
    must: ['assurance-goal-category/transparency/'],
    should: [],
  },
  General: {
    must: ['assurance-goal-category/general/'],
    should: [],
  },
};

/**
 * All techniques must have a base assurance-goal-category tag for each listed goal.
 * e.g. a technique with assurance_goals: ["Explainability", "Fairness"] must have
 * tags starting with "assurance-goal-category/explainability" and "assurance-goal-category/fairness".
 */
export const REQUIRE_GOAL_BASE_TAG = true;

/**
 * Level 3: Statistical outlier detection threshold.
 * If >= this fraction of peer techniques (same primary goal) have a tag category,
 * techniques missing it are flagged.
 */
export const OUTLIER_THRESHOLD = 0.9;

/**
 * Minimum peer group size for statistical outlier detection.
 * Groups smaller than this skip outlier analysis to avoid noisy results.
 */
export const MIN_PEER_GROUP_SIZE = 10;

/**
 * Weight applied to "should"-level goal-conditional rules in the tag_coverage
 * score component. A value of 0.5 means missing a "should" rule costs half as
 * much as missing a "must" rule.
 */
export const SHOULD_RULE_WEIGHT = 0.5;

/**
 * Completeness score weights (must sum to 1.0).
 *
 * Rebalanced so that taxonomy depth (goal_tag_depth) and tag coverage
 * (which now includes "should" rules at partial weight) carry more influence,
 * while ceiling-hitting components (description, related_techniques) carry less.
 */
export const COMPLETENESS_WEIGHTS = {
  tag_coverage: 0.35,
  description_quality: 0.1,
  use_cases: 0.1,
  limitations: 0.1,
  resources: 0.08,
  related_techniques: 0.02,
  goal_tag_depth: 0.2,
  resource_freshness: 0.05,
};

/**
 * Resource freshness: exponential decay half-life in years.
 * At age = HALF_LIFE, freshness score ≈ 0.37.
 */
export const FRESHNESS_HALF_LIFE_YEARS = 5;

/**
 * Threshold (years) above which a resource is counted as "old".
 */
export const FRESHNESS_OLD_THRESHOLD_YEARS = 5;

/**
 * Scoring thresholds for individual completeness components.
 */
export const SCORE_THRESHOLDS = {
  /** Description length scoring: [minLength, fullScoreLength] */
  description: {
    min_length: 100,
    full_score_length: 200,
  },

  /** Number of limitations for full score */
  limitations: {
    full_score_count: 2,
  },

  /** Number of resources for scoring tiers */
  resources: {
    full_score_count: 3,
  },

  /** Number of valid related techniques for full score */
  related_techniques: {
    full_score_count: 3,
  },

  /** Minimum tag depth for assurance goal tag depth scoring */
  goal_tag_depth: {
    min_depth: 3,
  },
};
