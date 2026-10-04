import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid JSON body" }),
      };
    }
    if (!body || !body.type) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required field: type" }),
      };
    }
    console.log(
      JSON.stringify({
        level: "INFO",
        function: "submit.handler",
        message: "Request received",
        input: body,
      }),
    );
    const id = crypto.randomUUID();
    await dynamo.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          jobId: id,
          status: "PENDING",
          type: body.type,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.QUEUE_URL,
          MessageBody: JSON.stringify({ jobId: id, type: body.type }),
        }),
      );
    } catch (sqsError) {
      // Don't leave an orphaned PENDING job nobody will ever process.
      await dynamo
        .send(
          new DeleteCommand({
            TableName: process.env.TABLE_NAME,
            Key: { jobId: id },
          }),
        )
        .catch((e) =>
          console.error(
            JSON.stringify({
              level: "ERROR",
              function: "submit.handler",
              message: "Failed to clean up job after SQS error",
              jobId: id,
              error: e instanceof Error ? e.message : "Unknown error",
            }),
          ),
        );
      throw sqsError;
    }
    console.log(
      JSON.stringify({
        level: "INFO",
        function: "submit.handler",
        message: "Job queued successfully",
        jobId: id,
      }),
    );
    return {
      statusCode: 202,
      body: JSON.stringify({
        message: "Job submitted successfully",
        jobId: id,
      }),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        function: "submit.handler",
        message: "Error processing request",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
