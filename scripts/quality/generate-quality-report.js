#!/usr/bin/env node

/**
 * TEA Techniques Quality Report Generator
 *
 * Analyses techniques.json and produces a structured quality report with:
 * - Tag coverage analysis (universal, goal-conditional, statistical outliers)
 * - Dataset summary statistics
 * - Cross-reference validation
 * - Completeness scoring
 * - Resource freshness analysis
 * - Review staleness tracking
 * - Peer comparison metrics
 *
 * Usage:
 *   node scripts/quality/generate-quality-report.js
 *   node scripts/quality/generate-quality-report.js --output reports/quality-report.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

import {
  COMPLETENESS_WEIGHTS,
  FRESHNESS_HALF_LIFE_YEARS,
  FRESHNESS_OLD_THRESHOLD_YEARS,
  GOAL_CONDITIONAL_RULES,
  MIN_PEER_GROUP_SIZE,
  MUST_EXEMPTIONS,
  OUTLIER_THRESHOLD,
  REQUIRE_GOAL_BASE_TAG,
  REQUIRED_SUBTAG_RULES,
  SCORE_THRESHOLDS,
  SHOULD_RULE_WEIGHT,
  UNIVERSAL_TAG_CATEGORIES,
} from './quality-rules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'public', 'data');
const techniquesPath = path.join(dataDir, 'techniques.json');
const zoteroPath = path.join(dataDir, 'zotero-resources.json');
const enhancementLogPath = path.join(rootDir, '.enhancement-log.json');

// Top-level regex constants
const TRAILING_SLASH_RE = /\/$/;
const WHITESPACE_RE = /\s+/g;
const YEAR_ONLY_RE = /^\d{4}$/;
const ISO_DATE_RE = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/;
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{4})$/;

// Custom logger to handle console usage
const logger = {
  info: (message) => {
    // biome-ignore lint/suspicious/noConsole: CLI tool needs console output
    console.error(message);
  },
  error: (message) => {
    // biome-ignore lint/suspicious/noConsole: CLI tool needs console output
    console.error(message);
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip trailing slash from a string. */
function stripTrailingSlash(str) {
  return str.replace(TRAILING_SLASH_RE, '');
}

/** Convert goal name to slug. */
function goalToSlug(goal) {
  return goal.toLowerCase().replace(WHITESPACE_RE, '-');
}

/** Check if a technique has at least one tag matching a prefix. */
function hasTagPrefix(technique, prefix) {
  return (technique.tags || []).some((tag) => tag.startsWith(prefix));
}

/** The goal's `must` prefixes that apply to this technique, after exemptions. */
function requiredMustPrefixes(technique, rules) {
  return rules.must.filter(
    (prefix) =>
      !(MUST_EXEMPTIONS[prefix] || []).some((exempt) =>
        hasTagPrefix(technique, exempt)
      )
  );
}

/** Check if a technique has at least one tag in a given top-level category. */
function hasTagCategory(technique, category) {
  return hasTagPrefix(technique, `${category}/`);
}

/** Get all tag categories present on a technique. */
function getTagCategories(technique) {
  const categories = new Set();
  for (const tag of technique.tags || []) {
    categories.add(tag.split('/')[0]);
  }
  return categories;
}

/** Round a number to a given number of decimal places. */
function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parse a Zotero date string to a decimal year.
 * Handles: "2024", "2024-01", "2024-01-15", "04/2021", "2024-12-20", etc.
 * Returns null if unparseable.
 */
function parseDateToYear(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const trimmed = dateStr.trim();

  // "YYYY" — just a year
  if (YEAR_ONLY_RE.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  // "YYYY-MM-DD" or "YYYY-MM"
  const isoMatch = trimmed.match(ISO_DATE_RE);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = isoMatch[3] ? Number.parseInt(isoMatch[3], 10) : 1;
    return year + (month - 1) / 12 + (day - 1) / 365;
  }

  // "MM/YYYY"
  const slashMatch = trimmed.match(SLASH_DATE_RE);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10);
    const year = Number.parseInt(slashMatch[2], 10);
    return year + (month - 1) / 12;
  }

  return null;
}

/** Exponential freshness decay: score = exp(-age / halfLife). */
function freshnessDecay(ageYears) {
  return Math.exp(-ageYears / FRESHNESS_HALF_LIFE_YEARS);
}

/** Compute the median of a numeric array. Returns null for empty arrays. */
function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ---------------------------------------------------------------------------
// Module A: Tag Coverage Analysis
// ---------------------------------------------------------------------------

/** Check universal category presence for a single technique. */
function getMissingUniversalCategories(technique) {
  const missing = [];
  for (const category of UNIVERSAL_TAG_CATEGORIES) {
    if (!hasTagCategory(technique, category)) {
      missing.push(category);
    }
  }
  return missing;
}

/** Check subtag rules for a single technique. */
function getMissingSubtags(technique) {
  const missing = [];
  for (const [category, requiredPrefixes] of Object.entries(
    REQUIRED_SUBTAG_RULES
  )) {
    if (hasTagCategory(technique, category)) {
      for (const prefix of requiredPrefixes) {
        if (!hasTagPrefix(technique, prefix)) {
          missing.push(stripTrailingSlash(prefix));
        }
      }
    }
  }
  return missing;
}

function analyseUniversalGaps(techniques) {
  const gaps = [];

  for (const technique of techniques) {
    const missingCategories = getMissingUniversalCategories(technique);
    const missingSubtags = getMissingSubtags(technique);

    // Merge subtag gaps, avoiding duplicates
    for (const label of missingSubtags) {
      if (!missingCategories.includes(label)) {
        missingCategories.push(label);
      }
    }

    if (missingCategories.length > 0) {
      gaps.push({
        slug: technique.slug,
        name: technique.name,
        missing_categories: missingCategories,
      });
    }
  }

  return gaps;
}

/** Check goal-conditional rules for a single technique and goal. */
function getGoalConditionalGapsForGoal(technique, goal) {
  const results = [];
  const rules = GOAL_CONDITIONAL_RULES[goal];
  if (!rules) {
    return results;
  }

  // Check "must" rules
  const mustMissing = requiredMustPrefixes(technique, rules).filter(
    (prefix) => !hasTagPrefix(technique, prefix)
  );
  if (mustMissing.length > 0) {
    results.push({
      slug: technique.slug,
      name: technique.name,
      goal,
      missing: mustMissing.map(stripTrailingSlash),
      level: 'must',
    });
  }

  // Check "should" rules
  const shouldMissing = rules.should.filter(
    (prefix) => !hasTagPrefix(technique, prefix)
  );
  if (shouldMissing.length > 0) {
    results.push({
      slug: technique.slug,
      name: technique.name,
      goal,
      missing: shouldMissing.map(stripTrailingSlash),
      level: 'should',
    });
  }

  // Check base assurance-goal-category tag
  if (REQUIRE_GOAL_BASE_TAG) {
    const basePrefix = `assurance-goal-category/${goalToSlug(goal)}`;
    if (!hasTagPrefix(technique, basePrefix)) {
      results.push({
        slug: technique.slug,
        name: technique.name,
        goal,
        missing: [basePrefix],
        level: 'must',
      });
    }
  }

  return results;
}

function analyseGoalConditionalGaps(techniques) {
  const gaps = [];

  for (const technique of techniques) {
    for (const goal of technique.assurance_goals || []) {
      gaps.push(...getGoalConditionalGapsForGoal(technique, goal));
    }
  }

  return gaps;
}

/** Build peer groups keyed by primary (first) assurance goal. */
function buildPeerGroups(techniques) {
  const groups = {};
  for (const technique of techniques) {
    const primaryGoal = (technique.assurance_goals || [])[0];
    if (!primaryGoal) {
      continue;
    }
    if (!groups[primaryGoal]) {
      groups[primaryGoal] = [];
    }
    groups[primaryGoal].push(technique);
  }
  return groups;
}

/** Compute tag category coverage counts for a peer group. */
function computeCategoryCoverage(peers, allCategories) {
  const counts = {};
  for (const cat of allCategories) {
    counts[cat] = 0;
  }
  for (const peer of peers) {
    for (const cat of getTagCategories(peer)) {
      counts[cat]++;
    }
  }
  return counts;
}

/** Find outliers within a single peer group. */
function findOutliersInGroup(goal, peers, categoryCounts) {
  const outliers = [];
  for (const technique of peers) {
    const presentCategories = getTagCategories(technique);

    for (const [cat, count] of Object.entries(categoryCounts)) {
      const coveragePct = count / peers.length;
      if (coveragePct >= OUTLIER_THRESHOLD && !presentCategories.has(cat)) {
        outliers.push({
          slug: technique.slug,
          name: technique.name,
          goal,
          missing_tag_category: cat,
          peer_coverage_pct: round(coveragePct * 100),
        });
      }
    }
  }
  return outliers;
}

function analyseStatisticalOutliers(techniques) {
  const peerGroups = buildPeerGroups(techniques);

  // Collect all tag categories across dataset
  const allCategories = new Set();
  for (const technique of techniques) {
    for (const cat of getTagCategories(technique)) {
      allCategories.add(cat);
    }
  }

  const outliers = [];
  for (const [goal, peers] of Object.entries(peerGroups)) {
    if (peers.length < MIN_PEER_GROUP_SIZE) {
      continue;
    }
    const categoryCounts = computeCategoryCoverage(peers, allCategories);
    outliers.push(...findOutliersInGroup(goal, peers, categoryCounts));
  }

  return outliers;
}

// ---------------------------------------------------------------------------
// Module B: Dataset Summary Statistics
// ---------------------------------------------------------------------------

function computeSummary(techniques, completenessScores) {
  const techniquesByGoal = {};
  let totalTags = 0;

  for (const technique of techniques) {
    totalTags += (technique.tags || []).length;
    for (const goal of technique.assurance_goals || []) {
      techniquesByGoal[goal] = (techniquesByGoal[goal] || 0) + 1;
    }
  }

  const scores = completenessScores.map((s) => s.score);
  const avgScore =
    scores.length > 0
      ? round(scores.reduce((a, b) => a + b, 0) / scores.length, 1)
      : 0;

  const techniquesWithIssues = completenessScores.filter(
    (s) => s.issues.length > 0
  ).length;
  const totalIssues = completenessScores.reduce(
    (sum, s) => sum + s.issues.length,
    0
  );

  return {
    total_techniques: techniques.length,
    techniques_by_goal: techniquesByGoal,
    avg_tags_per_technique: round(totalTags / techniques.length, 1),
    avg_completeness_score: avgScore,
    techniques_with_issues: techniquesWithIssues,
    total_issues: totalIssues,
  };
}

// ---------------------------------------------------------------------------
// Module C: Cross-Reference Validation
// ---------------------------------------------------------------------------

/** Build adjacency map and collect invalid slug references. */
function buildAdjacencyAndInvalids(techniques, slugSet) {
  const adjacency = {};
  const invalidSlugs = [];
  const incomingCounts = {};

  for (const slug of slugSet) {
    incomingCounts[slug] = 0;
  }

  for (const technique of techniques) {
    const related = technique.related_techniques || [];
    adjacency[technique.slug] = new Set(related);

    const invalid = related.filter((r) => !slugSet.has(r));
    if (invalid.length > 0) {
      invalidSlugs.push({
        slug: technique.slug,
        invalid_related: invalid,
      });
    }

    for (const r of related) {
      if (slugSet.has(r)) {
        incomingCounts[r]++;
      }
    }
  }

  return { adjacency, invalidSlugs, incomingCounts };
}

/** Check a single pair for asymmetry and return a result or null. */
function checkPairAsymmetry(source, target, adjacency) {
  const sourceListsTarget = adjacency[source]?.has(target);
  const targetListsSource = adjacency[target]?.has(source);

  if (sourceListsTarget && !targetListsSource) {
    return { source, target, direction: 'a_lists_b_but_not_reverse' };
  }
  if (!sourceListsTarget && targetListsSource) {
    return {
      source: target,
      target: source,
      direction: 'a_lists_b_but_not_reverse',
    };
  }
  return null;
}

/** Find asymmetric relationships from the adjacency map. */
function findAsymmetricRelationships(techniques, slugSet, adjacency) {
  const asymmetric = [];
  const seen = new Set();

  for (const technique of techniques) {
    const source = technique.slug;
    for (const target of technique.related_techniques || []) {
      if (!slugSet.has(target)) {
        continue;
      }

      const pairId = [source, target].sort().join('|');
      if (seen.has(pairId)) {
        continue;
      }
      seen.add(pairId);

      const result = checkPairAsymmetry(source, target, adjacency);
      if (result) {
        asymmetric.push(result);
      }
    }
  }

  return asymmetric;
}

function validateCrossReferences(techniques) {
  const slugSet = new Set(techniques.map((t) => t.slug));
  const { adjacency, invalidSlugs, incomingCounts } = buildAdjacencyAndInvalids(
    techniques,
    slugSet
  );

  const asymmetric = findAsymmetricRelationships(
    techniques,
    slugSet,
    adjacency
  );

  const orphans = Object.entries(incomingCounts)
    .filter(([, count]) => count === 0)
    .map(([slug]) => slug)
    .sort();

  return {
    invalid_slugs: invalidSlugs,
    asymmetric_relationships: asymmetric,
    orphan_techniques: orphans,
  };
}

// ---------------------------------------------------------------------------
// Module D: Completeness Scoring
// ---------------------------------------------------------------------------

/** Count present universal categories for a technique. */
function countUniversalPresent(technique) {
  let count = 0;
  for (const category of UNIVERSAL_TAG_CATEGORIES) {
    if (hasTagCategory(technique, category)) {
      count++;
    }
  }
  return count;
}

/** Count required/present subtag rules for a technique. */
function countSubtagCoverage(technique) {
  let required = 0;
  let present = 0;
  for (const [category, requiredPrefixes] of Object.entries(
    REQUIRED_SUBTAG_RULES
  )) {
    if (hasTagCategory(technique, category)) {
      for (const prefix of requiredPrefixes) {
        required++;
        if (hasTagPrefix(technique, prefix)) {
          present++;
        }
      }
    }
  }
  return { required, present };
}

/** Count required/present goal-conditional must rules for a technique. */
function countGoalMustCoverage(technique) {
  let required = 0;
  let present = 0;
  for (const goal of technique.assurance_goals || []) {
    const rules = GOAL_CONDITIONAL_RULES[goal];
    if (!rules) {
      continue;
    }
    for (const prefix of requiredMustPrefixes(technique, rules)) {
      required++;
      if (hasTagPrefix(technique, prefix)) {
        present++;
      }
    }
  }
  return { required, present };
}

/** Count required/present goal-conditional should rules (partial weight). */
function countGoalShouldCoverage(technique) {
  let required = 0;
  let present = 0;
  for (const goal of technique.assurance_goals || []) {
    const rules = GOAL_CONDITIONAL_RULES[goal];
    if (!rules) {
      continue;
    }
    for (const prefix of rules.should) {
      required += SHOULD_RULE_WEIGHT;
      if (hasTagPrefix(technique, prefix)) {
        present += SHOULD_RULE_WEIGHT;
      }
    }
  }
  return { required, present };
}

/** Count universal + subtag + goal-conditional required/present tags. */
function countTagCoverageParts(technique) {
  const subtag = countSubtagCoverage(technique);
  const goalMust = countGoalMustCoverage(technique);
  const goalShould = countGoalShouldCoverage(technique);

  return {
    requiredCount:
      UNIVERSAL_TAG_CATEGORIES.length +
      subtag.required +
      goalMust.required +
      goalShould.required,
    presentCount:
      countUniversalPresent(technique) +
      subtag.present +
      goalMust.present +
      goalShould.present,
  };
}

function scoreTagCoverage(technique) {
  const { requiredCount, presentCount } = countTagCoverageParts(technique);
  return requiredCount > 0 ? presentCount / requiredCount : 1;
}

function scoreDescriptionQuality(technique) {
  const length = (technique.description || '').length;
  const { min_length, full_score_length } = SCORE_THRESHOLDS.description;

  if (length >= full_score_length) {
    return 1;
  }
  if (length >= min_length) {
    return 0.5;
  }
  return 0;
}

function scoreUseCases(technique) {
  const goals = technique.assurance_goals || [];
  const useCases = technique.example_use_cases || [];

  if (goals.length === 0) {
    return useCases.length > 0 ? 1 : 0;
  }

  // General techniques have goal-agnostic use cases with specific goal labels
  // — having any use cases counts as full coverage
  if (goals.includes('General')) {
    return useCases.length > 0 ? 1 : 0;
  }

  const goalsWithUseCase = new Set(useCases.map((uc) => uc.goal));
  const covered = goals.filter((g) => goalsWithUseCase.has(g)).length;

  return covered / goals.length;
}

function scoreLimitations(technique) {
  const count = (technique.limitations || []).length;
  const { full_score_count } = SCORE_THRESHOLDS.limitations;

  if (count >= full_score_count) {
    return 1;
  }
  if (count === 1) {
    return 0.5;
  }
  return 0;
}

function scoreResources(technique) {
  const count = (technique.resources || []).length;
  const { full_score_count } = SCORE_THRESHOLDS.resources;

  if (count >= full_score_count) {
    return 1;
  }
  if (count > 0) {
    return round(count / full_score_count);
  }
  return 0;
}

function scoreRelatedTechniques(technique, slugSet) {
  const related = (technique.related_techniques || []).filter((r) =>
    slugSet.has(r)
  );
  const { full_score_count } = SCORE_THRESHOLDS.related_techniques;

  if (related.length >= full_score_count) {
    return 1;
  }
  if (related.length > 0) {
    return round(related.length / full_score_count);
  }
  return 0;
}

function scoreGoalTagDepth(technique) {
  const goals = technique.assurance_goals || [];
  if (goals.length === 0) {
    return 1;
  }

  const { min_depth } = SCORE_THRESHOLDS.goal_tag_depth;
  let goalsWithDepth = 0;

  for (const goal of goals) {
    // General goal has no deep taxonomy — exempt from depth-3 requirement
    if (goal === 'General') {
      goalsWithDepth++;
      continue;
    }
    const prefix = `assurance-goal-category/${goalToSlug(goal)}`;
    const hasDeepTag = (technique.tags || []).some((tag) => {
      if (!tag.startsWith(prefix)) {
        return false;
      }
      return tag.split('/').length >= min_depth;
    });
    if (hasDeepTag) {
      goalsWithDepth++;
    }
  }

  return goalsWithDepth / goals.length;
}

/** Get issues for missing universal tag categories. */
function getUniversalCategoryIssues(technique) {
  const issues = [];
  for (const category of UNIVERSAL_TAG_CATEGORIES) {
    if (!hasTagCategory(technique, category)) {
      issues.push(`Missing ${category} tag`);
    }
  }
  return issues;
}

/** Get issues for missing required subtags. */
function getSubtagIssues(technique) {
  const issues = [];
  for (const [category, requiredPrefixes] of Object.entries(
    REQUIRED_SUBTAG_RULES
  )) {
    if (hasTagCategory(technique, category)) {
      for (const prefix of requiredPrefixes) {
        if (!hasTagPrefix(technique, prefix)) {
          issues.push(`Missing ${stripTrailingSlash(prefix)} subtag`);
        }
      }
    }
  }
  return issues;
}

/** Get issues for missing goal-conditional must tags. */
function getGoalMustIssues(technique) {
  const issues = [];
  for (const goal of technique.assurance_goals || []) {
    const rules = GOAL_CONDITIONAL_RULES[goal];
    if (!rules) {
      continue;
    }
    for (const prefix of requiredMustPrefixes(technique, rules)) {
      if (!hasTagPrefix(technique, prefix)) {
        issues.push(
          `${goal}: missing required ${stripTrailingSlash(prefix)} tag`
        );
      }
    }
  }
  return issues;
}

/** Collect tag-related issues for a technique. */
function collectTagIssues(technique) {
  return [
    ...getUniversalCategoryIssues(technique),
    ...getSubtagIssues(technique),
    ...getGoalMustIssues(technique),
  ];
}

/** Get use-case-related issues for a technique. */
function getUseCaseIssues(technique) {
  const goals = technique.assurance_goals || [];
  const useCases = technique.example_use_cases || [];

  if (useCases.length === 0) {
    return ['No example use cases'];
  }

  // General techniques have use cases with specific goal labels — skip goal matching
  if (goals.includes('General')) {
    return [];
  }

  const goalsWithUseCase = new Set(useCases.map((uc) => uc.goal));
  const missing = goals.filter((g) => !goalsWithUseCase.has(g));

  if (missing.length > 0) {
    return [`Missing use cases for: ${missing.join(', ')}`];
  }
  return [];
}

/** Collect content-related issues for a technique. */
function collectContentIssues(technique, breakdown, slugSet) {
  const issues = [];

  if (breakdown.description_quality < 1) {
    const length = (technique.description || '').length;
    issues.push(`Short description (${length} chars)`);
  }

  if (breakdown.use_cases < 1) {
    issues.push(...getUseCaseIssues(technique));
  }

  const limitCount = (technique.limitations || []).length;
  if (limitCount === 0) {
    issues.push('No limitations listed');
  } else if (limitCount === 1) {
    issues.push('Only 1 limitation');
  }

  const resourceCount = (technique.resources || []).length;
  if (resourceCount < SCORE_THRESHOLDS.resources.full_score_count) {
    issues.push(
      `Only ${resourceCount} resource${resourceCount === 1 ? '' : 's'}`
    );
  }

  const validRelated = (technique.related_techniques || []).filter((r) =>
    slugSet.has(r)
  );
  if (
    validRelated.length < SCORE_THRESHOLDS.related_techniques.full_score_count
  ) {
    issues.push(`Only ${validRelated.length} valid related techniques`);
  }

  if (breakdown.goal_tag_depth < 1) {
    issues.push('Missing depth-3+ assurance-goal-category tags for some goals');
  }

  return issues;
}

function computeCompletenessScores(
  techniques,
  freshnessScoreBySlug = new Map()
) {
  const slugSet = new Set(techniques.map((t) => t.slug));
  const scores = [];

  for (const technique of techniques) {
    const breakdown = {
      tag_coverage: round(scoreTagCoverage(technique)),
      description_quality: round(scoreDescriptionQuality(technique)),
      use_cases: round(scoreUseCases(technique)),
      limitations: round(scoreLimitations(technique)),
      resources: round(scoreResources(technique)),
      related_techniques: round(scoreRelatedTechniques(technique, slugSet)),
      goal_tag_depth: round(scoreGoalTagDepth(technique)),
      resource_freshness: round(
        freshnessScoreBySlug.get(technique.slug) ?? 0.5
      ),
    };

    const score = round(
      Object.entries(COMPLETENESS_WEIGHTS).reduce(
        (sum, [component, weight]) => sum + breakdown[component] * weight * 100,
        0
      ),
      1
    );

    const tagIssues = collectTagIssues(technique);
    const contentIssues = collectContentIssues(technique, breakdown, slugSet);

    scores.push({
      slug: technique.slug,
      name: technique.name,
      score,
      breakdown,
      issues: [...tagIssues, ...contentIssues],
    });
  }

  // Sort worst-first (ascending score)
  scores.sort((a, b) => a.score - b.score);

  return scores;
}

// ---------------------------------------------------------------------------
// Module E: Resource Freshness
// ---------------------------------------------------------------------------

/** Build a map of citationKey → decimal year from Zotero items. */
function buildCitekeyYearMap(zoteroItems) {
  const citekeyYearMap = new Map();
  const undatedKeys = new Set();

  for (const item of zoteroItems) {
    const key = item.citationKey;
    if (!key) {
      continue;
    }
    const year = parseDateToYear(item.date);
    if (year !== null) {
      citekeyYearMap.set(key, year);
    } else {
      undatedKeys.add(key);
    }
  }

  return { citekeyYearMap, undatedKeys };
}

/** Classify a single resource key as dated, undated, or unmatched. */
function classifyResourceKey(key, citekeyYearMap, undatedKeys, currentYear) {
  const year = citekeyYearMap.get(key);
  if (year !== undefined) {
    return {
      age: currentYear - year,
      year,
      isOld: currentYear - year >= FRESHNESS_OLD_THRESHOLD_YEARS,
    };
  }
  if (undatedKeys.has(key)) {
    return { age: null, year: null, isOld: false, isUndated: true };
  }
  return null;
}

/** Gather age statistics from a technique's resource keys. */
function gatherResourceAges(
  resourceKeys,
  citekeyYearMap,
  undatedKeys,
  currentYear
) {
  const ages = [];
  let undatedCount = 0;
  let newestYear = null;
  let oldestYear = null;
  let oldCount = 0;

  for (const key of resourceKeys) {
    const result = classifyResourceKey(
      key,
      citekeyYearMap,
      undatedKeys,
      currentYear
    );
    if (!result) {
      continue;
    }
    if (result.isUndated) {
      undatedCount++;
      continue;
    }
    ages.push(result.age);
    newestYear =
      newestYear === null || result.year > newestYear
        ? result.year
        : newestYear;
    oldestYear =
      oldestYear === null || result.year < oldestYear
        ? result.year
        : oldestYear;
    if (result.isOld) {
      oldCount++;
    }
  }

  return { ages, undatedCount, newestYear, oldestYear, oldCount };
}

/** Build the empty freshness result for a technique with no resources. */
function emptyFreshnessResult(slug) {
  return {
    slug,
    resource_count: 0,
    dated_count: 0,
    undated_count: 0,
    avg_age: null,
    freshness_score: null,
    newest_year: null,
    oldest_year: null,
    old_resource_count: 0,
  };
}

/** Compute freshness metrics for a single technique. */
function computeTechniqueFreshness(
  technique,
  citekeyYearMap,
  undatedKeys,
  currentYear
) {
  const resourceKeys = technique.resources || [];
  if (resourceKeys.length === 0) {
    return emptyFreshnessResult(technique.slug);
  }

  const { ages, undatedCount, newestYear, oldestYear, oldCount } =
    gatherResourceAges(resourceKeys, citekeyYearMap, undatedKeys, currentYear);

  const avgAge =
    ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
  const score = avgAge !== null ? freshnessDecay(avgAge) : null;

  return {
    slug: technique.slug,
    resource_count: resourceKeys.length,
    dated_count: ages.length,
    undated_count: undatedCount,
    avg_age: avgAge !== null ? round(avgAge, 1) : null,
    freshness_score: score !== null ? round(score) : null,
    newest_year: newestYear !== null ? round(newestYear, 0) : null,
    oldest_year: oldestYear !== null ? round(oldestYear, 0) : null,
    old_resource_count: oldCount,
  };
}

/** Analyse resource freshness across all techniques. */
function analyseResourceFreshness(techniques, zoteroItems) {
  const currentYear = new Date().getFullYear() + new Date().getMonth() / 12;
  const { citekeyYearMap, undatedKeys } = buildCitekeyYearMap(zoteroItems);

  const perTechnique = techniques.map((t) =>
    computeTechniqueFreshness(t, citekeyYearMap, undatedKeys, currentYear)
  );

  // Global aggregates (only from techniques with datable resources)
  const allScores = perTechnique
    .map((t) => t.freshness_score)
    .filter((s) => s !== null);
  const allAges = perTechnique.map((t) => t.avg_age).filter((a) => a !== null);

  const totalOld = perTechnique.reduce((s, t) => s + t.old_resource_count, 0);
  const techniquesWithDatedResources = allScores.length;
  const techniquesWithoutDatedResources =
    techniques.length - techniquesWithDatedResources;

  return {
    half_life_years: FRESHNESS_HALF_LIFE_YEARS,
    old_threshold_years: FRESHNESS_OLD_THRESHOLD_YEARS,
    zotero_items_loaded: zoteroItems.length,
    citekeys_with_dates: citekeyYearMap.size,
    citekeys_without_dates: undatedKeys.size,
    techniques_with_dated_resources: techniquesWithDatedResources,
    techniques_without_dated_resources: techniquesWithoutDatedResources,
    avg_freshness_score:
      allScores.length > 0
        ? round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : null,
    median_resource_age:
      median(allAges) !== null ? round(median(allAges), 1) : null,
    total_old_resources: totalOld,
    per_technique: perTechnique,
  };
}

// ---------------------------------------------------------------------------
// Module F: Review Staleness
// ---------------------------------------------------------------------------

/** Analyse review staleness from enhancement log timestamps. */
function analyseReviewStaleness(techniques, enhancementLog) {
  const timestamps = enhancementLog?.technique_timestamps || {};
  const now = Date.now();

  const perTechnique = [];
  let reviewedCount = 0;
  let neverReviewedCount = 0;
  const daysSinceReviewList = [];
  let stalestReviewed = null;

  for (const technique of techniques) {
    const entry = timestamps[technique.slug];
    if (!entry?.last_reviewed) {
      neverReviewedCount++;
      perTechnique.push({
        slug: technique.slug,
        last_reviewed: null,
        days_since_review: null,
      });
      continue;
    }

    const reviewedAt = new Date(entry.last_reviewed).getTime();
    const daysSince = round((now - reviewedAt) / (1000 * 60 * 60 * 24), 1);
    reviewedCount++;
    daysSinceReviewList.push(daysSince);

    perTechnique.push({
      slug: technique.slug,
      last_reviewed: entry.last_reviewed,
      days_since_review: daysSince,
    });

    if (
      stalestReviewed === null ||
      daysSince > stalestReviewed.days_since_review
    ) {
      stalestReviewed = {
        slug: technique.slug,
        last_reviewed: entry.last_reviewed,
        days_since_review: daysSince,
      };
    }
  }

  const avgDays =
    daysSinceReviewList.length > 0
      ? round(
          daysSinceReviewList.reduce((a, b) => a + b, 0) /
            daysSinceReviewList.length,
          1
        )
      : null;

  return {
    techniques_never_reviewed: neverReviewedCount,
    techniques_reviewed: reviewedCount,
    avg_days_since_review: avgDays,
    stalest_reviewed: stalestReviewed,
    per_technique: perTechnique,
  };
}

// ---------------------------------------------------------------------------
// Module G: Peer Comparison
// ---------------------------------------------------------------------------

/** Build slug → primary goal lookup from techniques. */
function buildSlugToPrimaryGoal(techniques) {
  const map = {};
  for (const technique of techniques) {
    map[technique.slug] = (technique.assurance_goals || [])[0] || null;
  }
  return map;
}

/** Enrich completeness score entries with peer comparison metrics. */
function enrichWithPeerComparison(completenessScores, techniques) {
  const slugToPrimaryGoal = buildSlugToPrimaryGoal(techniques);

  // Build peer group score maps: goal → sorted scores[]
  const peerScoresByGoal = {};
  for (const entry of completenessScores) {
    const goal = slugToPrimaryGoal[entry.slug];
    if (!goal) {
      continue;
    }
    if (!peerScoresByGoal[goal]) {
      peerScoresByGoal[goal] = [];
    }
    peerScoresByGoal[goal].push(entry.score);
  }

  // Pre-sort and compute averages per goal
  const peerAvgByGoal = {};
  for (const [goal, scores] of Object.entries(peerScoresByGoal)) {
    scores.sort((a, b) => a - b);
    peerAvgByGoal[goal] = round(
      scores.reduce((a, b) => a + b, 0) / scores.length,
      1
    );
  }

  // Enrich each entry
  for (const entry of completenessScores) {
    const goal = slugToPrimaryGoal[entry.slug];
    if (!(goal && peerScoresByGoal[goal])) {
      entry.primary_goal = goal;
      entry.peer_avg_score = null;
      entry.peer_percentile = null;
      continue;
    }

    const peerScores = peerScoresByGoal[goal];
    // Percentile: fraction of peers scoring strictly below this entry
    const belowCount = peerScores.filter((s) => s < entry.score).length;
    const percentile = round((belowCount / peerScores.length) * 100, 1);

    entry.primary_goal = goal;
    entry.peer_avg_score = peerAvgByGoal[goal];
    entry.peer_percentile = percentile;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/** Load a JSON file gracefully — returns fallback on error. */
async function loadJsonGracefully(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function main() {
  logger.info(chalk.blue('\n📊 Generating TEA Techniques Quality Report...\n'));

  // Load techniques data
  let techniques;
  try {
    const raw = await fs.readFile(techniquesPath, 'utf-8');
    techniques = JSON.parse(raw);
  } catch (error) {
    logger.error(chalk.red(`Failed to load techniques.json: ${error.message}`));
    process.exit(1);
  }

  logger.info(`  Loaded ${techniques.length} techniques`);

  // Load supplementary data (graceful — missing files don't block report)
  const zoteroData = await loadJsonGracefully(zoteroPath, { items: [] });
  const zoteroItems = (zoteroData.items || []).filter((i) => i.citationKey);
  logger.info(`  Loaded ${zoteroItems.length} Zotero items with citation keys`);

  const enhancementLog = await loadJsonGracefully(enhancementLogPath, {});
  const reviewedCount = Object.keys(
    enhancementLog?.technique_timestamps || {}
  ).length;
  logger.info(
    `  Loaded enhancement log (${reviewedCount} reviewed techniques)`
  );

  // Collect all unique tags
  const allTags = new Set();
  for (const t of techniques) {
    for (const tag of t.tags || []) {
      allTags.add(tag);
    }
  }

  // Run analyses
  logger.info('  Analysing tag coverage...');
  const universalGaps = analyseUniversalGaps(techniques);
  const goalConditionalGaps = analyseGoalConditionalGaps(techniques);
  const statisticalOutliers = analyseStatisticalOutliers(techniques);

  logger.info('  Validating cross-references...');
  const crossReferences = validateCrossReferences(techniques);

  logger.info('  Analysing resource freshness...');
  const resourceFreshness = analyseResourceFreshness(techniques, zoteroItems);

  // Build freshness score map for completeness integration
  const freshnessScoreBySlug = new Map();
  for (const entry of resourceFreshness.per_technique) {
    if (entry.freshness_score !== null) {
      freshnessScoreBySlug.set(entry.slug, entry.freshness_score);
    }
  }

  logger.info('  Computing completeness scores...');
  const completenessScores = computeCompletenessScores(
    techniques,
    freshnessScoreBySlug
  );

  logger.info('  Analysing review staleness...');
  const reviewStaleness = analyseReviewStaleness(techniques, enhancementLog);

  logger.info('  Computing peer comparison...');
  enrichWithPeerComparison(completenessScores, techniques);

  logger.info('  Computing summary...');
  const summary = computeSummary(techniques, completenessScores);

  // Assemble report
  const report = {
    generated_at: new Date().toISOString(),
    dataset_version: {
      technique_count: techniques.length,
      tag_count: allTags.size,
    },
    summary,
    tag_coverage: {
      universal_gaps: universalGaps,
      goal_conditional_gaps: goalConditionalGaps,
      statistical_outliers: statisticalOutliers,
    },
    cross_references: crossReferences,
    completeness_scores: completenessScores,
    resource_freshness: resourceFreshness,
    review_staleness: reviewStaleness,
  };

  // Output
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');

  if (outputIdx !== -1 && args[outputIdx + 1]) {
    const outputPath = path.resolve(args[outputIdx + 1]);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    logger.info(chalk.green(`\n✅ Report written to ${outputPath}`));
  } else {
    // Write JSON to stdout (logging goes to stderr)
    // biome-ignore lint/suspicious/noConsole: stdout output for piping
    console.log(JSON.stringify(report, null, 2));
  }

  // Print summary to stderr
  logger.info(chalk.blue('\n📋 Summary:'));
  logger.info(`  Techniques: ${summary.total_techniques}`);
  logger.info(
    `  Avg completeness score: ${summary.avg_completeness_score}/100`
  );
  logger.info(`  Techniques with issues: ${summary.techniques_with_issues}`);
  logger.info(`  Total issues: ${summary.total_issues}`);
  logger.info(`  Universal gaps: ${universalGaps.length}`);
  logger.info(`  Goal-conditional gaps: ${goalConditionalGaps.length}`);
  logger.info(`  Statistical outliers: ${statisticalOutliers.length}`);
  logger.info(`  Invalid cross-refs: ${crossReferences.invalid_slugs.length}`);
  logger.info(
    `  Asymmetric relationships: ${crossReferences.asymmetric_relationships.length} (informational — asymmetry is expected)`
  );
  logger.info(
    `  Orphan techniques: ${crossReferences.orphan_techniques.length}`
  );
  logger.info(
    `  Avg resource freshness: ${resourceFreshness.avg_freshness_score ?? 'N/A'}`
  );
  logger.info(
    `  Techniques never reviewed: ${reviewStaleness.techniques_never_reviewed}`
  );

  // Lowest scoring techniques
  const bottom5 = completenessScores.slice(0, 5);
  logger.info(chalk.yellow('\n⚠️  Lowest scoring techniques:'));
  for (const t of bottom5) {
    logger.info(`  ${t.score.toFixed(1)} - ${t.name} (${t.slug})`);
  }

  logger.info(chalk.green('\n✅ Quality report generation complete.\n'));
}

main();
