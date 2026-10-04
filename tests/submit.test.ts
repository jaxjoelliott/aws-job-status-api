import { handler } from "../src/handlers/submit";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({}),
    }),
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const mockSqsSend = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => mockSqsSend(...args),
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
    const body = JSON.parse(response.body as string);
    expect(body.jobId).toBeDefined();
  });
  test("missing type field: returns 400", async () => {
    const event = {
      body: JSON.stringify({ type: undefined }),
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body as string);
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
    const body = JSON.parse(response.body as string);
    expect(body.message).toBe("Internal server error");
  });
  test("malformed JSON body: returns 400", async () => {
    const response = await handler({ body: "{not json" } as any);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body as string).message).toBe(
      "Invalid JSON body",
    );
  });
  test("SQS error: returns 500 and deletes the orphaned job", async () => {
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    const mockClient = DynamoDBDocumentClient.from.mock.results[0].value;
    mockClient.send.mockClear();
    mockSqsSend.mockRejectedValueOnce(new Error("SQS error"));
    const response = await handler({
      body: JSON.stringify({ type: "test-job" }),
    } as any);
    expect(response.statusCode).toBe(500);
    const inputs = mockClient.send.mock.calls.map(([c]: any) => c.input);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].Item.status).toBe("PENDING");
    expect(inputs[1].Key.jobId).toBe(inputs[0].Item.jobId);
  });
});
