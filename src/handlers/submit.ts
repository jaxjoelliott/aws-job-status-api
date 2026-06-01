import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
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
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify({ jobId: id, type: body.type }),
      }),
    );
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
