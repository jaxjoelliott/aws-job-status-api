// add structured logging

import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: SQSEvent): Promise<void> => {
  try {
    for (const record of event.Records) {
      const messageBody = JSON.parse(record.body);
      const { jobId } = messageBody;
      const result = await dynamo.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { jobId },
        }),
      );
      const job = result.Item;
      if (!job) {
        console.error(
          JSON.stringify({
            level: "ERROR",
            function: "worker.handler",
            message: "Job not found",
            jobId,
          }),
        );
        continue;
      }
      if (job?.status === "COMPLETED" || job?.status === "PROCESSING") {
        console.log(
          JSON.stringify({
            level: "INFO",
            function: "worker.handler",
            message: "Job already processed or in progress, skipping",
            jobId: jobId,
            status: job?.status,
          }),
        );
        continue;
      }

      await dynamo.send(
        new UpdateCommand({
          TableName: process.env.TABLE_NAME,
          Key: { jobId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "PROCESSING" },
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await dynamo.send(
        new UpdateCommand({
          TableName: process.env.TABLE_NAME,
          Key: { jobId },
          UpdateExpression: "SET #status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": "COMPLETED" },
        }),
      );
      console.log(
        JSON.stringify({
          level: "INFO",
          function: "worker.handler",
          message: "Job completed successfully",
          jobId: jobId,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        function: "worker.handler",
        message: "Error processing request",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    throw Error("Unexpected error processing job");
  }
};
