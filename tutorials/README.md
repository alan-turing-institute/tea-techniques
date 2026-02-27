# TEA Techniques - Interactive Tutorials

Hands-on Jupyter notebook tutorials that help you understand how AI assurance techniques work and how to use them to generate evidence for assurance cases.

## Available Tutorials

| Assurance Goal | Technique | Status | Colab |
|----------------|-----------|--------|-------|
| Explainability | [SHAP](notebooks/shap/) | Draft | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/alan-turing-institute/tea-techniques/blob/main/tutorials/notebooks/shap/shap-tutorial.ipynb) |
| Transparency | [LIME](notebooks/lime/) | Planned | - |
| Privacy | [Differential Privacy](notebooks/differential-privacy/) | Planned | - |
| Reliability | [Conformal Prediction](notebooks/conformal-prediction/) | Planned | - |
| Safety | [Hallucination Detection](notebooks/hallucination-detection/) | Planned | - |
| Security | [Prompt Injection Testing](notebooks/prompt-injection-testing/) | Planned | - |
| Fairness | [Bootstrapping](notebooks/bootstrapping/) | Planned | - |

## Tutorial Structure

Each tutorial follows a consistent structure:

1. **Overview** - What the technique does and when to use it
2. **Prerequisites** - Required knowledge, packages, and datasets
3. **How It Works** - Core methodology with visual explanations
4. **Hands-On Implementation** - Setup, basic usage, interpreting results
5. **Generating Assurance Evidence** - How outputs support assurance claims
6. **Going Further** - Advanced configurations and related techniques
7. **Reflective Questions** - Conceptual understanding checks

## Running Tutorials

### Google Colab (Recommended)

Click the "Open in Colab" badge on any tutorial to run it instantly in your browser with no setup required.

### Local Installation

```bash
# Clone the repository
git clone https://github.com/alan-turing-institute/tea-techniques.git
cd tea-techniques/tutorials

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies for a specific tutorial
pip install -r notebooks/shap/requirements.txt

# Launch Jupyter
jupyter notebook notebooks/shap/shap-tutorial.ipynb
```

## Directory Structure

```
tutorials/
├── notebooks/           # Jupyter notebooks by technique
│   ├── shap/
│   │   ├── shap-tutorial.ipynb
│   │   └── requirements.txt
│   ├── lime/
│   └── ...
├── assets/
│   ├── images/         # Shared images and diagrams
│   └── data/           # Shared datasets
└── README.md
```

## Contributing

We welcome contributions! If you'd like to improve an existing tutorial or suggest a new one:

1. Open an issue describing your proposed changes
2. Fork the repository
3. Create your tutorial following the [template](notebooks/_template/)
4. Submit a pull request

## License

These tutorials are part of the TEA Techniques project and are licensed under the MIT License.
