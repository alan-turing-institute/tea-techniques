import type { Technique } from '@/lib/types';
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

  // Map of goal subcategories
  const subcategoryMap: Record<string, QuestionOption[]> = {
    Explainability: [
      {
        value: 'feature-importance',
        label: 'Feature Importance',
        description: 'Which features matter most',
      },
      {
        value: 'decision-rules',
        label: 'Decision Rules',
        description: 'How decisions are made',
      },
      {
        value: 'counterfactuals',
        label: 'Counterfactual Explanations',
        description: 'What would change the outcome',
      },
      {
        value: 'model-internals',
        label: 'Model Internals',
        description: 'Understanding model structure',
      },
    ],
    Fairness: [
      {
        value: 'demographic-parity',
        label: 'Demographic Parity',
        description: 'Equal outcomes across groups',
      },
      {
        value: 'individual-fairness',
        label: 'Individual Fairness',
        description: 'Similar treatment for similar individuals',
      },
      {
        value: 'bias-detection',
        label: 'Bias Detection',
        description: 'Finding unfair patterns',
      },
      {
        value: 'bias-mitigation',
        label: 'Bias Mitigation',
        description: 'Reducing unfair behavior',
      },
    ],
    Privacy: [
      {
        value: 'differential-privacy',
        label: 'Differential Privacy',
        description: 'Mathematical privacy guarantees',
      },
      {
        value: 'data-minimization',
        label: 'Data Minimization',
        description: 'Using less personal data',
      },
      {
        value: 'federated-learning',
        label: 'Federated Learning',
        description: 'Training without data sharing',
      },
    ],
    Safety: [
      {
        value: 'adversarial-robustness',
        label: 'Adversarial Robustness',
        description: 'Resisting attacks',
      },
      {
        value: 'uncertainty-quantification',
        label: 'Uncertainty Quantification',
        description: 'Knowing when uncertain',
      },
      {
        value: 'safe-exploration',
        label: 'Safe Exploration',
        description: 'Learning without harm',
      },
    ],
    Reliability: [
      {
        value: 'performance-monitoring',
        label: 'Performance Monitoring',
        description: 'Tracking system behavior',
      },
      {
        value: 'drift-detection',
        label: 'Drift Detection',
        description: 'Identifying changes over time',
      },
      {
        value: 'failure-prediction',
        label: 'Failure Prediction',
        description: 'Anticipating problems',
      },
    ],
    Transparency: [
      {
        value: 'model-cards',
        label: 'Model Documentation',
        description: 'Comprehensive model information',
      },
      {
        value: 'impact-assessment',
        label: 'Impact Assessment',
        description: 'Understanding consequences',
      },
      {
        value: 'stakeholder-communication',
        label: 'Stakeholder Communication',
        description: 'Clear explanations for all',
      },
    ],
  };

  const subcategories = subcategoryMap[selectedGoal] || [];

  // Add counts based on filtered techniques
  return subcategories.map((subcategory) => {
    // This would need more sophisticated tag mapping in real implementation
    const count = techniques.filter((t) =>
      t.tags?.some((tag) => tag.includes(subcategory.value))
    ).length;

    return {
      ...subcategory,
      count: count || undefined,
    };
  });
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
      const tagValue = tag.split('/').pop();
      return tagValue === value || tag.endsWith(`/${value}`);
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
      value: 'uncertainty-analysis',
      label: 'Uncertainty Analysis',
      description: 'Quantify confidence and robustness',
      subcategories: ['prediction-uncertainty', 'sensitivity-testing'],
    },
    {
      value: 'causal-analysis',
      label: 'Causal Analysis',
      description: 'Examine causal relationships',
      subcategories: ['mediation-analysis', 'interaction-effects'],
    },
    {
      value: 'model-simplification',
      label: 'Model Simplification',
      description: 'Create simpler, interpretable models',
      subcategories: ['pruning', 'knowledge-transfer'],
    },
  ];

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
            tagPath.startsWith(`${method.value}/`) ||
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
      value: 'prediction-confidence',
      label: 'Prediction Confidence',
      description: 'How certain/uncertain the model is',
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
