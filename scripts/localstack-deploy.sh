#!/usr/bin/env bash
# Deploys the Terraform stack to LocalStack (no AWS account needed).
# Works in a throwaway copy (terraform-local/) that swaps the S3 backend for local state.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
docker compose down -v   # fresh container so state matches the new Terraform state
docker compose up -d
until curl -sf localhost:4566/_localstack/health >/dev/null; do sleep 2; done

rm -rf terraform-local && mkdir terraform-local
cp terraform/*.tf terraform/.terraform.lock.hcl terraform-local/
cat > terraform-local/backend_override.tf <<'TF'
terraform {
  backend "local" {}
}
TF

cd terraform-local
terraform init -input=false
terraform apply -auto-approve -input=false -var use_localstack=true
