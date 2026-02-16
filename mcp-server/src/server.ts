/**
 * MCP Server setup: registers all 10 tools and 2 resources.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KnowledgeGraph, TechniqueNode } from './graph/index.js';

function formatTechniqueSummary(t: {
  slug: string;
  name: string;
  description: string;
  acronym?: string;
  complexityRating?: number;
  computationalCostRating?: number;
}): string {
  const parts = [`**${t.name}**${t.acronym ? ` (${t.acronym})` : ''}`];
  parts.push(`Slug: ${t.slug}`);
  parts.push(t.description);
  if (t.complexityRating != null) {
    parts.push(`Complexity: ${t.complexityRating}/5`);
  }
  if (t.computationalCostRating != null) {
    parts.push(`Computational cost: ${t.computationalCostRating}/5`);
  }
  return parts.join('\n');
}

function formatTechniqueDetail(
  technique: TechniqueNode,
  graph: KnowledgeGraph
): string {
  const goalNames = technique.goals.map((gId) => {
    const goal = graph.getGoal(gId.replace('tea:goal/', ''));
    return goal?.name ?? gId;
  });
  const sections = [
    formatTechniqueSummary(technique),
    `\nAssurance Goals: ${goalNames.join(', ')}`,
    `Tags: ${technique.tags.map((t) => t.replace('tea:tag/', '')).join(', ')}`,
  ];
  if (technique.exampleUseCases.length > 0) {
    sections.push('\n**Example Use Cases:**');
    for (const uc of technique.exampleUseCases) {
      sections.push(`- [${uc.goal}] ${uc.description}`);
    }
  }
  if (technique.limitations.length > 0) {
    sections.push('\n**Limitations:**');
    for (const lim of technique.limitations) {
      sections.push(`- ${lim.description}`);
    }
  }
  if (technique.relatedTo.length > 0) {
    sections.push(
      `\nRelated: ${technique.relatedTo.map((r) => r.replace('tea:technique/', '')).join(', ')}`
    );
  }
  if (technique.resources.length > 0) {
    sections.push(`Resources: ${technique.resources.length} cited`);
  }
  return sections.join('\n');
}

export function createServer(graph: KnowledgeGraph): McpServer {
  const server = new McpServer({
    name: 'tea-techniques',
    version: '1.0.0',
  });

  // --- Tool 1: find_techniques ---
  server.registerTool(
    'find_techniques',
    {
      title: 'Find Techniques',
      description:
        'Search and filter AI assurance techniques by query text, assurance goals, tags, model type, lifecycle stage, evidence type, max complexity, and limit.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe('Free-text search across technique names and descriptions'),
        goals: z
          .array(z.string())
          .optional()
          .describe(
            'Filter by assurance goal slugs (e.g. explainability, fairness)'
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            'Filter by tag path fragments (e.g. model-agnostic, tabular)'
          ),
        excludeTags: z
          .array(z.string())
          .optional()
          .describe(
            'Exclude techniques matching any of these tag fragments (e.g. neural-networks)'
          ),
        maxComplexity: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('Maximum complexity rating (1-5)'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum number of results (default 20)'),
      },
    },
    ({ query, goals, tags, excludeTags, maxComplexity, limit }) => {
      const results = graph.findTechniques({
        query,
        goals,
        tags,
        excludeTags,
        maxComplexity,
        limit,
      });
      const text =
        results.length > 0
          ? results.map(formatTechniqueSummary).join('\n\n---\n\n')
          : 'No techniques found matching the given criteria.';
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // --- Tool 2: get_technique ---
  server.registerTool(
    'get_technique',
    {
      title: 'Get Technique',
      description: 'Get full details of a specific technique by its slug.',
      inputSchema: {
        slug: z
          .string()
          .describe('The technique slug (e.g. shapley-additive-explanations)'),
      },
    },
    ({ slug }) => {
      const technique = graph.getTechnique(slug);
      if (!technique) {
        return {
          content: [
            { type: 'text' as const, text: `Technique "${slug}" not found.` },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: formatTechniqueDetail(technique, graph),
          },
        ],
      };
    }
  );

  // --- Tool 3: compare_techniques ---
  server.registerTool(
    'compare_techniques',
    {
      title: 'Compare Techniques',
      description:
        'Side-by-side comparison of 2-5 techniques across goals, tags, complexity, and resources.',
      inputSchema: {
        slugs: z
          .array(z.string())
          .min(2)
          .max(5)
          .describe('Array of technique slugs to compare'),
      },
    },
    ({ slugs }) => {
      const comparisons = graph.compareTechniques(slugs);
      if (comparisons.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No valid techniques found for comparison.',
            },
          ],
        };
      }
      const rows = comparisons.map((c) => {
        const t = c.technique;
        return [
          `**${t.name}** (${t.slug})`,
          `  Goals: ${c.goalNames.join(', ')}`,
          `  Tag categories: ${c.tagCategories.join(', ')}`,
          `  Complexity: ${t.complexityRating ?? 'unrated'}/5`,
          `  Computational cost: ${t.computationalCostRating ?? 'unrated'}/5`,
          `  Resources: ${c.resourceCount}`,
        ].join('\n');
      });
      return {
        content: [{ type: 'text' as const, text: rows.join('\n\n---\n\n') }],
      };
    }
  );

  // --- Tool 4: find_related ---
  server.registerTool(
    'find_related',
    {
      title: 'Find Related Techniques',
      description:
        'Find techniques related to a given technique via explicit links, shared goals, or shared tags.',
      inputSchema: {
        slug: z.string().describe('The technique slug to find relatives for'),
        depth: z
          .number()
          .int()
          .min(1)
          .max(3)
          .optional()
          .describe(
            'Relationship depth: 1=explicit+same-goal, 2=also same-tag (default 1)'
          ),
      },
    },
    ({ slug, depth }) => {
      const related = graph.findRelated(slug, depth ?? 1);
      if (related.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No related techniques found for "${slug}".`,
            },
          ],
        };
      }
      const grouped: Record<string, string[]> = {};
      for (const r of related) {
        const list = grouped[r.relationship] ?? [];
        list.push(`${r.technique.name} (${r.technique.slug})`);
        grouped[r.relationship] = list;
      }
      const sections = Object.entries(grouped).map(
        ([rel, names]) => `**${rel}:** ${names.join(', ')}`
      );
      return {
        content: [{ type: 'text' as const, text: sections.join('\n\n') }],
      };
    }
  );

  // --- Tool 5: suggest_techniques_for_claim ---
  server.registerTool(
    'suggest_techniques_for_claim',
    {
      title: 'Suggest Techniques for Claim',
      description:
        'Given an assurance claim (e.g. "the model treats all groups fairly"), suggest relevant techniques. Optionally provide system context to narrow results.',
      inputSchema: {
        claim: z
          .string()
          .describe('The assurance claim text to match techniques against'),
        modelType: z
          .string()
          .optional()
          .describe(
            'Model type context. ML types: neural-network, tree-based, linear-models, probabilistic, ensemble. Non-ML types: physics-based, simulation, mechanistic, statistical, other (excludes architecture-specific techniques).'
          ),
        dataType: z
          .string()
          .optional()
          .describe('Data type context (e.g. tabular, image, text)'),
        lifecycleStage: z
          .string()
          .optional()
          .describe(
            'Lifecycle stage context (e.g. model-development, deployment)'
          ),
        excludeModelTypes: z
          .array(z.string())
          .optional()
          .describe(
            'Exclude techniques for these model architectures (e.g. neural-networks)'
          ),
      },
    },
    ({ claim, modelType, dataType, lifecycleStage, excludeModelTypes }) => {
      const results = graph.suggestForClaim(claim, {
        modelType,
        dataType,
        lifecycleStage,
        excludeModelTypes,
      });
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No techniques found matching this claim. Try broadening the claim text or removing context filters.',
            },
          ],
        };
      }
      const text = results.map(formatTechniqueSummary).join('\n\n---\n\n');
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // --- Tool 6: find_evidence_types ---
  server.registerTool(
    'find_evidence_types',
    {
      title: 'Find Evidence Types',
      description:
        'Explore what types of evidence AI assurance techniques can produce, and which techniques produce each type.',
      inputSchema: {},
    },
    () => {
      const evidenceTypes = graph.findEvidenceTypes();
      if (evidenceTypes.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No evidence types found in the dataset.',
            },
          ],
        };
      }
      const sections = evidenceTypes.map((et) => {
        const techNames = et.techniques
          .slice(0, 5)
          .map((t) => t.name)
          .join(', ');
        const more =
          et.techniques.length > 5
            ? ` (+${et.techniques.length - 5} more)`
            : '';
        return `**${et.evidenceType}** (${et.techniques.length} techniques)\n  Examples: ${techNames}${more}`;
      });
      return {
        content: [{ type: 'text' as const, text: sections.join('\n\n') }],
      };
    }
  );

  // --- Tool 7: explore_taxonomy ---
  server.registerTool(
    'explore_taxonomy',
    {
      title: 'Explore Taxonomy',
      description:
        'Navigate the hierarchical tag taxonomy. Call with no path to see top-level categories, or with a tag path to see children.',
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe(
            'Tag path to explore (e.g. "applicable-models"). Omit for top-level categories.'
          ),
        includeTechniques: z
          .boolean()
          .optional()
          .describe('Whether to include technique names for each child tag'),
      },
    },
    ({ path: tagPath, includeTechniques }) => {
      const result = graph.exploreTaxonomy(
        tagPath,
        1,
        includeTechniques ?? false
      );
      const sections: string[] = [];
      if (result.tag) {
        sections.push(`**${result.tag.prefLabel}** (${result.tag.path})`);
      }
      if (result.children.length === 0) {
        sections.push('No children found for this path.');
      } else {
        for (const child of result.children) {
          let line = `- ${child.tag.prefLabel} (${child.techniqueCount} techniques)`;
          if (child.techniques?.length) {
            const names = child.techniques.map((t) => t.name).join(', ');
            line += `\n    ${names}`;
          }
          sections.push(line);
        }
      }
      return {
        content: [{ type: 'text' as const, text: sections.join('\n') }],
      };
    }
  );

  // --- Tool 8: coverage_statistics ---
  server.registerTool(
    'coverage_statistics',
    {
      title: 'Coverage Statistics',
      description:
        'Analyse dataset coverage across a chosen dimension: goals, tags, lifecycle, evidence, model-types, complexity, or cross-goal.',
      inputSchema: {
        dimension: z
          .enum([
            'goals',
            'tags',
            'lifecycle',
            'evidence',
            'model-types',
            'complexity',
            'cross-goal',
          ])
          .describe('The dimension to analyse coverage for'),
      },
    },
    ({ dimension }) => {
      const stats = graph.coverageStatistics(dimension);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(stats, null, 2) },
        ],
      };
    }
  );

  // --- Tool 9: search_resources ---
  server.registerTool(
    'search_resources',
    {
      title: 'Search Resources',
      description:
        'Search academic resources (papers, software, documentation) by query text, type, or associated technique.',
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            'Free-text search across resource titles, abstracts, and authors'
          ),
        type: z
          .enum([
            'technical_paper',
            'software_package',
            'documentation',
            'tutorial',
          ])
          .optional()
          .describe('Filter by resource type'),
        technique: z
          .string()
          .optional()
          .describe('Filter by technique slug to get its cited resources'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Maximum number of results (default 20)'),
      },
    },
    ({ query, type, technique, limit }) => {
      const results = graph.searchResources({ query, type, technique, limit });
      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No resources found matching the given criteria.',
            },
          ],
        };
      }
      const sections = results.map((r) => {
        const res = r.resource;
        const parts = [`**${res.name}**`];
        if (res.authors?.length) {
          parts.push(`Authors: ${res.authors.join(', ')}`);
        }
        if (res.sourceType) {
          parts.push(`Type: ${res.sourceType}`);
        }
        if (res.publicationDate) {
          parts.push(`Date: ${res.publicationDate}`);
        }
        if (res.url) {
          parts.push(`URL: ${res.url}`);
        }
        if (r.techniques.length > 0) {
          parts.push(`Used by: ${r.techniques.join(', ')}`);
        }
        return parts.join('\n');
      });
      return {
        content: [
          { type: 'text' as const, text: sections.join('\n\n---\n\n') },
        ],
      };
    }
  );

  // --- Tool 10: get_knowledge_graph_summary ---
  server.registerTool(
    'get_knowledge_graph_summary',
    {
      title: 'Knowledge Graph Summary',
      description:
        'Get high-level statistics about the TEA Techniques knowledge graph: entity counts, relationship counts.',
      inputSchema: {},
    },
    () => {
      const summary = graph.getSummary();
      const text = [
        '**TEA Techniques Knowledge Graph**',
        '',
        `Techniques: ${summary.techniques}`,
        `Assurance Goals: ${summary.goals}`,
        `Tags: ${summary.tags}`,
        `Resources: ${summary.resources}`,
        '',
        '**Relationships:**',
        `  Technique → Goal: ${summary.relationships.techniqueGoal}`,
        `  Technique → Tag: ${summary.relationships.techniqueTag}`,
        `  Technique → Related: ${summary.relationships.techniqueRelated}`,
        `  Technique → Resource: ${summary.relationships.techniqueResource}`,
      ].join('\n');
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  return server;
}
