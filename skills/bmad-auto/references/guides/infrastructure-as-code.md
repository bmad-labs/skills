# Infrastructure as Code — Functional Validation Guide

## Scope

This guide covers validation for infrastructure-as-code projects: Terraform, Pulumi, AWS CDK,
CloudFormation, Ansible. The native-first principle applies: use locally installed tools when
available, fall back to Docker containers when tools are not installed or version conflicts exist.

**IMPORTANT:** Never run `terraform apply`, `pulumi up`, `cdk deploy`, or any command that
creates real cloud resources. Validation is limited to syntax checking, planning (dry-run),
and linting.

## Native Tool Validation (Primary)

### Check Tool Availability

```bash
command -v terraform && echo "Terraform: $(terraform version -json | head -1)"
command -v pulumi && echo "Pulumi: $(pulumi version)"
command -v cdk && echo "CDK: $(cdk --version)"
command -v tflint && echo "tflint: available"
command -v checkov && echo "checkov: available"
command -v ansible-lint && echo "ansible-lint: available"
```

### Terraform (native)

```bash
terraform init -backend=false
terraform validate
terraform fmt -check -recursive
terraform plan  # Only if credentials are available
```

### Pulumi (native)

```bash
pulumi preview --non-interactive
```

### CDK (native)

```bash
npm ci
npx cdk synth
npx cdk diff  # If stack exists
```

### Ansible (native)

```bash
ansible-lint playbooks/
ansible-playbook --check -i inventory playbooks/main.yml  # Dry-run
```

## Docker Fallback (if native tools not installed)

### Terraform in Docker

```bash
# Initialize
docker run --rm -v "$(pwd)":/workspace -w /workspace hashicorp/terraform:latest \
  init -backend=false

# Validate syntax
docker run --rm -v "$(pwd)":/workspace -w /workspace hashicorp/terraform:latest \
  validate

# Format check
docker run --rm -v "$(pwd)":/workspace -w /workspace hashicorp/terraform:latest \
  fmt -check -recursive

# Plan (requires credentials — may need to skip)
docker run --rm -v "$(pwd)":/workspace -w /workspace \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  hashicorp/terraform:latest plan -no-color
```

### Terraform Linting in Docker

```bash
# tflint
docker run --rm -v "$(pwd)":/data -w /data ghcr.io/terraform-linters/tflint:latest

# checkov (security scanning)
docker run --rm -v "$(pwd)":/tf -w /tf bridgecrew/checkov:latest -d .
```

### Pulumi in Docker

```bash
docker run --rm -v "$(pwd)":/workspace -w /workspace pulumi/pulumi:latest \
  bash -c "pulumi login --local && pulumi preview --non-interactive --stack dev"
```

### AWS CDK in Docker

```bash
docker run --rm -v "$(pwd)":/app -w /app node:20 \
  bash -c "npm ci && npx cdk synth"
```

### CloudFormation in Docker

```bash
docker run --rm -v "$(pwd)":/templates -w /templates \
  cfn-lint:latest cfn-lint /templates/*.yaml
```

## Validation Priority

1. **Native tools** → full validation including plan/preview with locally installed tools
2. **Docker** → fallback if native tools not installed
3. **Syntax-only** → if neither available, at least check YAML/HCL syntax

## Missing Tool Suggestions

```
SUGGESTION: For IaC validation:
  Native install (preferred):
    - Terraform: https://terraform.io/downloads
    - tflint: https://github.com/terraform-linters/tflint
    - checkov: pip install checkov

  Docker fallback:
    - docker run hashicorp/terraform validate
    - docker run ghcr.io/terraform-linters/tflint
    - docker run bridgecrew/checkov -d .
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Method: [Docker|Native]
- Syntax validation: [OK|FAILED]
- Format check: [OK|FAILED|SKIPPED]
- Lint: [OK|SKIPPED|FAILED] (tool used)
- Security scan: [OK|SKIPPED|FAILED] (checkov)
- Plan/Preview: [OK|SKIPPED|FAILED] (requires credentials)
- Missing tools: [list if any]
```
