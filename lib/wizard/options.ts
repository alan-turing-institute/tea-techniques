import { tagDefinitions } from '@/lib/data/tag-definitions';
import { formatSlugToTitle } from '@/lib/technique-utils';
import type { Technique } from '@/lib/types';
import { matchesOptionTag, matchesTagPath } from './tag-matching';
import type { QuestionOption, WizardQuestion, WizardState } from './types';

// Load dynamic options based on question type and context
export function loadDynamicOptions(
  question: WizardQuestion,
  state: WizardState,
  techniques: Technique[]
): QuestionOption[] {
  if (question.options !== 'dynamic') {
    return question.options || [];
  }

  switch (question.id) {
    case 'assurance-goal':
      return getAssuranceGoalOptions(techniques);
    case 'assurance-subcategory':
      return getAssuranceSubcategoryOptions(state, techniques);
    case 'explainability-method':
      return getExplainabilityMethodOptions(techniques);
    case 'explainability-target':
      return getExplainabilityTargetOptions(techniques);
    case 'explainability-properties':
      return getExplainabilityPropertiesOptions(techniques);
    default:
      return [];
  }
}

// Get assurance goal options with counts
function getAssuranceGoalOptions(techniques: Technique[]): QuestionOption[] {
  const goalCounts = new Map<string, number>();
  const goalDescriptions = new Map<string, string>([
    ['Explainability', 'Understanding how AI makes decisions'],
    ['Fairness', 'Ensuring equitable treatment across groups'],
    [
      'General',
      'Techniques that govern, record or control the work of building and running an AI system, rather than assess one property of the model',
    ],
    ['Privacy', 'Protecting personal information'],
    ['Reliability', 'Consistent and predictable performance'],
    ['Safety', 'Preventing harm and ensuring safe operation'],
    ['Security', 'Protection from attacks and vulnerabilities'],
    ['Transparency', 'Being open about capabilities and limitations'],
  ]);

  // Count techniques for each goal
  for (const technique of techniques) {
    if (technique.assurance_goals) {
      for (const goal of technique.assurance_goals) {
        goalCounts.set(goal, (goalCounts.get(goal) || 0) + 1);
      }
    }
  }

  // Convert to options
  return Array.from(goalCounts.entries())
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .map(([goal, count]) => ({
      value: goal,
      label: goal,
      count,
      description: goalDescriptions.get(goal),
    }));
}

// Get assurance subcategory options based on selected goal
function getAssuranceSubcategoryOptions(
  state: WizardState,
  techniques: Technique[]
): QuestionOption[] {
  const selectedGoal = state.answers['assurance-goal'];
  if (!selectedGoal || Array.isArray(selectedGoal)) {
    return [];
  }

  // Explainability is asked its own questions instead, so it has no aspect options.
  if (selectedGoal === 'Explainability') {
    return [];
  }

  const prefix = `assurance-goal-category/${selectedGoal.toLowerCase()}/`;
  const subcategories = Object.entries(tagDefinitions)
    .filter(([tag]) => tag.startsWith(prefix) && tag !== prefix.slice(0, -1))
    .map(([tag, description]) => ({
      value: tag.slice(prefix.length),
      label: formatSlugToTitle(tag.split('/').at(-1) || ''),
      description,
    }));

  return subcategories
    .map((subcategory) => ({
      ...subcategory,
      count: techniques.filter((technique) =>
        technique.tags?.some((tag) =>
          matchesTagPath(tag, `${prefix}${subcategory.value}`)
        )
      ).length,
    }))
    .filter((option) => option.count > 0);
}

// Calculate counts for static options based on filtered techniques
export function enrichOptionsWithCounts(
  options: QuestionOption[],
  filterTag: string,
  techniques: Technique[]
): QuestionOption[] {
  return options.map((option) => {
    const count = countTechniquesForOption(option.value, filterTag, techniques);
    return {
      ...option,
      count: count > 0 ? count : undefined,
    };
  });
}

// Count techniques that match a specific option value
function countTechniquesForOption(
  value: string,
  filterTag: string,
  techniques: Technique[]
): number {
  if (value === 'not-sure' || value === 'agnostic') {
    return techniques.length; // All techniques are valid for "not sure"
  }

  return techniques.filter((technique) => {
    if (filterTag === 'assurance_goals') {
      return technique.assurance_goals?.includes(value);
    }

    // For tag-based filters
    const relevantTags =
      technique.tags?.filter((tag) => tag.startsWith(`${filterTag}/`)) || [];

    return relevantTags.some((tag) => {
      return matchesOptionTag(tag, filterTag, value);
    });
  }).length;
}

// Get explainability method options
function getExplainabilityMethodOptions(
  techniques: Technique[]
): QuestionOption[] {
  const methodCategories = [
    {
      value: 'attribution-methods',
      label: 'Attribution Methods',
      description: 'Assign importance scores to inputs/features',
      subcategories: ['gradient-based', 'perturbation-based', 'model-specific'],
    },
    {
      value: 'surrogate-models',
      label: 'Surrogate Models',
      description: 'Approximate complex models with simpler ones',
      subcategories: [
        'local-surrogates',
        'global-surrogates',
        'rule-extraction',
      ],
    },
    {
      value: 'visualization-methods',
      label: 'Visualization Methods',
      description: 'Visual representation of model behavior',
      subcategories: [
        'feature-relationships',
        'attention-patterns',
        'activation-maps',
      ],
    },
    {
      value: 'representation-analysis',
      label: 'Representation Analysis',
      description: 'Analyze internal model representations',
      subcategories: [
        'dimensionality-reduction',
        'concept-identification',
        'decomposition',
      ],
    },
    {
      value: 'instance-based',
      label: 'Instance-Based Methods',
      description: 'Use examples to explain',
      subcategories: ['prototypes', 'influence-analysis', 'counterfactual'],
    },
    {
      value: 'causal-analysis',
      label: 'Causal Analysis',
      description: 'Examine causal relationships',
      subcategories: ['mediation-analysis', 'interaction-effects'],
    },
  ];

  for (const value of ['explanation-evaluation', 'human-evaluation']) {
    methodCategories.push({
      value,
      label: formatSlugToTitle(value),
      description:
        tagDefinitions[`assurance-goal-category/explainability/${value}`],
      subcategories: [],
    });
  }

  return methodCategories
    .map((method) => {
      // Count techniques that use this method or its subcategories
      const count = techniques.filter((technique) =>
        technique.tags?.some((tag) => {
          const tagPath = tag.replace(
            'assurance-goal-category/explainability/',
            ''
          );
          return (
            matchesTagPath(tagPath, method.value) ||
            method.subcategories.some((sub) =>
              tagPath.startsWith(`${method.value}/${sub}`)
            )
          );
        })
      ).length;

      return {
        value: method.value,
        label: method.label,
        description: method.description,
        count: count > 0 ? count : undefined,
      };
    })
    .filter((option) => option.count && option.count > 0);
}

// Get explainability target options
function getExplainabilityTargetOptions(
  techniques: Technique[]
): QuestionOption[] {
  const targets = [
    {
      value: 'feature-importance',
      label: 'Feature Importance',
      description: 'Which inputs matter most for predictions',
    },
    {
      value: 'decision-boundaries',
      label: 'Decision Boundaries',
      description: 'How the model separates different outcomes',
    },
    {
      value: 'internal-mechanisms',
      label: 'Internal Mechanisms',
      description: 'How the model processes information internally',
    },
    {
      value: 'data-patterns',
      label: 'Data Patterns',
      description: 'Underlying structures and relationships in data',
    },
    {
      value: 'causal-pathways',
      label: 'Causal Pathways',
      description: 'How effects propagate through the model',
    },
  ];

  return targets
    .map((target) => {
      const count = techniques.filter((technique) =>
        technique.tags?.some((tag) => tag.includes(`/explains/${target.value}`))
      ).length;

      return {
        value: target.value,
        label: target.label,
        description: target.description,
        count: count > 0 ? count : undefined,
      };
    })
    .filter((option) => option.count && option.count > 0);
}

// Get explainability properties options
function getExplainabilityPropertiesOptions(
  techniques: Technique[]
): QuestionOption[] {
  const properties = [
    {
      value: 'completeness',
      label: 'Completeness',
      description: 'Explanations fully account for model output',
    },
    {
      value: 'consistency',
      label: 'Consistency',
      description: 'Similar inputs produce similar explanations',
    },
    {
      value: 'fidelity',
      label: 'Fidelity',
      description: 'Accurately represents true model behavior',
    },
    {
      value: 'sparsity',
      label: 'Sparsity',
      description: 'Focuses on few, most important factors',
    },
    {
      value: 'causality',
      label: 'Causality',
      description: 'Identifies causal rather than correlational relationships',
    },
    {
      value: 'comprehensibility',
      label: 'Comprehensibility',
      description: 'Produces human-understandable formats',
    },
    {
      value: 'efficiency',
      label: 'Efficiency',
      description: 'Computationally efficient to generate',
    },
    {
      value: 'counterfactual-validity',
      label: 'Counterfactual Validity',
      description: 'Shows what changes would alter outcomes',
    },
  ];

  return properties
    .map((property) => {
      const count = techniques.filter((technique) =>
        technique.tags?.some((tag) =>
          tag.includes(`/property/${property.value}`)
        )
      ).length;

      return {
        value: property.value,
        label: property.label,
        description: property.description,
        count: count > 0 ? count : undefined,
      };
    })
    .filter((option) => option.count && option.count > 0);
}

// Format question text with context substitutions
export function formatQuestionText(
  text: string,
  context: { previousAnswer?: string }
): string {
  if (context.previousAnswer && text.includes('{previousAnswer}')) {
    return text.replace('{previousAnswer}', context.previousAnswer);
  }
  return text;
}
