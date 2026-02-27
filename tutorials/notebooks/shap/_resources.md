# SHAP Tutorial Resources

Pre-fetched resources from Zotero and web for tutorial development.

## Technical Papers

### Yuan et al. (2022) - SHAP Stability Study
**Citation Key:** `yuanEmpiricalStudyEffect2022`
**URL:** http://arxiv.org/abs/2204.11351v3

Key findings for assurance context:
- SHAP explanations fluctuate with small background datasets
- Larger background datasets (500-1000 samples) improve stability
- U-shaped stability: most/least important features more reliably ranked than middle-importance ones
- Recommendation: use as large a background dataset as computationally feasible

**Relevant for tutorial sections:**
- Section 4.4 Common Pitfalls (background dataset size)
- Section 5 Generating Assurance Evidence (stability limitations)

---

## Software Package

### Official SHAP Library
**Citation Key:** `shapShap2016`
**URL:** https://github.com/shap/shap

**Installation:**
```bash
pip install shap
# or
conda install -c conda-forge shap
```

**Core Explainers:**
1. **TreeExplainer** - Fast exact algorithm for tree ensembles (XGBoost, LightGBM, CatBoost, sklearn)
2. **DeepExplainer** - Deep learning models (TensorFlow/Keras/PyTorch) via DeepLIFT
3. **GradientExplainer** - Neural networks via expected gradients
4. **KernelExplainer** - Model-agnostic using weighted local linear regression
5. **LinearExplainer** - Analytical computation for linear models

**Visualization Methods:**
- Waterfall plots (individual feature contributions)
- Force plots (individual and dataset-level)
- Scatter plots (feature interactions)
- Beeswarm plots (feature importance distributions)
- Bar charts (global feature effects)
- Text visualizations (NLP models)

---

## Documentation

### Official SHAP Docs
**URL:** https://shap.readthedocs.io/en/latest/

**Structure:**
1. Introduction - Foundational concepts
2. Examples - Tabular, text, image, genomic data
3. Reference - API docs, examples, benchmarks
4. Development - Releases, contributing

**Key API modules:**
- Explanation objects
- Explainers module
- Plotting utilities
- Maskers for data handling
- Model interfaces

---

## Tutorials

### XAI Tutorials - SHAP Introduction
**Citation Key:** `xai-tutorialsdevelopersIntroductionSHapleyAdditive2023`
**URL:** https://xai-tutorials.readthedocs.io/en/latest/_model_agnostic_xai/shap.html

**Key concepts covered:**
- SHAP as model-agnostic method
- Contrastive explanations (compare prediction to average)
- Mathematical foundation (Shapley values as weighted sums)
- Additivity property (values sum to prediction - baseline)
- KernelSHAP vs TreeSHAP variants

**Example:** Boston housing with 3 features showing positive/negative contributions

### Towards Data Science Tutorial
**Citation Key:** `lopezSHAPShapleyAdditive2021`
**URL:** https://towardsdatascience.com/shap-shapley-additive-explanations-5a2a271ed9c3

**Key concepts covered:**
- Shapley values from cooperative game theory (Lloyd Shapley, 1953)
- Fair distribution of contributions
- Bridge between game theory and ML interpretability
- Practical classification example

---

## Key Concepts Summary

### For Tutorial Section 3 (How It Works)

**Shapley Value Formula:**
- Measures each feature's contribution to prediction
- Calculated as weighted sum of marginal contributions across all feature subsets
- Requires 2^K predictions for K features (exponential complexity)
- SHAP approximates this efficiently without retraining

**Additivity Property:**
- SHAP values sum to: `prediction - baseline`
- Baseline is typically mean prediction across training data
- Enables transparent decomposition of any prediction

### For Tutorial Section 5 (Assurance Evidence)

**Strengths for assurance:**
- Theoretical grounding in Shapley values (axiomatically fair)
- Local + global explanations from same framework
- Model-agnostic (can apply to any model)
- Quantitative feature importance scores

**Limitations/caveats:**
- Assumes feature independence (misleading with correlated features)
- Computationally expensive for many features
- Background dataset choice affects results (use large samples)
- Middle-importance features less reliably ranked

---

## Additional Resources to Consider

- Original Lundberg & Lee (2017) NeurIPS paper
- "A Unified Approach to Interpreting Model Predictions"
- TreeSHAP paper for tree-specific optimizations
