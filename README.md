# AWS Job Status API

A serverless async job processing API built on AWS. Clients submit jobs via HTTP and poll for status — the system decouples submission from processing using SQS, with all state tracked in DynamoDB.

## Architecture

```
POST /jobs                          GET /jobs/{jobId}
     │                                      │
     ▼                                      ▼
API Gateway (HTTP)              API Gateway (HTTP)
     │                                      │
     ▼                                      ▼
submit Lambda                   getJobStatus Lambda
     │                                      │
     ├──► DynamoDB (status: PENDING)        ▼
     │                               DynamoDB (read)
     ▼
  SQS Queue
     │
     ▼ (event source mapping)
worker Lambda
     │
     ├──► DynamoDB (status: PROCESSING)
     ├──► ... do work ...
     └──► DynamoDB (status: COMPLETED)
          (on failure → DLQ after 3 attempts)
```

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

**Job status values:** `PENDING` → `PROCESSING` → `COMPLETED`

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
  submit.test.ts     # Jest unit tests for submit handler
```

## IAM Design

Each Lambda function has its own role scoped to only the permissions it requires:

| Function | DynamoDB | SQS |
|----------|----------|-----|
| submit | `PutItem` | `SendMessage` |
| worker | `GetItem`, `UpdateItem`, `PutItem` | `ReceiveMessage`, `DeleteMessage`, `GetQueueAttributes` |
| getJobStatus | `GetItem` | — |

## Error Handling

- Invalid requests return `400` with a descriptive message
- Jobs not found return `404`
- Worker failures are retried up to 3 times via SQS visibility timeout before routing to the DLQ
- A CloudWatch alarm fires when the DLQ receives any message
- All handlers emit structured JSON logs

## Deploy

**Prerequisites:** AWS CLI configured, Terraform >= 1.0, Node.js 22

```bash
# 1. Build Lambda zips
npm install
npm run build

# 2. Deploy infrastructure
cd terraform
terraform init
terraform apply
```
