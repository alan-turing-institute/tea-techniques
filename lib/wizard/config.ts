import type { WizardConfig } from './types';

export const wizardConfig: WizardConfig = {
  entryPoints: [
    {
      id: 'by-goal',
      title: 'I know my assurance goal',
      description: 'Start with what you want to achieve',
      icon: '🎯',
      startQuestion: 'assurance-goal',
    },
    {
      id: 'by-model',
      title: 'I know my model type',
      description: 'Start with your AI/ML model',
      icon: '🤖',
      startQuestion: 'model-architecture',
    },
    {
      id: 'by-technique',
      title: 'I know the technique type',
      description: 'Start with the kind of method you need',
      icon: '🔧',
      startQuestion: 'technique-type',
    },
  ],

  questions: {
    'assurance-goal': {
      id: 'assurance-goal',
      text: "What's your primary assurance goal?",
      helpText:
        'Select the main objective you want to achieve with your AI system',
      helpItems: {
        Explainability: 'Understanding how AI makes decisions',
        Fairness: 'Ensuring equitable treatment across groups',
        General:
          'Techniques that govern, record or control the work of building and running an AI system, rather than assess one property of the model',
        Privacy: 'Protecting personal information',
        Reliability: 'Consistent and predictable performance',
        Safety: 'Preventing harm and ensuring safe operation',
        Security: 'Protection from attacks and vulnerabilities',
        Transparency: 'Being open about capabilities and limitations',
      },
      type: 'single',
      filterTag: 'assurance_goals',
      options: 'dynamic',
      allowNotSure: false,
    },

    'assurance-subcategory': {
      id: 'assurance-subcategory',
      text: 'Any specific aspect of {previousAnswer}?',
      helpText: 'Optional: Narrow down to a specific area',
      type: 'multi',
      filterTag: 'assurance-goal-category',
      options: 'dynamic',
      allowNotSure: true,
      notSureLabel: 'Show all aspects',
      conditional: true,
      minOptionsForDisplay: 3,
    },

    'explainability-method': {
      id: 'explainability-method',
      text: 'How should the explanation work?',
      helpText: 'Select the approach for generating explanations',
      helpItems: {
        'Attribution Methods': 'Assign importance scores to inputs/features',
        'Surrogate Models': 'Approximate complex models with simpler ones',
        'Visualization Methods': 'Visual representation of model behavior',
        'Representation Analysis': 'Analyze internal model representations',
        'Instance-Based Methods': 'Use examples to explain',
        'Causal Analysis': 'Examine causal relationships',
        'Explanation Evaluation':
          'Test whether an explanation is faithful to the model, stable and efficient',
        'Human Evaluation':
          'Test explanations with the people who use them, through studies, questionnaires or measures of their decisions',
      },
      type: 'single',
      filterTag: 'explainability-method',
      options: 'dynamic',
      allowNotSure: true,
      notSureLabel: 'Any method is fine',
      conditional: true,
    },

    'explainability-target': {
      id: 'explainability-target',
      text: 'What aspect do you want to understand?',
      helpText: 'The specific aspect of model behavior you want to reveal',
      helpItems: {
        'Feature Importance': 'Which inputs matter most for predictions',
        'Decision Boundaries': 'How the model separates different outcomes',
        'Internal Mechanisms': 'How the model processes information internally',
        'Data Patterns': 'Underlying structures and relationships in data',
        'Causal Pathways': 'How effects propagate through the model',
      },
      type: 'single',
      filterTag: 'explainability-target',
      options: 'dynamic',
      allowNotSure: true,
      notSureLabel: 'Multiple aspects',
      conditional: true,
    },

    'explainability-properties': {
      id: 'explainability-properties',
      text: 'What qualities are important for your explanations?',
      helpText: 'Select all properties that matter for your use case',
      helpItems: {
        Completeness: 'Explanations fully account for model output',
        Consistency: 'Similar inputs produce similar explanations',
        Fidelity: 'Accurately represents true model behavior',
        Sparsity: 'Focuses on few, most important factors',
        Causality: 'Identifies causal rather than correlational relationships',
        Comprehensibility: 'Produces human-understandable formats',
        Efficiency: 'Computationally efficient to generate',
        'Counterfactual Validity': 'Shows what changes would alter outcomes',
      },
      type: 'multi',
      filterTag: 'explainability-properties',
      options: 'dynamic',
      allowNotSure: true,
      notSureLabel: 'No specific requirements',
      conditional: true,
      skipIfUniform: true,
    },

    'model-architecture': {
      id: 'model-architecture',
      text: 'What type of model are you using?',
      helpText: 'Select the AI/ML model architecture',
      helpItems: {
        'Model-Agnostic': 'Works with any model (black-box techniques)',
        'Neural Networks': 'Deep learning models (CNN, RNN, Transformer, LLM)',
        'Tree-Based': 'Decision trees, Random Forests, XGBoost',
        'Linear Models': 'Linear/Logistic regression, GAMs',
        Probabilistic: 'Bayesian networks, Gaussian processes',
        Ensemble: 'Combinations of multiple models',
      },
      type: 'single',
      filterTag: 'applicable-models/architecture',
      options: [
        {
          value: 'architecture/model-agnostic',
          label: 'Any Model / Not Sure',
          description: 'Works with any model type',
        },
        {
          value: 'architecture/neural-networks',
          label: 'Neural Networks',
          description: 'Deep learning models',
        },
        {
          value: 'architecture/neural-networks/transformer/llm',
          label: 'Large Language Models',
          description: 'GPT, Claude, Gemini, etc.',
        },
        {
          value: 'architecture/tree-based',
          label: 'Tree-Based Models',
          description: 'Decision trees, Random Forests, XGBoost',
        },
        {
          value: 'architecture/linear-models',
          label: 'Linear Models',
          description: 'Linear/Logistic regression',
        },
        {
          value: 'architecture/probabilistic',
          label: 'Probabilistic Models',
          description: 'Bayesian networks, GPs',
        },
        {
          value: 'architecture/ensemble',
          label: 'Ensemble Methods',
          description: 'Multiple model combinations',
        },
      ],
      allowNotSure: false,
    },

    'model-access': {
      id: 'model-access',
      text: 'What level of access do you have to the model internals?',
      helpText: 'How much visibility into the model internals',
      helpItems: {
        'Black-box': 'Only input/output access, no internals visible',
        'Gray-box': 'Partial access (predictions, some parameters)',
        'White-box': 'Full transparency (weights, gradients, architecture)',
      },
      type: 'single',
      filterTag: 'applicable-models/requirements',
      options: [
        {
          value: 'requirements/black-box',
          label: 'Black-box',
          description: 'Input/output only',
        },
        {
          value: 'requirements/gray-box',
          label: 'Gray-box',
          description: 'Partial internal access',
        },
        {
          value: 'requirements/white-box',
          label: 'White-box',
          description: 'Full transparency',
        },
      ],
      allowNotSure: true,
      notSureLabel: 'Not sure about access level',
    },

    'lifecycle-stage': {
      id: 'lifecycle-stage',
      text: 'What lifecycle stage are you in?',
      helpText:
        'You can select multiple stages if your project spans several phases',
      helpItems: {
        'Planning and design':
          'Requirements gathering, risk assessment, system design',
        Development: 'Model training, validation, testing, iteration',
        'Deployment and use': 'Production monitoring, maintenance, updates',
      },
      type: 'multi',
      filterTag: 'lifecycle-stage',
      options: [
        {
          value: 'project-design',
          label: 'Planning and design',
          description: 'Pre-development phase',
        },
        {
          value: 'model-development',
          label: 'Development',
          description: 'Building and training',
        },
        {
          value: 'system-deployment',
          label: 'Deployment and use',
          description: 'Production phase',
        },
      ],
      allowNotSure: true,
      notSureLabel: 'Multiple stages / Not sure',
    },

    'technique-type': {
      id: 'technique-type',
      text: 'What type of technique are you looking for?',
      helpText: 'The kind of method or approach you need',
      type: 'single',
      filterTag: 'technique-type',
      options: [
        {
          value: 'algorithmic',
          label: 'Algorithmic/Computational',
          description: 'Code-based methods',
        },
        {
          value: 'metric',
          label: 'Metrics & Measurements',
          description: 'Quantitative evaluation',
        },
        {
          value: 'process',
          label: 'Documentation & Processes',
          description: 'Procedural approaches',
        },
        {
          value: 'testing',
          label: 'Testing & Validation',
          description: 'Quality assurance',
        },
        {
          value: 'visualisation',
          label: 'Visualisation',
          description: 'Visual representations of models and results',
        },
      ],
      allowNotSure: true,
      notSureLabel: 'Any type',
    },

    'expertise-level': {
      id: 'expertise-level',
      text: 'What expertise is available?',
      helpText: 'The technical knowledge available in your team',
      type: 'single',
      filterTag: 'expertise-needed',
      options: [
        { value: 'ml-engineering', label: 'Machine Learning expertise' },
        { value: 'statistics', label: 'Statistical knowledge' },
        { value: 'software-engineering', label: 'Software engineering' },
        { value: 'domain-expertise', label: 'Domain expertise' },
      ],
      allowNotSure: true,
      notSureLabel: 'Mixed expertise',
      conditional: true,
      skipIfUniform: true,
    },

    'data-availability': {
      id: 'data-availability',
      text: 'What data do you have access to?',
      helpText: 'The type and amount of data available',
      type: 'single',
      filterTag: 'data-requirements',
      options: [
        { value: 'training-data', label: 'Training data only' },
        { value: 'test-data', label: 'Separate test data' },
        { value: 'synthetic', label: 'Can generate synthetic data' },
        { value: 'limited', label: 'Limited data available' },
        { value: 'no-special', label: 'No special requirements' },
      ],
      allowNotSure: true,
      notSureLabel: 'Various data types',
      conditional: true,
      skipIfUniform: true,
    },
  },

  flows: {
    'by-goal': {
      id: 'by-goal',
      questions: [
        'assurance-goal',
        'explainability-method', // Conditional: only if Explainability selected
        'explainability-target', // Conditional: only if Explainability selected
        'explainability-properties', // Conditional: only if Explainability selected
        'assurance-subcategory', // For non-explainability goals
        'lifecycle-stage',
        'model-architecture',
        'model-access',
        'expertise-level',
      ],
      adaptiveOrdering: true,
    },
    'by-model': {
      id: 'by-model',
      questions: [
        'model-architecture',
        'model-access',
        'assurance-goal',
        'lifecycle-stage',
        'technique-type',
      ],
      adaptiveOrdering: true,
    },
    'by-technique': {
      id: 'by-technique',
      questions: [
        'technique-type',
        'assurance-goal',
        'model-architecture',
        'model-access',
        'lifecycle-stage',
      ],
      adaptiveOrdering: false,
    },
  },

  resultsConfig: {
    minResults: 3,
    idealResults: 5, // Lowered to ensure more questions are asked
    maxResults: 15,
  },
};

// Helper functions for dynamic options
export function getQuestionOptions(
  questionId: string,
  _context?: { previousAnswer?: string }
) {
  const question = wizardConfig.questions[questionId];
  if (!question) {
    return [];
  }

  if (question.options === 'dynamic') {
    // These will be populated from actual data
    switch (questionId) {
      case 'assurance-goal':
        // Will be populated from getAssuranceGoals()
        return [];
      case 'assurance-subcategory':
        // Will be populated based on selected goal
        return [];
      default:
        return [];
    }
  }

  return question.options || [];
}

// Help text formatting
export function getFormattedHelpText(
  questionId: string,
  context?: { previousAnswer?: string }
) {
  const question = wizardConfig.questions[questionId];
  if (!question) {
    return null;
  }

  let text = question.text;
  if (context?.previousAnswer && text.includes('{previousAnswer}')) {
    text = text.replace('{previousAnswer}', context.previousAnswer);
  }

  return {
    text,
    helpText: question.helpText,
    helpItems: question.helpItems,
  };
}
