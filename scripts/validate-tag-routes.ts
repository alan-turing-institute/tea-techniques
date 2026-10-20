#!/usr/bin/env node

/**
 * Validates that all tag routes are accessible and working correctly
 * This script tests all possible tag routes to ensure they return 200 OK
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagDefinitions } from '../lib/data/tag-definitions';
import type { Tag } from '../lib/types';

// biome-ignore lint/suspicious/noConsole: This is a utility script
const log = console.log;
// biome-ignore lint/suspicious/noConsole: This is a utility script
const error = console.error;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = 10; // Limit concurrent requests to avoid overwhelming the server

// Map of last parts that have conflicts across categories (from tag-utils.ts)
const CONFLICTING_LAST_PARTS = new Set([
  'documentation',
  'testing',
  'monitoring',
  'probabilistic',
]);

// Categories that have filter routes
const FILTER_CATEGORIES = [
  'applicable-models',
  'lifecycle-stage',
  'expertise-needed',
  'technique-type',
  'evidence-type',
  'data-requirements',
  'data-type',
  'explanatory-scope',
];

interface TestResult {
  tag: string;
  url: string;
  status?: number;
  error?: string;
  ok: boolean;
  definitionExists: boolean;
}

interface TestSummary {
  total: number;
  successful: number;
  failed: number;
  missingDefinitions: number;
  results: TestResult[];
}

/**
 * Get the URL-safe tag identifier (mirroring tag-utils.ts logic)
 */
function getTagUrlPart(tagName: string, category: string): string {
  const parts = tagName.split('/');
  const lastPart = parts.at(-1) || '';

  if (CONFLICTING_LAST_PARTS.has(lastPart)) {
    if (category === 'applicable-models' && lastPart === 'probabilistic') {
      return `${parts[1]}-${lastPart}`;
    }
    if (category === 'assurance-goal-category' && parts.length >= 2) {
      return `${parts[1]}-${lastPart}`;
    }
    const categoryPrefix = category.split('-')[0];
    return `${categoryPrefix}-${lastPart}`;
  }

  return lastPart;
}

/**
 * Load tags from the JSON file
 */
function loadTags(): Tag[] {
  const tagsPath = path.join(__dirname, '../public/data/tags.json');
  return JSON.parse(fs.readFileSync(tagsPath, 'utf8'));
}

/**
 * Generate URL for a tag
 */
function generateTagUrl(tag: Tag): string | null {
  const { name: tagName, category } = tag;
  const parts = tagName.split('/');

  // Determine the URL based on category and tag structure
  if (category === 'assurance-goal-category') {
    if (parts.length === 2) {
      // Goal-level tag (e.g., assurance-goal-category/explainability)
      // Skip these as they're redundant with category pages
      return null;
    }
    if (parts.length >= 3) {
      // Subcategory tag
      const goal = parts[1];
      const subcategory = parts.slice(2).join('/');
      return `${BASE_URL}/categories/${goal}/${subcategory}/`;
    }
  } else if (FILTER_CATEGORIES.includes(category)) {
    // Regular filter tag
    const urlPart = getTagUrlPart(tagName, category);
    return `${BASE_URL}/filters/${category}/${urlPart}/`;
  }

  // Skip categories not in our allowed list
  return null;
}

/**
 * Test a batch of URLs
 */
function testBatch(batch: { tag: Tag; url: string }[]): Promise<TestResult[]> {
  const promises = batch.map(async ({ tag, url }) => {
    const definitionExists = tag.name in tagDefinitions;

    try {
      const response = await fetch(url, { method: 'HEAD' });
      return {
        tag: tag.name,
        url,
        status: response.status,
        ok: response.ok,
        definitionExists,
      };
    } catch (err) {
      return {
        tag: tag.name,
        url,
        error: err instanceof Error ? err.message : String(err),
        ok: false,
        definitionExists,
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Collect all URLs to test
 */
function collectUrlsToTest(tags: Tag[]): { tag: Tag; url: string }[] {
  const urlsToTest: { tag: Tag; url: string }[] = [];

  for (const tag of tags) {
    const url = generateTagUrl(tag);
    if (url) {
      urlsToTest.push({ tag, url });
    }
  }

  return urlsToTest;
}

/**
 * Test all URLs in batches
 */
async function testAllUrls(
  urlsToTest: { tag: Tag; url: string }[]
): Promise<TestResult[]> {
  // Process URLs in controlled batches using reduce to avoid await-in-loop
  const processWithProgress = async (
    previousPromise: Promise<TestResult[]>,
    currentBatch: { tag: Tag; url: string }[],
    index: number
  ): Promise<TestResult[]> => {
    // Wait for previous batch to complete
    const previousResults = await previousPromise;

    // Test current batch
    const batchResults = await testBatch(currentBatch);
    const combinedResults = [...previousResults, ...batchResults];

    // Update progress
    const processed = Math.min(
      (index + 1) * CONCURRENT_REQUESTS,
      urlsToTest.length
    );
    const progress = Math.floor((processed / urlsToTest.length) * 50);
    process.stdout.write(
      `\r${'█'.repeat(progress)}${'░'.repeat(50 - progress)} ${Math.floor((processed / urlsToTest.length) * 100)}%`
    );

    return combinedResults;
  };

  // Create batches
  const batches: { tag: Tag; url: string }[][] = [];
  for (let i = 0; i < urlsToTest.length; i += CONCURRENT_REQUESTS) {
    batches.push(urlsToTest.slice(i, i + CONCURRENT_REQUESTS));
  }

  // Process batches sequentially using reduce
  const results = await batches.reduce(
    (promise, batch, index) => processWithProgress(promise, batch, index),
    Promise.resolve([] as TestResult[])
  );

  process.stdout.write(`\r${'█'.repeat(50)} 100%\n\n`);
  return results;
}

/**
 * Display test results
 */
function displayResults(summary: TestSummary): void {
  log('📊 Test Results:');
  log(`   Total routes tested: ${summary.total}`);
  log(`   ✅ Successful: ${summary.successful}`);
  log(`   ❌ Failed: ${summary.failed}`);
  log(`   📝 Missing definitions: ${summary.missingDefinitions}\n`);

  displayFailedRoutes(summary.results);
  displayMissingDefinitions(summary.results);
  displaySuccessfulExamples(summary.results);

  if (summary.failed === 0) {
    log('🎉 All routes are working correctly!');
  } else {
    log(`⚠️  ${summary.failed} routes need attention.`);
  }
}

/**
 * Display failed routes
 */
function displayFailedRoutes(results: TestResult[]): void {
  const failedRoutes = results.filter((r) => !r.ok);
  if (failedRoutes.length > 0) {
    log('❌ Failed routes:');
    for (const result of failedRoutes) {
      log(`   ${result.tag}: ${result.url}`);
      log(`      Status: ${result.status || result.error}`);
    }
    log('');
  }
}

/**
 * Display tags missing definitions
 */
function displayMissingDefinitions(results: TestResult[]): void {
  const missingDefs = results.filter((r) => !r.definitionExists);
  if (missingDefs.length > 0) {
    log('📝 Tags missing definitions:');
    const uniqueMissing = [...new Set(missingDefs.map((r) => r.tag))].sort();
    for (const tag of uniqueMissing.slice(0, 10)) {
      log(`   - ${tag}`);
    }
    if (uniqueMissing.length > 10) {
      log(`   ... and ${uniqueMissing.length - 10} more`);
    }
    log('');
  }
}

/**
 * Display successful route examples
 */
function displaySuccessfulExamples(results: TestResult[]): void {
  const successful = results.filter((r) => r.ok);
  if (successful.length > 0) {
    log('✅ Example successful routes:');
    const examples = successful.slice(0, 5);
    for (const result of examples) {
      log(`   ${result.tag}: ${result.url}`);
    }
    if (successful.length > 5) {
      log(`   ... and ${successful.length - 5} more`);
    }
    log('');
  }
}

/**
 * Main validation function
 */
async function validateRoutes(): Promise<void> {
  log('🔍 TEA Techniques Route Validator\n');
  log(`Testing against: ${BASE_URL}`);
  log('Loading tags...\n');

  const tags = loadTags();
  const urlsToTest = collectUrlsToTest(tags);

  log(`Found ${urlsToTest.length} routes to test\n`);
  log('Testing routes...');

  const results = await testAllUrls(urlsToTest);

  // Create summary
  const summary: TestSummary = {
    total: results.length,
    successful: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    missingDefinitions: results.filter((r) => !r.definitionExists).length,
    results,
  };

  displayResults(summary);

  // Exit with appropriate code
  process.exit(summary.failed > 0 ? 1 : 0);
}

// Run validation
validateRoutes().catch((err) => {
  error('Fatal error:', err);
  process.exit(1);
});
