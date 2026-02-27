# SHAP (SHapley Additive exPlanations) Tutorial

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/alan-turing-institute/tea-techniques/blob/main/tutorials/notebooks/shap/shap-tutorial.ipynb)

**Assurance Goals:** Explainability, Fairness, Reliability
**Difficulty:** Intermediate
**Time:** ~60-90 minutes

## Overview

This interactive tutorial teaches you how to use SHAP to explain machine learning predictions and generate assurance evidence. SHAP (SHapley Additive exPlanations) is based on Shapley values from game theory, providing a mathematically principled way to attribute predictions to individual features.

## What You'll Learn

1. **What SHAP values represent** and their theoretical foundation (Shapley values)
2. **How to apply SHAP** to tree-based models using TreeExplainer
3. **How to interpret** waterfall plots, beeswarm plots, and dependence plots
4. **When SHAP may be unreliable** (correlated features, small background datasets)
5. **How to generate assurance evidence** including stability testing
6. **Limitations** of SHAP for assurance purposes
7. **Fairness and Reliability** applications of SHAP for assurance
8. **KernelSHAP** for explaining black-box models

## Prerequisites

- Basic Python programming
- Familiarity with scikit-learn style ML workflows
- No prior SHAP knowledge required

## Quick Start

### Option 1: Google Colab (Recommended)

Click the "Open in Colab" badge above to run the tutorial instantly in your browser.

### Option 2: Local Installation

```bash
# Create virtual environment
python -m venv shap-tutorial
source shap-tutorial/bin/activate  # On Windows: shap-tutorial\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Launch Jupyter
jupyter notebook shap-tutorial.ipynb
```

## Key Concepts Covered

- **Shapley values**: Fair attribution of predictions to features
- **Base value**: The average prediction that SHAP values are relative to
- **TreeSHAP**: Exact, fast algorithm for tree-based models
- **KernelSHAP**: Model-agnostic approximate algorithm for any black-box model
- **Stability testing**: Ensuring explanations are reliable across runs
- **Evidence artefacts**: Generating auditable documentation

## Assurance Focus

Unlike generic SHAP tutorials, this one specifically addresses:

- What claims SHAP can and cannot support
- How to test explanation stability (critical for audits)
- Generating structured evidence artefacts
- Documenting limitations appropriately
- The "Failed Audit" scenario - why stability matters
- Fairness assurance via subgroup SHAP comparison
- Reliability assurance via domain-informed feature ranking

## Files

- `shap-tutorial.ipynb` - Main tutorial notebook
- `requirements.txt` - Python dependencies
- `_resources.md` - Pre-fetched reference materials (developer scaffolding)

## Related Resources

- [SHAP Documentation](https://shap.readthedocs.io/)
- [TEA Techniques: SHAP](https://alan-turing-institute.github.io/tea-techniques/techniques/shapley-additive-explanations)
- [Yuan et al. (2022) - SHAP Stability Study](http://arxiv.org/abs/2204.11351)

## License

This tutorial is part of the [TEA Techniques](https://alan-turing-institute.github.io/tea-techniques/) project.
