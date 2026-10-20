/**
 * Utilities for working with tag URLs and paths
 */

import type { Tag } from './types';

// Map of last parts that have conflicts across categories
const CONFLICTING_LAST_PARTS = new Set([
  'documentation',
  'testing',
  'monitoring',
  'probabilistic',
]);

/**
 * Get the URL-safe tag identifier for a given tag
 * Uses just the last part for non-conflicting tags,
 * or includes parent context for conflicting ones
 */
export function getTagUrlPart(tagName: string, category: string): string {
  const parts = tagName.split('/');
  const lastPart = parts.at(-1) || '';

  // If this last part has conflicts, we need more context
  if (CONFLICTING_LAST_PARTS.has(lastPart)) {
    if (category === 'applicable-models' && lastPart === 'probabilistic') {
      return `${parts[1]}-${lastPart}`;
    }
    // For assurance-goal-category, just use the second part (the goal)
    if (category === 'assurance-goal-category' && parts.length >= 2) {
      return `${parts[1]}-${lastPart}`;
    }

    // For other categories with conflicts, prefix with category type
    const categoryPrefix = category.split('-')[0]; // e.g., "evidence" from "evidence-type"
    return `${categoryPrefix}-${lastPart}`;
  }

  // For non-conflicting tags, just use the last part
  return lastPart;
}

/**
 * Find a tag by its URL part and category
 */
export function findTagByUrlPart(
  tags: Tag[],
  category: string,
  urlPart: string
): Tag | undefined {
  return tags.find((tag) => {
    if (tag.category !== category) {
      return false;
    }
    const expectedUrlPart = getTagUrlPart(tag.name, category);
    return expectedUrlPart === urlPart;
  });
}
