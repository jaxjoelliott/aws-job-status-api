# AWS Job Status API

A serverless async job processing API built on AWS. Clients submit jobs via HTTP and poll for status — the system decouples submission from processing using SQS, with all state tracked in DynamoDB.

## Problem

Long-running work shouldn't block an HTTP request. This service accepts a job, returns immediately with a `jobId`, processes the job in the background, and lets the client poll for its status. SQS decouples submission from processing, so spikes are buffered and failures are retried automatically.

## Architecture

```mermaid
flowchart LR
    Client([Client])
    POST["POST /jobs"] --> Submit["submit Lambda"]
    GET["GET /jobs/{jobId}"] --> Status["getJobStatus Lambda"]
    Client --> POST
    Client --> GET
    Submit -->|PENDING| DB[("DynamoDB")]
    Submit --> Queue[["SQS Queue"]]
    Queue --> Worker["worker Lambda"]
    Worker -->|PROCESSING → COMPLETED| DB
    Status --> DB
    Queue -.->|3 failed receives| DLQ[["DLQ"]]
    DLQ -.-> Alarm["CloudWatch Alarm"]
```

See [docs/architecture-diagram.md](docs/architecture-diagram.md) for the full diagram and request sequence, and [docs/architecture.md](docs/architecture.md) for the original design notes.

## Tech Stack

- **Runtime**: Node.js 22 / TypeScript
- **Compute**: AWS Lambda (3 functions)
- **Queue**: Amazon SQS with Dead Letter Queue
- **Database**: Amazon DynamoDB (on-demand)
- **API**: Amazon API Gateway v2 (HTTP API)
- **Observability**: CloudWatch alarm on DLQ depth
- **IaC**: Terraform (remote state in S3)

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/jobs` | Submit a new job. Returns `202` with a `jobId`. |
| `GET` | `/jobs/{jobId}` | Poll job status. Returns `jobId`, `status`, `type`, `createdAt`. |

**Submit request body:**
```json
{ "type": "your-job-type" }
```

**Job status values:** `PENDING` → `PROCESSING` → `COMPLETED` (or `FAILED` if all 3 processing attempts fail)

**Poll response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "type": "your-job-type",
  "createdAt": "2026-06-05T12:00:00.000Z"
}
```

## Project Structure

```
src/handlers/
  submit.ts          # POST /jobs — writes to DynamoDB + SQS
  worker.ts          # SQS consumer — processes jobs, updates status
  getJobStatus.ts    # GET /jobs/{jobId} — reads from DynamoDB
terraform/
  main.tf            # Provider + S3 backend config
  api_gateway.tf     # HTTP API + routes + integrations
  lambda.tf          # Lambda functions + SQS event source mapping
  dynamodb.tf        # Jobs table (PAY_PER_REQUEST)
  sqs.tf             # Main queue + DLQ with redrive policy (maxReceiveCount=3)
  iam.tf             # Per-function least-privilege roles + policies
  cloudwatch.tf      # DLQ depth alarm
tests/
  submit.test.ts         # Jest unit tests for submit handler
  getJobStatus.test.ts   # Jest unit tests for getJobStatus handler
  worker.test.ts         # Jest unit tests for worker handler
scripts/
  localstack-deploy.sh   # Deploy the stack to LocalStack
  localstack-smoke.sh    # End-to-end smoke test against LocalStack
docker-compose.yml       # LocalStack
docs/
  architecture-diagram.md  # Mermaid architecture + sequence diagrams
  architecture.md          # Design notes
.github/workflows/ci.yml   # Lint, build, test on every push
```

## IAM Design

Each Lambda function has its own role scoped to only the permissions it requires:

| Function | DynamoDB | SQS |
|----------|----------|-----|
| submit | `PutItem`, `DeleteItem` | `SendMessage` |
| worker | `GetItem`, `UpdateItem`, `PutItem` | `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` |
| getJobStatus | `GetItem` | — |

## Error Handling

- Invalid requests return `400` with a descriptive message (missing `type` or malformed JSON on submit, missing `jobId` on poll)
- If queueing fails after the job is written, `submit` deletes the job and returns `500`, so no orphaned `PENDING` jobs are left behind
- Jobs not found return `404`
- Worker status updates are conditional, and finished jobs (`COMPLETED`/`FAILED`) are skipped on redelivery
- A job left in `PROCESSING` by a crashed attempt is retried on redelivery, not skipped
- Worker failures are retried up to 3 times (queue visibility timeout 180s) before routing to the DLQ; on the final attempt the job is marked `FAILED`
- A CloudWatch alarm fires when the DLQ receives any message and publishes to an SNS topic (set `alarm_email` to subscribe an address)
- All handlers emit structured JSON logs

## Local Development

```bash
npm install
npm run lint     # ESLint
npm run build    # tsc + zip Lambda bundles into lambda/
npm test         # Jest unit tests (AWS SDK clients are mocked)
```

CI (`.github/workflows/ci.yml`) runs lint, build, and test on every push and pull request.

## Run Locally with LocalStack (no AWS account needed)

Requires Docker and the AWS CLI.

```bash
./scripts/localstack-deploy.sh   # builds, starts LocalStack, applies Terraform to it
./scripts/localstack-smoke.sh    # submit -> SQS -> worker -> COMPLETED end to end
docker compose down              # tear down
```

Notes:
- Uses the free community image (`localstack/localstack:4.14`). Newer LocalStack images require an account token.
- API Gateway HTTP APIs (apigatewayv2) are a LocalStack Pro feature, so with `use_localstack=true` the API Gateway resources are skipped and the smoke test invokes the Lambdas directly with HTTP API-shaped events. Everything else (Lambda, SQS + DLQ redrive, DynamoDB, IAM, SNS, CloudWatch) is created from the same Terraform used for real AWS.
- The deploy script works in a throwaway `terraform-local/` copy that swaps the S3 backend for local state.

## Deploy

**Prerequisites:** AWS CLI configured, Terraform >= 1.0, Node.js 22

```bash
# 1. Build Lambda zips
npm install
npm run build

# 2. Deploy infrastructure
cd terraform
terraform init
terraform apply -var alarm_email=you@example.com   # alarm_email is optional
```
