#!/usr/bin/env bash
# End-to-end smoke test against LocalStack: submit -> SQS -> worker -> status.
# API Gateway is a LocalStack Pro feature, so the Lambdas are invoked directly
# with HTTP API (v2) shaped events.
set -euo pipefail
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1
AWS="aws --endpoint-url http://localhost:4566"
TMP=$(mktemp -d)

invoke() { # <function> <json event> -> prints response body JSON
  rm -f "$TMP/out.json"
  $AWS lambda invoke --function-name "$1" --cli-binary-format raw-in-base64-out \
    --payload "$2" "$TMP/out.json" >/dev/null
  cat "$TMP/out.json"
}
field() { python3 -c "import sys,json;print(json.loads(json.load(sys.stdin)['body']).get('$1',''))"; }
code()  { python3 -c "import sys,json;print(json.load(sys.stdin)['statusCode'])"; }

echo "1. submit with valid body (expect 202)"
RES=$(invoke submit-lambda '{"body":"{\"type\":\"smoke-test\"}"}')
echo "$RES" | code
JOB_ID=$(echo "$RES" | field jobId)
echo "   jobId=$JOB_ID"

echo "2. submit with missing type (expect 400)"
invoke submit-lambda '{"body":"{}"}' | code

echo "3. status of unknown job (expect 404)"
invoke getJobStatus-lambda '{"pathParameters":{"jobId":"nope"}}' | code

echo "4. poll until COMPLETED (worker consumes the SQS message)"
for _ in $(seq 1 30); do
  STATUS=$(invoke getJobStatus-lambda "{\"pathParameters\":{\"jobId\":\"$JOB_ID\"}}" | field status)
  echo "   status=$STATUS"
  [ "$STATUS" = "COMPLETED" ] && { echo "PASS"; exit 0; }
  sleep 2
done
echo "FAIL: job did not complete"; exit 1
