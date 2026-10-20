import fs from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CONCEPT_TAGS, KnowledgeGraph } from '../src/graph/index.js';
import type { JsonLdGraph } from '../src/graph/types.js';

const graph = new KnowledgeGraph(
  JSON.parse(
    await fs.readFile(
      new URL('../../public/data/ld/graph.jsonld', import.meta.url),
      'utf8'
    )
  ) as JsonLdGraph
);

describe('current tag vocabulary', () => {
  it('filters each goal by its own membership, including General', () => {
    const all = graph.getAllTechniques();
    for (const goal of graph.getAllGoals()) {
      const slug = goal.id.replace('tea:goal/', '');
      const expected = all.filter((technique) =>
        technique.goals.includes(goal.id)
      );
      expect(
        graph.findTechniques({ goals: [slug], limit: all.length })
      ).toEqual(expected);
    }
    expect(
      all.some(
        (technique) =>
          technique.goals.includes('tea:goal/general') &&
          !technique.goals.includes('tea:goal/safety')
      )
    ).toBe(true);
  });
  it('has no dead concept fragments against the real catalogue', async () => {
    const catalogue: { tags: string[] }[] = JSON.parse(
      await fs.readFile(
        new URL('../../public/data/techniques.json', import.meta.url),
        'utf8'
      )
    );
    const tags = catalogue.flatMap((technique) => technique.tags);
    for (const [concept, fragments] of Object.entries(CONCEPT_TAGS)) {
      for (const fragment of fragments) {
        expect(
          tags.some((tag) => tag.includes(fragment)),
          `${concept}: ${fragment}`
        ).toBe(true);
      }
    }
  });
});
