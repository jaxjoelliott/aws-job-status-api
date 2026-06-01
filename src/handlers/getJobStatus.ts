import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const jobId = event.pathParameters?.jobId;
    if (!jobId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Missing required field: jobId" }),
      };
    }
    console.log(
      JSON.stringify({
        level: "INFO",
        function: "getJobStatus.handler",
        message: "Request received",
        input: { jobId },
      }),
    );
    const result = await dynamo.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { jobId },
      }),
    );
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Job not found" }),
      };
    }
    console.log(
      JSON.stringify({
        level: "INFO",
        function: "getJobStatus.handler",
        message: "Job status retrieved successfully",
        input: { jobId },
      }),
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId: result.Item.jobId,
        status: result.Item.status,
        type: result.Item.type,
        createdAt: result.Item.createdAt,
      }),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        function: "getJobStatus.handler",
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
