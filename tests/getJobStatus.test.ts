import { handler } from "../src/handlers/getJobStatus";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({}),
    }),
  },
  GetCommand: jest.fn(),
}));

describe("getJobStatus handler", () => {
  test("happy path: returns 200 with job status", async () => {
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    const mockClient = DynamoDBDocumentClient.from.mock.results[0].value;
    mockClient.send.mockResolvedValueOnce({
      Item: {
        jobId: "123",
        status: "COMPLETED",
        type: "test-job",
        createdAt: "2026-06-01",
      },
    });
    const event = {
      pathParameters: { jobId: "123" },
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body as string);
    expect(body.status).toBe("COMPLETED");
  });
  test("missing jobId returns 400", async () => {
    const event = {
      pathParameters: { jobId: undefined },
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body as string);
    expect(body.message).toBe("Missing required field: jobId");
  });
  test("job not found returns 404", async () => {
    const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
    const mockClient = DynamoDBDocumentClient.from.mock.results[0].value;
    mockClient.send.mockResolvedValueOnce({});
    const event = {
      pathParameters: { jobId: "does-not-exist" },
    } as any;
    const response = await handler(event);
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body as string);
    expect(body.message).toBe("Job not found");
  });
});
