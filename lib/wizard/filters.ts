import type { Technique } from '@/lib/types';
import { matchesOptionTag, matchesTagPath } from './tag-matching';
import type { WizardState } from './types';

// Calculate match score for a technique based on wizard answers
export function calculateMatchScore(
  technique: Technique,
  state: WizardState
): number {
  let score = 0;
  let maxScore = 0;

  // Check each answer in the path
  for (const pathItem of state.path) {
    maxScore += 100;
    const points = scorePathItem(technique, pathItem);
    score += points;
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// Score individual path item
function scorePathItem(
  technique: Technique,
  pathItem: { question: string; answer: string | string[] }
): number {
  if (pathItem.question === 'assurance-goal') {
    return scoreAssuranceGoal(technique, pathItem.answer);
  }
  if (pathItem.question === 'model-architecture') {
    return scoreModelArchitecture(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'model-access') {
    return scoreModelAccess(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'lifecycle-stage') {
    return scoreLifecycleStage(technique, pathItem.answer);
  }
  if (pathItem.question === 'technique-type') {
    return scoreTechniqueType(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-method') {
    return scoreExplainabilityMethod(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-target') {
    return scoreExplainabilityTarget(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-properties') {
    return scoreExplainabilityProperties(technique, pathItem.answer);
  }
  return 0;
}

function scoreAssuranceGoal(
  technique: Technique,
  answer: string | string[]
): number {
  const answers = Array.isArray(answer) ? answer : [answer];
  return answers.some((goal) => technique.assurance_goals?.includes(goal))
    ? 100
    : 0;
}

function scoreModelArchitecture(technique: Technique, answer: string): number {
  if (answer === 'architecture/model-agnostic') {
    // Model-agnostic matches all techniques
    return 100;
  }
  return hasModelArchitectureMatch(technique, answer) ? 100 : 0;
}

function scoreModelAccess(technique: Technique, answer: string): number {
  if (answer === 'not-sure') {
    // If unsure, give partial score
    return 50;
  }
  return hasModelAccessMatch(technique, answer) ? 100 : 0;
}

function scoreLifecycleStage(
  technique: Technique,
  answer: string | string[]
): number {
  const answers = Array.isArray(answer) ? answer : [answer];
  return answers.includes('not-sure') || hasLifecycleMatch(technique, answers)
    ? 100
    : 0;
}

function scoreTechniqueType(technique: Technique, answer: string): number {
  return answer === 'not-sure' || hasTechniqueTypeMatch(technique, answer)
    ? 100
    : 0;
}

function scoreExplainabilityMethod(
  technique: Technique,
  answer: string
): number {
  if (answer === 'not-sure') {
    return 100;
  }

  const methodTags =
    technique.tags?.filter(
      (tag) =>
        tag.startsWith('assurance-goal-category/explainability/') &&
        (tag.includes('/attribution-methods/') ||
          tag.includes('/surrogate-models/') ||
          tag.includes('/visualization-methods/') ||
          tag.includes('/representation-analysis/') ||
          tag.includes('/instance-based/') ||
          matchesTagPath(
            tag,
            'assurance-goal-category/explainability/explanation-evaluation'
          ) ||
          tag.includes('/causal-analysis/') ||
          matchesTagPath(
            tag,
            'assurance-goal-category/explainability/human-evaluation'
          ))
    ) || [];

  const normalizedAnswer = answer.replace(/-/g, '-');
  return methodTags.some((tag) =>
    matchesTagPath(
      tag,
      `assurance-goal-category/explainability/${normalizedAnswer}`
    )
  )
    ? 100
    : 0;
}

function scoreExplainabilityTarget(
  technique: Technique,
  answer: string
): number {
  if (answer === 'not-sure') {
    return 100;
  }

  const targetTags =
    technique.tags?.filter((tag) => tag.includes('/explains/')) || [];

  return targetTags.some((tag) => tag.includes(`/explains/${answer}`))
    ? 100
    : 0;
}

function scoreExplainabilityProperties(
  technique: Technique,
  answer: string | string[]
): number {
  const answers = Array.isArray(answer) ? answer : [answer];
  if (answers.includes('not-sure')) {
    return 100;
  }

  const propertyTags =
    technique.tags?.filter((tag) => tag.includes('/property/')) || [];

  // For multiple properties, technique should have at least one
  const matchCount = answers.filter((prop) =>
    propertyTags.some((tag) => tag.includes(`/property/${prop}`))
  ).length;

  // Score based on how many requested properties match
  return matchCount > 0 ? (matchCount / answers.length) * 100 : 0;
}

// Check if technique matches model architecture
function hasModelArchitectureMatch(
  technique: Technique,
  architecture: string
): boolean {
  const modelTags =
    technique.tags?.filter((tag) => tag.startsWith('applicable-models/')) || [];

  // Check for model-agnostic techniques
  if (
    modelTags.some(
      (tag) => tag === 'applicable-models/architecture/model-agnostic'
    )
  ) {
    return true;
  }

  // Direct match on the architecture path
  if (modelTags.some((tag) => tag.includes(architecture))) {
    return true;
  }

  // Handle parent/child relationships
  // e.g., if user selects "neural-networks", match all neural network subtypes
  if (architecture === 'architecture/neural-networks') {
    return modelTags.some((tag) =>
      tag.includes('/architecture/neural-networks')
    );
  }
  if (architecture === 'architecture/tree-based') {
    return modelTags.some((tag) => tag.includes('/architecture/tree-based'));
  }
  if (architecture === 'architecture/linear-models') {
    return modelTags.some((tag) => tag.includes('/architecture/linear-models'));
  }
  if (architecture === 'architecture/probabilistic') {
    return modelTags.some((tag) => tag.includes('/architecture/probabilistic'));
  }

  return false;
}

// Check if technique matches model access requirements
function hasModelAccessMatch(technique: Technique, access: string): boolean {
  const requirementTags =
    technique.tags?.filter((tag) =>
      tag.startsWith('applicable-models/requirements/')
    ) || [];

  // Map user's access level to compatible requirement tags
  if (access === 'requirements/black-box') {
    // Black-box access can use black-box techniques
    return requirementTags.some((tag) => tag.includes('/black-box'));
  }

  if (access === 'requirements/gray-box') {
    // Gray-box can use black-box or gray-box techniques
    return requirementTags.some(
      (tag) => tag.includes('/black-box') || tag.includes('/gray-box')
    );
  }

  if (access === 'requirements/white-box') {
    // White-box can use any technique
    return true;
  }

  return false;
}

// Check if technique matches lifecycle stage
function hasLifecycleMatch(technique: Technique, stages: string[]): boolean {
  const lifecycleTags =
    technique.tags?.filter((tag) => tag.startsWith('lifecycle-stage/')) || [];

  return stages.some((stage) =>
    lifecycleTags.some((tag) => matchesOptionTag(tag, 'lifecycle-stage', stage))
  );
}

// Check if technique matches technique type
function hasTechniqueTypeMatch(technique: Technique, type: string): boolean {
  const typeTags =
    technique.tags?.filter((tag) => tag.startsWith('technique-type/')) || [];

  return typeTags.some((tag) => matchesOptionTag(tag, 'technique-type', type));
}

// Sort techniques by relevance
export function sortTechniquesByRelevance(
  techniques: Technique[],
  state: WizardState
): Technique[] {
  const techniquesWithScores = techniques.map((technique) => ({
    technique,
    score: calculateMatchScore(technique, state),
  }));

  // Sort by score (highest first)
  techniquesWithScores.sort((a, b) => b.score - a.score);

  return techniquesWithScores.map((item) => item.technique);
}

// Helper function to get label for model architecture
function getModelArchitectureLabel(answer: string): string {
  switch (answer) {
    case 'architecture/model-agnostic':
      return 'Model-agnostic';
    case 'architecture/neural-networks':
      return 'Neural Networks';
    case 'architecture/neural-networks/transformer/llm':
      return 'Large Language Models';
    case 'architecture/tree-based':
      return 'Tree-based Models';
    case 'architecture/linear-models':
      return 'Linear Models';
    case 'architecture/probabilistic':
      return 'Probabilistic Models';
    case 'architecture/ensemble':
      return 'Ensemble Methods';
    default:
      return answer.split('/').pop() || answer;
  }
}

// Helper function to get label for model access
function getModelAccessLabel(answer: string): string {
  switch (answer) {
    case 'requirements/black-box':
      return 'Black-box access';
    case 'requirements/gray-box':
      return 'Gray-box access';
    case 'requirements/white-box':
      return 'White-box access';
    default:
      return answer.split('/').pop() || answer;
  }
}

// Helper function to get label for lifecycle stage
function getLifecycleStageLabel(stage: string): string {
  switch (stage) {
    case 'project-design':
      return 'Planning and design';
    case 'model-development':
      return 'Development';
    case 'system-deployment':
      return 'Deployment and use';
    default:
      return stage;
  }
}

// Helper function to get label for technique type
function getTechniqueTypeLabel(type: string): string {
  switch (type) {
    case 'algorithmic':
      return 'Algorithmic method';
    case 'metric':
      return 'Metric/Measurement';
    case 'process':
      return 'Process/Documentation';
    case 'testing':
      return 'Testing/Validation';
    case 'visualisation':
      return 'Visualisation';
    default:
      return type;
  }
}

// Get reason why technique matches
export function getMatchReasons(
  technique: Technique,
  state: WizardState
): string[] {
  const reasons: string[] = [];

  for (const pathItem of state.path) {
    const reason = getReasonForPathItem(technique, pathItem);
    if (reason) {
      reasons.push(reason);
    }
  }

  // Add versatility indicator
  const modelAgnostic = technique.tags?.some((tag) =>
    tag.includes('applicable-models/architecture/model-agnostic')
  );
  if (modelAgnostic && !reasons.some((r) => r.includes('model'))) {
    reasons.push('Works across contexts');
  }

  return reasons;
}

// Get reason for individual path item
function getReasonForPathItem(
  technique: Technique,
  pathItem: { question: string; answer: string | string[] }
): string | null {
  if (pathItem.question === 'assurance-goal') {
    return getAssuranceGoalReason(technique, pathItem.answer);
  }
  if (pathItem.question === 'model-architecture') {
    return getModelArchitectureReason(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'model-access') {
    return getModelAccessReason(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'lifecycle-stage') {
    return getLifecycleStageReason(technique, pathItem.answer);
  }
  if (pathItem.question === 'technique-type') {
    return getTechniqueTypeReason(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-method') {
    return getExplainabilityMethodReason(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-target') {
    return getExplainabilityTargetReason(technique, pathItem.answer as string);
  }
  if (pathItem.question === 'explainability-properties') {
    return getExplainabilityPropertiesReason(technique, pathItem.answer);
  }
  return null;
}

function getAssuranceGoalReason(
  technique: Technique,
  answer: string | string[]
): string | null {
  const answers = Array.isArray(answer) ? answer : [answer];
  const matchedGoals = answers.filter((goal) =>
    technique.assurance_goals?.includes(goal)
  );
  return matchedGoals.length > 0 ? matchedGoals.join(', ') : null;
}

function getModelArchitectureReason(
  technique: Technique,
  answer: string
): string | null {
  if (answer === 'architecture/model-agnostic') {
    return 'Works with any model';
  }
  if (hasModelArchitectureMatch(technique, answer)) {
    return getModelArchitectureLabel(answer);
  }
  return null;
}

function getModelAccessReason(
  technique: Technique,
  answer: string
): string | null {
  if (answer === 'not-sure') {
    return null;
  }
  if (hasModelAccessMatch(technique, answer)) {
    return getModelAccessLabel(answer);
  }
  return null;
}

function getLifecycleStageReason(
  technique: Technique,
  answer: string | string[]
): string | null {
  const answers = Array.isArray(answer) ? answer : [answer];
  if (!answers.includes('not-sure') && hasLifecycleMatch(technique, answers)) {
    const stageLabels = answers.map(getLifecycleStageLabel);
    return `${stageLabels.join(', ')} stage`;
  }
  return null;
}

function getTechniqueTypeReason(
  technique: Technique,
  answer: string
): string | null {
  if (answer !== 'not-sure' && hasTechniqueTypeMatch(technique, answer)) {
    return getTechniqueTypeLabel(answer);
  }
  return null;
}

function getExplainabilityMethodReason(
  technique: Technique,
  answer: string
): string | null {
  if (answer === 'not-sure') {
    return null;
  }

  const methodLabels: Record<string, string> = {
    'attribution-methods': 'Attribution method',
    'surrogate-models': 'Surrogate model',
    'visualization-methods': 'Visualization method',
    'representation-analysis': 'Representation analysis',
    'instance-based': 'Instance-based method',
    'explanation-evaluation': 'Explanation Evaluation',
    'causal-analysis': 'Causal analysis',
    'human-evaluation': 'Human Evaluation',
  };

  const methodTags =
    technique.tags?.filter(
      (tag) =>
        tag.startsWith('assurance-goal-category/explainability/') &&
        matchesTagPath(tag, `assurance-goal-category/explainability/${answer}`)
    ) || [];

  return methodTags.length > 0 ? methodLabels[answer] || answer : null;
}

function getExplainabilityTargetReason(
  technique: Technique,
  answer: string
): string | null {
  if (answer === 'not-sure') {
    return null;
  }

  const targetLabels: Record<string, string> = {
    'feature-importance': 'Explains feature importance',
    'decision-boundaries': 'Shows decision boundaries',
    'internal-mechanisms': 'Reveals internal mechanisms',
    'data-patterns': 'Uncovers data patterns',
    'causal-pathways': 'Traces causal pathways',
  };

  const targetTags =
    technique.tags?.filter((tag) => tag.includes(`/explains/${answer}`)) || [];

  return targetTags.length > 0 ? targetLabels[answer] || answer : null;
}

function getExplainabilityPropertiesReason(
  technique: Technique,
  answer: string | string[]
): string | null {
  const answers = Array.isArray(answer) ? answer : [answer];
  if (answers.includes('not-sure')) {
    return null;
  }

  const propertyLabels: Record<string, string> = {
    completeness: 'Complete',
    consistency: 'Consistent',
    fidelity: 'High fidelity',
    sparsity: 'Sparse',
    causality: 'Causal',
    comprehensibility: 'Comprehensible',
    efficiency: 'Efficient',
    'counterfactual-validity': 'Counterfactual valid',
  };

  const propertyTags =
    technique.tags?.filter((tag) => tag.includes('/property/')) || [];

  const matchedProperties = answers.filter((prop) =>
    propertyTags.some((tag) => tag.includes(`/property/${prop}`))
  );

  if (matchedProperties.length > 0) {
    const labels = matchedProperties.map(
      (prop) => propertyLabels[prop] || prop
    );
    return labels.join(', ');
  }

  return null;
}
