import { handler } from "../src/handlers/submit";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({}),
    }),
  },
  PutCommand: jest.fn(),
}));

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  SendMessageCommand: jest.fn(),
}));

describe("submitJob handler", () => {
  test("happy path: returns 202 with jobId", async () => {
    const event = {
      body: JSON.stringify({ type: "test-job" }),
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.jobId).toBeDefined();
  });
  test("missing type field: returns 400", async () => {
    const event = {
      body: JSON.stringify({ type: undefined }),
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Missing required field: type");
  });
  test("DynamoDB error thrown: returns 500", async () => {
    const event = {
      body: JSON.stringify({ type: "test-job" }),
    } as any;
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    const mockClient = DynamoDBDocumentClient.from.mock.results[0].value;
    mockClient.send.mockRejectedValueOnce(new Error("DynamoDB error"));
    const response = await handler(event);
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Internal server error");
  });
});
