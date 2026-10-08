/**
 * Tag definitions for TEA Techniques
 * This file provides descriptions for all tags used in the system.
 * Definitions are sourced from TAG-DEFINITIONS.md and generated for missing tags.
 */

export const tagDefinitions: Record<string, string> = {
  // Category-level definitions
  'applicable-models':
    'Types of computational models to which the technique can be applied',
  'lifecycle-stage':
    'Stages of the system development lifecycle where the technique is applicable',
  'expertise-needed':
    'Type of knowledge or expertise required to apply the technique effectively',
  'technique-type': 'Fundamental nature and approach of the technique',
  'evidence-type':
    'Type of output or evidential artifact produced by the technique',
  'data-requirements':
    'Specific data needs or dependencies for applying the technique',
  'data-type': 'Types of data for which the technique is designed',
  'assurance-goal-category':
    'Primary assurance goal that the technique helps achieve',
  'explanatory-scope':
    'Whether the explanation is instance-specific (local) or model-wide (global)',

  // Applicable Models - Architecture Dimension
  'applicable-models/architecture/model-agnostic':
    'Works with any model type without requiring specific architecture (black-box techniques)',
  'applicable-models/architecture/neural-networks':
    'Techniques for general neural network architectures',
  'applicable-models/architecture/neural-networks/feedforward':
    'Techniques for standard feedforward networks (MLPs)',
  'applicable-models/architecture/neural-networks/convolutional':
    'Techniques for CNNs and vision models',
  'applicable-models/architecture/neural-networks/recurrent':
    'Techniques for RNNs, LSTMs, and GRUs',
  'applicable-models/architecture/neural-networks/transformer':
    'Techniques for transformer-based architectures',
  'applicable-models/architecture/neural-networks/transformer/llm':
    'Techniques for Large Language Models (GPT, BERT, etc.)',
  'applicable-models/architecture/neural-networks/generative/gan':
    'Techniques for Generative Adversarial Networks',
  'applicable-models/architecture/neural-networks/generative/vae':
    'Techniques for Variational Autoencoders',
  'applicable-models/architecture/tree-based':
    'Techniques for tree-based algorithms (decision trees, random forests, gradient boosting)',
  'applicable-models/architecture/tree-based/gradient-boosting':
    'Techniques for XGBoost, LightGBM, CatBoost, and similar models',
  'applicable-models/architecture/linear-models':
    'Techniques for linear and generalized linear models',
  'applicable-models/architecture/linear-models/regression':
    'Techniques for linear regression models',
  'applicable-models/architecture/linear-models/logistic':
    'Techniques for logistic regression models',
  'applicable-models/architecture/linear-models/gam':
    'Techniques for Generalized Additive Models',
  'applicable-models/architecture/probabilistic':
    'Techniques for explicitly probabilistic models',
  'applicable-models/architecture/probabilistic/gaussian-processes':
    'Techniques for Gaussian Process models',
  'applicable-models/architecture/ensemble':
    'Techniques for ensemble methods that combine multiple base learners',

  // Applicable Models - Paradigm Dimension
  'applicable-models/paradigm/parametric':
    'Models with a fixed number of parameters',
  'applicable-models/paradigm/discriminative':
    'Models that learn decision boundaries directly',
  'applicable-models/paradigm/generative':
    'Models that learn data distributions',
  'applicable-models/paradigm/supervised': 'Requires labelled training data',
  'applicable-models/paradigm/unsupervised': 'Works with unlabeled data',
  'applicable-models/paradigm/probabilistic':
    'Models that provide probabilistic outputs and reasoning',
  'applicable-models/paradigm/reinforcement':
    'Models that learn through interaction with an environment',

  // Applicable Models - Requirements Dimension
  'applicable-models/requirements/gradient-access':
    'Requires access to model gradients',
  'applicable-models/requirements/model-internals':
    'Requires access to weights, neurons, or internal representations',
  'applicable-models/requirements/architecture-specific':
    'Requires specific architectural components to function',
  'applicable-models/requirements/white-box':
    'Requires full model transparency and access',
  'applicable-models/requirements/gray-box':
    'Requires partial model access (between black-box and white-box)',
  'applicable-models/requirements/black-box':
    'Only requires input-output access, no internal model access needed',
  'applicable-models/requirements/differentiable':
    'Model must be differentiable',
  'applicable-models/requirements/probabilistic-output':
    'Model must provide probability distributions as output',

  // Lifecycle Stage - Category Level Tags
  'lifecycle-stage/project-design':
    'Early-stage activities focused on scoping, planning, problem formulation, data procurement, and analysis',
  'lifecycle-stage/model-development':
    'Activities focused on preparing data, building, training, testing, and documenting the AI model',
  'lifecycle-stage/system-deployment':
    'Activities focused on deploying, operating, maintaining, and monitoring the AI system in production',

  // Lifecycle Stage - Project Design Category (Specific Stages)
  'lifecycle-stage/project-design/project-planning':
    'Preliminary activities designed to help scope out the aims, objectives, and processes involved with the project, including potential risks and benefits',
  'lifecycle-stage/project-design/problem-formulation':
    'The formulation of a clear statement about the overarching problem the system or project addresses (e.g. a research statement or system specification) and a lower level description of the computational procedure that instantiates it',
  'lifecycle-stage/project-design/data-extraction-or-procurement':
    'The design of an experimental method or decisions about data gathering and collection, based on the planning and problem formulation from the previous steps',
  'lifecycle-stage/project-design/data-analysis':
    'Stages of exploratory and confirmatory data analysis designed to help researchers or developers identify relevant associations between input variables and target variables',

  // Lifecycle Stage - Model Development Category (Specific Stages)
  'lifecycle-stage/model-development/preprocessing-and-feature-engineering':
    'A process of cleaning, normalising, and refactoring data into the features that will be used in model training and testing, as well as the features that may be used in the final system',
  'lifecycle-stage/model-development/model-selection-and-training':
    'The selection of a particular algorithm (or multiple algorithms) for training the model',
  'lifecycle-stage/model-development/model-testing-and-validation':
    'Testing the model against a variety of metrics, which may include those that assess how accurate a model is for different sub-groups of a population. This is important where issues of fairness or equality may arise',
  'lifecycle-stage/model-development/model-documentation':
    'A process of documenting both the formal and non-formal properties of both the model and the processes by which it was developed (e.g. source of data, algorithms used and evaluation metrics)',

  // Lifecycle Stage - System Deployment Category (Specific Stages)
  'lifecycle-stage/system-deployment/system-implementation':
    "The process of putting a model into production, and implementing the operational system, which enables and structures interaction with the model, within the respective environment (e.g. a recommender system that converts a user's existing movie ratings into recommendations for future watches)",
  'lifecycle-stage/system-deployment/user-training':
    'Training for those individuals or groups who are either required to operate a data-driven system (perhaps in a safety-critical context) or who are likely to use the system (e.g. consumers)',
  'lifecycle-stage/system-deployment/system-use-and-monitoring':
    'Ongoing monitoring and feedback from the system, either automated or probed, to ensure that issues such as model drift have not affected performance or resulted in harms to individuals or groups',
  'lifecycle-stage/system-deployment/model-updating-or-deprovisioning':
    'An algorithmic model that adapts its behaviour over time or context may require updating or deprovisioning (i.e. removing from the production environment)',

  // Lifecycle Stage - Other Category
  'lifecycle-stage/other/cross-cutting':
    'Techniques that apply across multiple lifecycle stages',

  // Expertise Needed
  'expertise-needed/statistics':
    'Requires knowledge of statistical methods and analysis',
  'expertise-needed/causal-inference':
    'Requires understanding of causal relationships and inference',
  'expertise-needed/domain-expertise':
    'Requires deep understanding of the problem domain',
  'expertise-needed/ml-engineering':
    'Requires machine learning engineering skills',
  'expertise-needed/software-engineering':
    'Requires general programming and system design skills',
  'expertise-needed/ethics':
    'Requires knowledge of ethical principles and frameworks',
  'expertise-needed/regulatory-compliance':
    'Requires understanding of regulatory requirements',
  'expertise-needed/cryptography':
    'Requires cryptographic knowledge for privacy-preserving techniques',
  'expertise-needed/security':
    'Requires security expertise for threat analysis and mitigation',
  'expertise-needed/safety-engineering':
    'Requires safety engineering principles and practices',
  'expertise-needed/linguistics':
    'Requires linguistic knowledge for language-based techniques',
  'expertise-needed/stakeholder-engagement':
    'Requires skills in stakeholder communication and engagement',

  // Evidence Type
  'evidence-type/quantitative-metric':
    'Produces numerical scores, coefficients, or measurements',
  'evidence-type/visualisation':
    'Creates visual representations of data or model behaviour',
  'evidence-type/qualitative-report':
    'Generates textual analysis or narrative documentation',
  'evidence-type/structured-output':
    'Produces structured data like rules or decision trees',
  'evidence-type/fairness-metric':
    'Generates specific metrics related to fairness assessment',
  'evidence-type/privacy-guarantee':
    'Provides formal privacy guarantees like differential privacy',
  'evidence-type/documentation':
    'Creates standardized documentation like model cards',
  'evidence-type/prediction-interval':
    'Produces uncertainty ranges for predictions',
  'evidence-type/boundary-analysis':
    'Analyses decision boundaries and edge cases',
  'evidence-type/causal-analysis':
    'Provides insights into causal relationships',
  'evidence-type/dataset-analysis':
    'Analyses characteristics and quality of datasets',
  'evidence-type/synthetic-data': 'Generates synthetic or simulated data',
  'evidence-type/governance-framework':
    'Establishes governance structures and processes',
  'evidence-type/decision-record':
    'Produces a documented record of a decision and the reasoning behind it',
  'evidence-type/statistical-test':
    'Produces a hypothesis test result with a test statistic and significance level',

  // Data Requirements
  'data-requirements/labelled-data':
    'Requires datasets with ground truth labels',
  'data-requirements/no-special-requirements':
    'Works with standard inputs without special requirements',
  'data-requirements/access-to-training-data':
    'Requires the original training dataset',
  'data-requirements/calibration-set':
    'Requires a calibration dataset for adjustment',
  'data-requirements/sensitive-attributes':
    'Needs data labelled with protected attributes',
  'data-requirements/causal-graph':
    'Requires a predefined causal structure or graph',
  'data-requirements/reference-dataset':
    'Needs a baseline or reference dataset for comparison',
  'data-requirements/pre-trained-model':
    'Requires an existing trained model as input',
  'data-requirements/test-scenarios':
    'Requires predefined test cases or scenarios',

  // Data Type
  'data-type/any': 'Applicable across all data types',
  'data-type/tabular': 'Designed for structured tabular data',
  'data-type/text': 'Designed for text and natural language data',
  'data-type/image': 'Designed for image and visual data',
  'data-type/time-series': 'Designed for sequential or time-indexed data',

  // Technique Type
  'technique-type/algorithmic': 'A specific algorithm or computational method',
  'technique-type/documentation': 'A template or standard for documentation',
  'technique-type/metric': 'A specific measure or calculation method',
  'technique-type/process': 'An organizational or workflow approach',
  'technique-type/visualisation': 'A method focused on visual representation',
  'technique-type/testing': 'Techniques focused on testing and validation',

  // Assurance Goal Categories
  'assurance-goal-category/explainability':
    'Techniques that help understand model decisions and behaviour',

  // EXPLAINABILITY - METHOD DIMENSION
  // Attribution Methods
  'assurance-goal-category/explainability/attribution-methods':
    'Techniques that assign importance scores to inputs/features',
  'assurance-goal-category/explainability/attribution-methods/gradient-based':
    'Uses gradients/derivatives to compute feature importance (e.g., Integrated Gradients, Saliency Maps)',
  'assurance-goal-category/explainability/attribution-methods/perturbation-based':
    'Modifies inputs to measure impact on outputs (e.g., SHAP, Permutation Importance)',
  'assurance-goal-category/explainability/attribution-methods/model-specific':
    'Leverages specific model architecture for attribution (e.g., Mean Decrease Impurity for trees)',

  // Surrogate Models
  'assurance-goal-category/explainability/surrogate-models':
    'Techniques that approximate complex models with interpretable ones',
  'assurance-goal-category/explainability/surrogate-models/local-surrogates':
    'Approximates model behaviour around specific instances (e.g., LIME)',
  'assurance-goal-category/explainability/surrogate-models/global-surrogates':
    'Approximates entire model behaviour with simpler model (e.g., GAMs, Model Distillation)',
  'assurance-goal-category/explainability/surrogate-models/rule-extraction':
    'Extracts interpretable rules from complex models (e.g., ANCHOR, RuleFit)',

  // Visualization Methods
  'assurance-goal-category/explainability/visualization-methods':
    'Techniques focused on visual representation of model behaviour',
  'assurance-goal-category/explainability/visualization-methods/feature-relationships':
    'Visualises how features affect predictions (e.g., PDP, ICE Plots)',
  'assurance-goal-category/explainability/visualization-methods/attention-patterns':
    'Displays attention mechanisms in models (e.g., Attention Visualization in Transformers)',
  'assurance-goal-category/explainability/visualization-methods/activation-maps':
    'Creates visual heatmaps of model activations (e.g., Grad-CAM, Saliency Maps)',

  // Representation Analysis
  'assurance-goal-category/explainability/representation-analysis':
    'Techniques analysing internal model representations',
  'assurance-goal-category/explainability/representation-analysis/dimensionality-reduction':
    'Reduces complexity for understanding (e.g., PCA, t-SNE, UMAP)',
  'assurance-goal-category/explainability/representation-analysis/concept-identification':
    'Identifies learned concepts in models (e.g., CAVs, Neuron Activation Analysis)',
  'assurance-goal-category/explainability/representation-analysis/decomposition':
    'Breaks down predictions into components (e.g., Taylor Decomposition, Contextual Decomposition)',

  // Instance-Based Methods
  'assurance-goal-category/explainability/instance-based':
    'Techniques using example-based explanations',
  'assurance-goal-category/explainability/instance-based/prototypes':
    'Uses representative examples for explanation (e.g., Prototype & Criticism Models)',
  'assurance-goal-category/explainability/instance-based/influence-analysis':
    'Traces impact of training data on predictions (e.g., Influence Functions)',
  'assurance-goal-category/explainability/instance-based/counterfactual':
    'Shows alternative scenarios that would change outcome (e.g., Contrastive Explanation Method)',

  // Uncertainty Analysis
  'assurance-goal-category/explainability/uncertainty-analysis':
    'Techniques quantifying model confidence and robustness',
  'assurance-goal-category/explainability/uncertainty-analysis/prediction-uncertainty':
    'Measures confidence in predictions (e.g., Monte Carlo Dropout)',
  'assurance-goal-category/explainability/uncertainty-analysis/sensitivity-testing':
    'Tests robustness to input changes (e.g., Prompt Sensitivity Analysis, Occlusion Sensitivity)',

  // Causal Analysis
  'assurance-goal-category/explainability/causal-analysis':
    'Techniques examining causal relationships in models',
  'assurance-goal-category/explainability/causal-analysis/mediation-analysis':
    'Traces causal pathways through model (e.g., Causal Mediation Analysis)',
  'assurance-goal-category/explainability/causal-analysis/interaction-effects':
    'Analyses feature interactions and their effects (e.g., Sobol Indices, Factor Analysis)',

  // Model Simplification
  'assurance-goal-category/explainability/model-simplification':
    'Techniques that create simpler, more interpretable models',
  'assurance-goal-category/explainability/model-simplification/pruning':
    'Removes unnecessary model components (e.g., Model Pruning)',
  'assurance-goal-category/explainability/model-simplification/knowledge-transfer':
    'Transfers knowledge to simpler model (e.g., Model Distillation)',

  // EXPLAINABILITY - TARGET DIMENSION
  'assurance-goal-category/explainability/explains':
    'The aspect of model behaviour or data that the technique reveals',
  'assurance-goal-category/explainability/explains/feature-importance':
    'Identifies which inputs matter most for predictions',
  'assurance-goal-category/explainability/explains/decision-boundaries':
    'Shows how the model separates different outcomes',
  'assurance-goal-category/explainability/explains/internal-mechanisms':
    'Reveals how the model processes information internally',
  'assurance-goal-category/explainability/explains/prediction-confidence':
    'Quantifies how certain/uncertain the model is',
  'assurance-goal-category/explainability/explains/data-patterns':
    'Uncovers underlying structures and relationships in data',
  'assurance-goal-category/explainability/explains/causal-pathways':
    'Shows how effects propagate through the model',

  // EXPLAINABILITY - PROPERTY DIMENSION
  'assurance-goal-category/explainability/property':
    'Key quality characteristics of the explanation',
  'assurance-goal-category/explainability/property/completeness':
    'Attributions fully account for model output',
  'assurance-goal-category/explainability/property/consistency':
    'Similar inputs produce similar explanations',
  'assurance-goal-category/explainability/property/fidelity':
    'Accurately represents true model behaviour',
  'assurance-goal-category/explainability/property/sparsity':
    'Focuses on few, most important factors',
  'assurance-goal-category/explainability/property/causality':
    'Identifies causal rather than correlational relationships',
  'assurance-goal-category/explainability/property/comprehensibility':
    'Produces human-understandable formats',
  'assurance-goal-category/explainability/property/efficiency':
    'Computationally efficient to generate',
  'assurance-goal-category/explainability/property/counterfactual-validity':
    'Can show what changes would alter outcomes',

  'assurance-goal-category/fairness':
    'Techniques that assess or improve fairness in AI systems',
  'assurance-goal-category/general':
    'Techniques that govern, record or control the work of building and running an AI system, rather than assess one property of the model',
  'assurance-goal-category/privacy':
    'Techniques that protect data privacy and confidentiality',
  'assurance-goal-category/privacy/formal-guarantee':
    'Produces a mathematical or cryptographic guarantee about what an observer can learn about individuals.',
  'assurance-goal-category/reliability':
    'Techniques that ensure consistent and dependable performance',
  'assurance-goal-category/reliability/uncertainty-quantification':
    'Techniques that estimate how far a prediction could be wrong, as intervals, sets or spread across models.',
  'assurance-goal-category/reliability/robustness':
    'Techniques that test or improve whether performance holds when inputs, prompts, data or conditions change.',
  'assurance-goal-category/reliability/performance-assessment':
    'Techniques that measure how well a model performs and whether the measured result is real and repeatable.',
  'assurance-goal-category/safety':
    'Techniques that prevent harmful or dangerous outcomes',
  'assurance-goal-category/safety/hazard-analysis':
    'Techniques that work out why unsafe behaviour arises, by tracing it to causes inside the model, its data or its design.',
  'assurance-goal-category/safety/monitoring':
    "Techniques that watch a running system's inputs and usage and flag what is unusual, out of scope or misused.",
  'assurance-goal-category/transparency':
    'Techniques that increase system openness and clarity',
  'assurance-goal-category/transparency/documentation':
    'Techniques that produce a written disclosure about a model, dataset or system, such as a model card, datasheet or system card.',
  'assurance-goal-category/transparency/audit-trail':
    'Produces a dated record of what was done to a system or its data, so a third party can reconstruct it later.',
  'assurance-goal-category/security':
    'Techniques that protect the system from malicious attacks or unauthorized access',

  // Explanatory Scope
  'explanatory-scope/local': 'Provides explanations for individual predictions',
  'explanatory-scope/global':
    'Provides explanations for overall model behaviour',

  'assurance-goal-category/safety/hazard-identification':
    'Techniques that find how a system could fail or cause harm, by probing it for unsafe behaviours, failure modes and rare scenarios.',
  'assurance-goal-category/safety/verification':
    'Techniques that test a system against a stated safety requirement, such as refusing harmful requests or holding up at its limits.',
  'assurance-goal-category/safety/safeguards':
    'Techniques that lower the chance or impact of harm, such as redundancy, data screening, human oversight or documented limits of use.',
  'assurance-goal-category/security/vulnerability-testing':
    'Techniques that attack a model or its defences to measure how well they hold, such as jailbreak, injection or extraction tests.',
  'assurance-goal-category/security/protection':
    'Techniques that protect a model or its data from attack, theft or exposure, such as encryption or ownership marking.',
  'assurance-goal-category/security/detection':
    'Techniques that spot attacks, tampering or misuse of a model or its training data, whether in operation or before training.',
  'assurance-goal-category/security/threat-analysis':
    'Techniques that map who might attack a system, how, and what they could gain, so defences can be chosen to fit.',
  'assurance-goal-category/reliability/calibration':
    "Techniques that check or correct whether a model's stated confidence matches how often it is right.",
  'assurance-goal-category/reliability/shift-detection':
    'Techniques that detect when inputs or conditions move outside what the model was built and tested for.',
  'assurance-goal-category/reliability/behavioural-consistency':
    'Techniques that check or enforce that a system keeps behaving as specified across scenarios, not just scoring well.',
  'assurance-goal-category/privacy/exposure-reduction':
    'Techniques that reduce how much real personal data is collected, shared or retained, without proving a bound on what remains.',
  'assurance-goal-category/privacy/leakage-testing':
    'Techniques that test whether a model, dataset or output reveals information about the individuals behind the data.',
  'assurance-goal-category/privacy/exposure-reduction/data-minimisation':
    'Techniques that collect, share or retain no more personal data than the purpose needs (the data-minimisation principle).',
  'assurance-goal-category/fairness/bias-measurement':
    'Techniques that test for and quantify unequal treatment linked to protected attributes, in outputs, inputs or representations.',
  'assurance-goal-category/fairness/bias-diagnosis':
    'Techniques that show which features, concepts or training examples make a model treat groups differently.',
  'assurance-goal-category/fairness/performance-by-group':
    'Techniques that estimate or report accuracy, calibration or uncertainty separately for each group so gaps can be seen or closed.',
  'assurance-goal-category/fairness/pre-processing':
    'Techniques that change the training data or its features before training so that the model learns less bias.',
  'assurance-goal-category/fairness/in-processing':
    'Techniques that build a fairness constraint, penalty or adversary into model training.',
  'assurance-goal-category/fairness/post-processing':
    'Techniques that adjust decisions or thresholds after training so that outcomes or error rates match across groups.',
  'assurance-goal-category/transparency/assessment-results':
    'Produces measured findings on how a system performs or behaves, in a form that can be reported to those who rely on or oversee it.',
  'assurance-goal-category/transparency/confidence-and-limits':
    'Techniques that show users how far to trust each output and when a request falls outside what the system can handle.',
  'assurance-goal-category/transparency/decision-reasons':
    "Techniques that give people outside the build team the reasons, rules or sources behind a model's outputs, so they can check them.",
  'assurance-goal-category/transparency/notice-and-recourse':
    'Techniques that tell an affected person what a decision rested on and what they could change or challenge to get another outcome.',
  'assurance-goal-category/transparency/readable-by-design':
    'Techniques that make a model or its inputs readable as they stand, so a reviewer needs no separate explanation step.',
  'assurance-goal-category/transparency/confidential-verification':
    'Techniques that let an outside party check a claim about a system or its data without being handed the data or the model.',
  'assurance-goal-category/general/governance-and-review':
    'Techniques that give a review body, named person or independent team the job of examining, challenging, approving or stopping an AI system.',
  'assurance-goal-category/general/documentation-and-records':
    'Techniques that keep an inspectable record of what an AI system and its data are, how they were built and what changed.',
  'assurance-goal-category/general/runtime-safeguards':
    'Techniques that watch a running system and limit, reroute or stop it when it leaves expected bounds.',
};
