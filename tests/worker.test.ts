import { handler } from "../src/handlers/worker";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({}),
    }),
  },
  GetCommand: jest.fn().mockImplementation((input) => ({ input })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const mockClient = DynamoDBDocumentClient.from.mock.results[0].value;

const sqsEvent = (jobId: string) =>
  ({
    Records: [{ body: JSON.stringify({ jobId, type: "test-job" }) }],
  }) as any;

const updatedStatuses = (): string[] =>
  mockClient.send.mock.calls
    .map(([command]: any) => command.input)
    .filter((input: any) => input.UpdateExpression)
    .map((input: any) => input.ExpressionAttributeValues[":status"]);

describe("worker handler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockClient.send.mockReset();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("happy path: moves a PENDING job to PROCESSING then COMPLETED", async () => {
    mockClient.send.mockResolvedValue({});
    mockClient.send.mockResolvedValueOnce({
      Item: { jobId: "123", status: "PENDING" },
    });
    const promise = handler(sqsEvent("123"));
    await jest.runAllTimersAsync();
    await promise;
    expect(updatedStatuses()).toEqual(["PROCESSING", "COMPLETED"]);
  });

  test("idempotency: already COMPLETED job is skipped", async () => {
    mockClient.send.mockResolvedValueOnce({
      Item: { jobId: "123", status: "COMPLETED" },
    });
    await handler(sqsEvent("123"));
    expect(mockClient.send).toHaveBeenCalledTimes(1);
    expect(updatedStatuses()).toEqual([]);
  });

  test("error path: DynamoDB failure rethrows so SQS retries", async () => {
    mockClient.send.mockRejectedValueOnce(new Error("DynamoDB error"));
    await expect(handler(sqsEvent("123"))).rejects.toThrow(
      "Unexpected error processing job",
    );
  });
});
