import { SQSEvent } from "aws-lambda";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Must match maxReceiveCount on the queue's redrive policy (terraform/sqs.tf).
const MAX_RECEIVE_COUNT = 3;

const log = (
  level: "INFO" | "ERROR",
  message: string,
  fields: Record<string, unknown> = {},
): void => {
  const line = JSON.stringify({
    level,
    function: "worker.handler",
    message,
    ...fields,
  });
  if (level === "ERROR") console.error(line);
  else console.log(line);
};

const setStatus = async (
  jobId: string,
  status: string,
  allowedFrom: string[],
): Promise<void> => {
  const values: Record<string, string> = { ":status": status };
  allowedFrom.forEach((from, i) => (values[`:from${i}`] = from));
  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: { jobId },
      UpdateExpression: "SET #status = :status",
      ConditionExpression: `#status IN (${allowedFrom.map((_, i) => `:from${i}`).join(", ")})`,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: values,
    }),
  );
};

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    let jobId: string | undefined;
    try {
      ({ jobId } = JSON.parse(record.body));
      if (!jobId) {
        log("ERROR", "Message missing jobId, dropping", { body: record.body });
        continue;
      }

      const result = await dynamo.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { jobId },
        }),
      );
      const job = result.Item;
      if (!job) {
        log("ERROR", "Job not found", { jobId });
        continue;
      }
      // PROCESSING is deliberately NOT skipped: a redelivery of a message
      // whose earlier attempt crashed mid-flight must be retried.
      if (job.status === "COMPLETED" || job.status === "FAILED") {
        log("INFO", "Job already finished, skipping", {
          jobId,
          status: job.status,
        });
        continue;
      }

      await setStatus(jobId, "PROCESSING", ["PENDING", "PROCESSING"]);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await setStatus(jobId, "COMPLETED", ["PROCESSING"]);
      log("INFO", "Job completed successfully", { jobId });
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        log("INFO", "Job state changed concurrently, skipping", { jobId });
        continue;
      }
      log("ERROR", "Error processing request", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const receiveCount = Number(record.attributes?.ApproximateReceiveCount);
      if (jobId && receiveCount >= MAX_RECEIVE_COUNT) {
        // Last attempt: SQS will route the message to the DLQ next.
        await setStatus(jobId, "FAILED", ["PENDING", "PROCESSING"]).catch((e) =>
          log("ERROR", "Could not mark job FAILED", {
            jobId,
            error: e instanceof Error ? e.message : "Unknown error",
          }),
        );
      }
      throw new Error("Unexpected error processing job", { cause: error });
    }
  }
};
