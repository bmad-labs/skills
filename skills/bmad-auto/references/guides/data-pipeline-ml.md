# Data Pipeline / ML — Functional Validation Guide

## Scope

This guide covers validation for machine learning projects and data pipelines. Common tools:
PyTorch, TensorFlow, scikit-learn, DVC, Airflow, Spark, dbt. The native-first principle applies:
use locally installed Python tools when available, fall back to Docker containers when tools are
not installed or complex dependency conflicts exist (CUDA, specific library versions, etc.).

## Native Tool Validation (Primary)

### Check Tool Availability

```bash
command -v python3 && echo "Python: $(python3 --version)"
command -v pip && echo "pip: available"
command -v poetry && echo "Poetry: available"
command -v conda && echo "Conda: available"
command -v dvc && echo "DVC: available"
command -v airflow && echo "Airflow: available"
```

### Step 1: Install Dependencies

```bash
# Detect package manager
if [ -f "poetry.lock" ]; then poetry install
elif [ -f "Pipfile.lock" ]; then pipenv install
elif [ -f "requirements.txt" ]; then pip install -r requirements.txt
elif [ -f "pyproject.toml" ]; then pip install -e .
fi
```

### Step 2: Lint and Type Check

```bash
# Ruff (fast linter)
ruff check . 2>/dev/null || echo "ruff not available"

# Flake8
flake8 . 2>/dev/null || echo "flake8 not available"

# MyPy
mypy . 2>/dev/null || echo "mypy not available"
```

### Step 3: Run Tests

```bash
pytest -v
```

### Step 4: Pipeline Dry-Run

```bash
# DVC
dvc repro --dry 2>/dev/null && echo "DVC pipeline: valid"

# Airflow DAG validation
airflow dags test <dag_id> 2024-01-01 2>/dev/null && echo "Airflow DAG: valid"

# dbt
dbt compile 2>/dev/null && echo "dbt: compiles"
```

### Step 5: Model Inference Smoke Test

If sample data exists:
```bash
# Run prediction script with sample input
python -c "
from model import load_model, predict
model = load_model('model.pkl')
result = predict(model, sample_input)
print(f'Inference: OK, output shape: {result.shape}')
" 2>/dev/null || echo "Model inference: skipped (no model.pkl or predict function)"
```

### Step 6: Output Format Verification

```bash
# Check that pipeline outputs exist and have expected format
if [ -d "output/" ]; then
  ls -la output/
  # Verify CSV/Parquet headers
  head -1 output/*.csv 2>/dev/null
fi
```

## Docker Fallback (if native tools not installed or complex deps)

### Using Project Dockerfile

Most ML projects have a Dockerfile. Use it when native setup is problematic:
```bash
docker build -t ml-validation .
docker run --rm ml-validation pytest
```

### Standard ML Images

If no Dockerfile exists, use standard images:

```bash
# PyTorch
docker run --rm -v "$(pwd)":/app -w /app pytorch/pytorch:latest \
  bash -c "pip install -r requirements.txt && pytest"

# TensorFlow
docker run --rm -v "$(pwd)":/app -w /app tensorflow/tensorflow:latest \
  bash -c "pip install -r requirements.txt && pytest"

# General Python ML
docker run --rm -v "$(pwd)":/app -w /app jupyter/scipy-notebook:latest \
  bash -c "pip install -r requirements.txt && pytest"
```

### DVC Pipeline in Docker

```bash
docker run --rm -v "$(pwd)":/app -w /app python:3.11 \
  bash -c "pip install dvc && dvc repro --dry"
```

## Validation Priority

1. **Native Python** → install deps + tests + lint with locally installed tools
2. **Docker** (project Dockerfile or standard ML image) → fallback if native tools not installed
3. **Syntax-only** → if neither available, at least check Python imports work

## Missing Tool Suggestions

```
SUGGESTION: For ML validation:
  Native (preferred):
    - Python: https://python.org
    - Poetry: pip install poetry
    - DVC: pip install dvc
    - Ruff: pip install ruff

  Docker fallback:
    - docker build -t ml-test . && docker run --rm ml-test pytest
    - Or: docker run pytorch/pytorch pip install -r requirements.txt && pytest
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Method: [Docker|Native]
- Dependencies: [OK|FAILED]
- Lint: [OK|SKIPPED|WARNINGS]
- Tests: [OK|SKIPPED|FAILED] (X passed, Y failed)
- Pipeline: [OK|SKIPPED|N/A] (DVC/Airflow/dbt)
- Model inference: [OK|SKIPPED|N/A]
- Missing tools: [list if any]
```
