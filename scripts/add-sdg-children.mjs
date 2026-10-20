// One-off migration, already applied, written for the pre-October vocabulary; must not be rerun.
/**
 * Add child techniques for synthetic-data-generation umbrella.
 *
 * Adds three specific child techniques:
 *   1. gan-based-tabular-synthetic-data
 *   2. statistical-oversampling-methods
 *   3. simulation-based-synthetic-data
 *
 * Also updates the parent technique's related_techniques to reference its children,
 * and updates synthetic-data-evaluation to reference the new children.
 *
 * Usage: node scripts/add-sdg-children.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');
const TECHNIQUES_FILE = 'public/data/techniques.json';

const NEW_TECHNIQUES = [
  {
    slug: 'gan-based-tabular-synthetic-data',
    name: 'GAN-Based Tabular Synthetic Data',
    description:
      'Generates synthetic tabular datasets using Generative Adversarial Networks, most commonly through architectures such as CTGAN (Conditional Tabular GAN) and TVAE (Triplet-based Variational Autoencoder). These models learn the joint distribution of mixed-type columns — continuous, discrete, and categorical — by training a generator and discriminator in an adversarial framework, with mode-specific normalisation to handle multimodal continuous distributions and training-by-sampling to address class imbalance. The resulting synthetic tables aim to preserve statistical relationships, correlations, and marginal distributions of the original data whilst containing no real records, supporting privacy-preserving data sharing, model development on sensitive datasets, and augmentation of limited training data.',
    assurance_goals: ['Privacy', 'Reliability', 'Fairness'],
    tags: [
      'applicable-models/architecture/neural-networks/generative/gan',
      'applicable-models/architecture/neural-networks/generative/vae',
      'applicable-models/paradigm/generative',
      'applicable-models/paradigm/unsupervised',
      'applicable-models/requirements/training-data',
      'applicable-models/requirements/gradient-access',
      'assurance-goal-category/privacy',
      'assurance-goal-category/privacy/formal-guarantee',
      'assurance-goal-category/reliability',
      'assurance-goal-category/reliability/uncertainty-quantification',
      'assurance-goal-category/fairness',
      'assurance-goal-category/fairness/group',
      'data-requirements/no-special-requirements',
      'data-type/tabular',
      'evidence-type/structured-output',
      'evidence-type/synthetic-data',
      'expertise-needed/ml-engineering',
      'expertise-needed/statistics',
      'lifecycle-stage/data-collection',
      'lifecycle-stage/data-collection/data-augmentation',
      'lifecycle-stage/data-handling',
      'technique-type/algorithmic',
    ],
    example_use_cases: [
      {
        description:
          'Generating synthetic patient records from hospital databases using CTGAN to enable multi-institution collaborative research on treatment outcomes without sharing identifiable health data across organisational boundaries.',
        goal: 'Privacy',
      },
      {
        description:
          'Augmenting a limited fraud detection training set by generating synthetic fraudulent transaction records that preserve the statistical characteristics of rare fraud patterns, improving model recall on underrepresented fraud types.',
        goal: 'Reliability',
      },
      {
        description:
          'Creating balanced synthetic datasets for credit scoring by generating additional records for underrepresented demographic groups, enabling fairness testing across protected characteristics without collecting new sensitive data.',
        goal: 'Fairness',
      },
    ],
    limitations: [
      {
        description:
          'Training instability inherent to GAN architectures (mode collapse, vanishing gradients) can result in synthetic data that fails to capture the full diversity of the original distribution, particularly for rare categories or tail distributions.',
      },
      {
        description:
          'Requires substantial computational resources and hyperparameter tuning, with training times scaling poorly for datasets with many columns or complex inter-column dependencies.',
      },
      {
        description:
          'Privacy guarantees are not inherent — without additional mechanisms like differential privacy, GAN-generated data may leak information about training records through memorisation or membership inference attacks.',
      },
      {
        description:
          'Performance degrades significantly on datasets with high cardinality categorical columns, complex temporal dependencies, or relational structures across multiple tables.',
      },
    ],
    resources: [
      'sdv-devSDV2018',
      'santosHowGenerateRealWorld2023',
      'e.livierisEvaluationFrameworkSynthetic2024',
      'ramachandranpillaiBtGANGeneratingFair2024',
    ],
    complexity_rating: 4,
    computational_cost_rating: 4,
    related_techniques: [
      'synthetic-data-generation',
      'synthetic-data-evaluation',
      'differential-privacy',
      'fairness-gan',
    ],
    sample_claims: [
      {
        text: 'The synthetic patient dataset generated by CTGAN preserves statistical correlations between clinical variables whilst containing no records traceable to real patients',
        domain: 'healthcare',
        assuranceGoal: 'privacy',
      },
      {
        text: 'The augmented training dataset includes GAN-generated records for underrepresented demographic groups, achieving balanced representation across all protected characteristics',
        domain: 'finance',
        assuranceGoal: 'fairness',
      },
      {
        text: 'The fraud detection model has been validated on GAN-generated synthetic transaction data that preserves the statistical distribution of rare fraud patterns from the original dataset',
        domain: 'finance',
        assuranceGoal: 'reliability',
      },
    ],
  },
  {
    slug: 'statistical-oversampling-methods',
    name: 'Statistical Oversampling Methods',
    description:
      'A family of data augmentation techniques that generate synthetic minority-class examples through geometric interpolation in feature space, addressing class imbalance problems that degrade classifier performance on underrepresented groups. The foundational method, SMOTE (Synthetic Minority Over-sampling Technique), creates new instances by interpolating between existing minority samples and their k-nearest neighbours. Extensions include Borderline-SMOTE (focusing generation near decision boundaries), ADASYN (adaptively weighting harder-to-learn instances), and SVMSMOTE (using support vectors to guide generation). These methods operate directly on feature vectors without requiring neural network training, making them computationally lightweight and applicable to any tabular classification task.',
    assurance_goals: ['Fairness', 'Reliability'],
    tags: [
      'applicable-models/requirements/model-agnostic',
      'applicable-models/paradigm/supervised',
      'applicable-models/requirements/training-data',
      'assurance-goal-category/fairness',
      'assurance-goal-category/fairness/group',
      'assurance-goal-category/fairness/process',
      'assurance-goal-category/reliability',
      'assurance-goal-category/reliability/performance-assessment',
      'data-requirements/labelled-data',
      'data-type/tabular',
      'evidence-type/structured-output',
      'evidence-type/synthetic-data',
      'expertise-needed/statistics',
      'expertise-needed/ml-engineering',
      'lifecycle-stage/data-collection',
      'lifecycle-stage/data-collection/data-augmentation',
      'lifecycle-stage/data-handling',
      'technique-type/algorithmic',
    ],
    example_use_cases: [
      {
        description:
          'Applying SMOTE to oversample underrepresented ethnic groups in a loan approval training dataset, ensuring the classifier has sufficient examples from each demographic group to learn fair decision boundaries.',
        goal: 'Fairness',
      },
      {
        description:
          'Using ADASYN to generate synthetic examples of rare manufacturing defect types, improving the reliability of quality control classifiers on edge cases that occur in fewer than 1% of production runs.',
        goal: 'Reliability',
      },
      {
        description:
          'Applying Borderline-SMOTE to augment minority-class examples near the decision boundary in a medical diagnosis task, reducing false-negative rates for rare conditions without collecting additional patient data.',
        goal: 'Reliability',
      },
      {
        description:
          'Oversampling underrepresented protected groups in a hiring dataset to enable equitable evaluation of candidates across gender and ethnicity, ensuring the model does not simply learn to predict the majority class.',
        goal: 'Fairness',
      },
    ],
    limitations: [
      {
        description:
          'Interpolation in feature space can generate synthetic instances that fall in regions of the feature space not occupied by the true data distribution, introducing noise or unrealistic combinations — particularly problematic for high-dimensional data.',
      },
      {
        description:
          'Does not address the root cause of class imbalance (e.g. data collection bias, structural underrepresentation) and may mask rather than resolve underlying fairness issues in the data pipeline.',
      },
      {
        description:
          'Performance degrades on high-dimensional datasets where the nearest-neighbour assumption breaks down, and oversampling in such spaces can amplify noise dimensions without improving classification.',
      },
      {
        description:
          'Assumes the minority class forms coherent clusters in feature space; when minority examples are scattered or overlap heavily with majority-class regions, interpolation produces ambiguous or mislabelled synthetic samples.',
      },
    ],
    resources: [],
    complexity_rating: 2,
    computational_cost_rating: 1,
    related_techniques: [
      'synthetic-data-generation',
      'synthetic-data-evaluation',
      'gan-based-tabular-synthetic-data',
    ],
    sample_claims: [
      {
        text: 'The training dataset has been balanced using SMOTE oversampling to ensure the classifier has sufficient representation of all demographic groups for equitable decision-making',
        domain: 'finance',
        assuranceGoal: 'fairness',
      },
      {
        text: 'The rare defect classifier has been trained on an ADASYN-augmented dataset that maintains the original feature distributions whilst ensuring adequate representation of all defect categories',
        domain: 'manufacturing',
        assuranceGoal: 'reliability',
      },
      {
        text: 'The diagnostic model performance on rare conditions has been improved through Borderline-SMOTE augmentation targeting samples near the decision boundary, without introducing fabricated clinical relationships',
        domain: 'healthcare',
        assuranceGoal: 'reliability',
      },
    ],
  },
  {
    slug: 'simulation-based-synthetic-data',
    name: 'Simulation-Based Synthetic Data Generation',
    description:
      'Generates synthetic datasets through computational simulation of underlying data-generating processes, encompassing statistical methods (copula models, parametric distribution fitting), agent-based models, physics-informed simulators, and Monte Carlo sampling. Unlike neural-network-based approaches, these methods encode explicit domain knowledge or statistical structure into the generation process — copulas model multivariate dependencies through known distributional families, agent-based simulations construct data from interacting rule-driven entities, and physics-informed generators embed differential equation constraints. This makes the synthetic data more interpretable and auditable, with known theoretical properties, at the cost of reduced flexibility for capturing complex nonlinear patterns that lack a known generative model.',
    assurance_goals: ['Safety', 'Reliability', 'Privacy'],
    tags: [
      'applicable-models/requirements/model-agnostic',
      'applicable-models/paradigm/generative',
      'applicable-models/architecture/probabilistic',
      'assurance-goal-category/safety',
      'assurance-goal-category/safety/risk-identification',
      'assurance-goal-category/safety/hazard-analysis',
      'assurance-goal-category/reliability',
      'assurance-goal-category/reliability/uncertainty-quantification',
      'assurance-goal-category/privacy',
      'assurance-goal-category/privacy/formal-guarantee',
      'data-requirements/no-special-requirements',
      'data-type/tabular',
      'data-type/time-series',
      'evidence-type/structured-output',
      'evidence-type/synthetic-data',
      'evidence-type/statistical-test',
      'expertise-needed/domain-expertise',
      'expertise-needed/statistics',
      'lifecycle-stage/data-collection',
      'lifecycle-stage/data-collection/data-augmentation',
      'lifecycle-stage/model-development',
      'lifecycle-stage/model-development/testing',
      'technique-type/algorithmic',
      'technique-type/process-based',
    ],
    example_use_cases: [
      {
        description:
          'Using copula-based simulation to generate synthetic financial portfolio data preserving tail dependencies and correlation structures, enabling stress testing of risk models under extreme market conditions without relying solely on limited historical crash data.',
        goal: 'Safety',
      },
      {
        description:
          'Running agent-based traffic simulations to generate synthetic autonomous vehicle sensor data covering rare and dangerous driving scenarios (pedestrian occlusion, multi-vehicle pile-ups) that are impractical or unethical to collect in real-world testing.',
        goal: 'Safety',
      },
      {
        description:
          'Employing Monte Carlo simulation to generate synthetic clinical trial outcome data for sensitivity analysis of treatment-effect estimators, quantifying how model predictions change across plausible data-generating processes.',
        goal: 'Reliability',
      },
      {
        description:
          'Fitting Gaussian copula models to census microdata to generate synthetic population datasets that preserve multivariate demographic relationships whilst providing formal disclosure limitation through the generation process.',
        goal: 'Privacy',
      },
    ],
    limitations: [
      {
        description:
          'Requires explicit specification of the data-generating process, meaning that important but unknown relationships or latent factors not captured in the simulation model will be absent from the synthetic data.',
      },
      {
        description:
          'Copula models assume that dependencies can be separated from marginal distributions, which may not hold for complex real-world datasets where the dependency structure itself varies across the marginal distribution.',
      },
      {
        description:
          'Agent-based and physics-informed simulators require significant domain expertise to design, calibrate, and validate, making them resource-intensive compared to data-driven approaches.',
      },
      {
        description:
          'Scalability is limited for high-dimensional problems — parametric models face the curse of dimensionality in specifying joint distributions, and agent-based simulations become computationally expensive as the number of interacting entities grows.',
      },
    ],
    resources: ['sdv-devSDV2018', 'e.livierisEvaluationFrameworkSynthetic2024'],
    complexity_rating: 3,
    computational_cost_rating: 3,
    related_techniques: [
      'synthetic-data-generation',
      'synthetic-data-evaluation',
      'sensitivity-analysis-for-fairness',
    ],
    sample_claims: [
      {
        text: 'The risk model has been stress-tested using copula-simulated scenarios that preserve the tail dependence structure of historical market crashes whilst exploring conditions beyond observed extremes',
        domain: 'finance',
        assuranceGoal: 'safety',
      },
      {
        text: 'The autonomous vehicle perception system has been validated against agent-based simulation data covering rare hazardous scenarios that cannot be safely or frequently observed in real-world testing',
        domain: 'autonomous systems',
        assuranceGoal: 'safety',
      },
      {
        text: 'The treatment-effect estimator has been subjected to Monte Carlo sensitivity analysis demonstrating robustness of conclusions across 10,000 plausible data-generating processes',
        domain: 'healthcare',
        assuranceGoal: 'reliability',
      },
      {
        text: 'The released population dataset was generated through copula-based simulation that preserves demographic correlations whilst providing formal disclosure limitation guarantees',
        domain: 'government',
        assuranceGoal: 'privacy',
      },
    ],
  },
];

const PARENT_SLUG = 'synthetic-data-generation';
const CHILD_SLUGS = NEW_TECHNIQUES.map((t) => t.slug);

// Load data
const raw = readFileSync(TECHNIQUES_FILE, 'utf8');
const techniques = JSON.parse(raw);

// biome-ignore lint/suspicious/noConsole: CLI script
console.log(`Loaded ${techniques.length} techniques`);

// Step 1: Insert new techniques after the parent
const parentIdx = techniques.findIndex((t) => t.slug === PARENT_SLUG);
if (parentIdx === -1) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.error(`ERROR: Parent technique '${PARENT_SLUG}' not found`);
  process.exit(1);
}

// Check no duplicates
for (const nt of NEW_TECHNIQUES) {
  if (techniques.some((t) => t.slug === nt.slug)) {
    // biome-ignore lint/suspicious/noConsole: CLI script
    console.error(`ERROR: Technique '${nt.slug}' already exists`);
    process.exit(1);
  }
}

techniques.splice(parentIdx + 1, 0, ...NEW_TECHNIQUES);

// biome-ignore lint/suspicious/noConsole: CLI script
console.log(
  `Inserted ${NEW_TECHNIQUES.length} child techniques after '${PARENT_SLUG}'`
);

// Step 2: Update parent's related_techniques to include children
const parent = techniques[parentIdx];
const parentRels = parent.related_techniques || [];
for (const childSlug of CHILD_SLUGS) {
  if (!parentRels.includes(childSlug)) {
    parentRels.push(childSlug);
  }
}
parent.related_techniques = parentRels;
// biome-ignore lint/suspicious/noConsole: CLI script
console.log(`Updated parent related_techniques: [${parentRels.join(', ')}]`);

// Step 3: Update synthetic-data-evaluation to reference new children
const sde = techniques.find((t) => t.slug === 'synthetic-data-evaluation');
if (sde) {
  const sdeRels = sde.related_techniques || [];
  for (const childSlug of CHILD_SLUGS) {
    if (!sdeRels.includes(childSlug)) {
      sdeRels.push(childSlug);
    }
  }
  sde.related_techniques = sdeRels;
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `Updated synthetic-data-evaluation related_techniques: [${sdeRels.join(', ')}]`
  );
}

// Step 4: Verify no dangling references
const slugSet = new Set(techniques.map((t) => t.slug));
let danglingCount = 0;
for (const t of techniques) {
  for (const rel of t.related_techniques || []) {
    if (!slugSet.has(rel)) {
      // biome-ignore lint/suspicious/noConsole: CLI script
      console.log(`WARNING: ${t.slug} has dangling ref to '${rel}'`);
      danglingCount++;
    }
  }
}
if (danglingCount === 0) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log('No dangling references found.');
}

// Step 5: Write if not dry run
if (DRY_RUN) {
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(
    `\n[DRY RUN] Would write ${techniques.length} techniques. No changes written.`
  );
} else {
  writeFileSync(TECHNIQUES_FILE, `${JSON.stringify(techniques, null, 2)}\n`);
  // biome-ignore lint/suspicious/noConsole: CLI script
  console.log(`\nWrote ${techniques.length} techniques to ${TECHNIQUES_FILE}`);
}
