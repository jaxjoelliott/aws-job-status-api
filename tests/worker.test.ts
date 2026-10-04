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

const sqsEvent = (jobId: string, receiveCount = 1) =>
  ({
    Records: [
      {
        body: JSON.stringify({ jobId, type: "test-job" }),
        attributes: { ApproximateReceiveCount: String(receiveCount) },
      },
    ],
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

  test("redelivery: a job left in PROCESSING is retried, not skipped", async () => {
    mockClient.send.mockResolvedValue({});
    mockClient.send.mockResolvedValueOnce({
      Item: { jobId: "123", status: "PROCESSING" },
    });
    const promise = handler(sqsEvent("123", 2));
    await jest.runAllTimersAsync();
    await promise;
    expect(updatedStatuses()).toEqual(["PROCESSING", "COMPLETED"]);
  });

  test("updates are conditional so a finished job is never overwritten", async () => {
    mockClient.send.mockResolvedValue({});
    mockClient.send.mockResolvedValueOnce({
      Item: { jobId: "123", status: "PENDING" },
    });
    const promise = handler(sqsEvent("123"));
    await jest.runAllTimersAsync();
    await promise;
    const updates = mockClient.send.mock.calls
      .map(([c]: any) => c.input)
      .filter((i: any) => i.UpdateExpression);
    expect(updates.every((u: any) => u.ConditionExpression)).toBe(true);
  });

  test("concurrent state change (conditional check fails) is skipped without error", async () => {
    const {
      ConditionalCheckFailedException,
    } = require("@aws-sdk/client-dynamodb");
    mockClient.send
      .mockResolvedValueOnce({ Item: { jobId: "123", status: "PENDING" } })
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({ message: "x", $metadata: {} }),
      );
    await expect(handler(sqsEvent("123"))).resolves.toBeUndefined();
  });

  test("final failed attempt marks the job FAILED before rethrowing", async () => {
    mockClient.send
      .mockResolvedValueOnce({ Item: { jobId: "123", status: "PROCESSING" } })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({});
    await expect(handler(sqsEvent("123", 3))).rejects.toThrow(
      "Unexpected error processing job",
    );
    expect(updatedStatuses()).toEqual(["PROCESSING", "FAILED"]);
  });

  test("non-final failure does not mark the job FAILED", async () => {
    mockClient.send
      .mockResolvedValueOnce({ Item: { jobId: "123", status: "PENDING" } })
      .mockRejectedValueOnce(new Error("boom"));
    await expect(handler(sqsEvent("123", 1))).rejects.toThrow();
    expect(updatedStatuses()).toEqual(["PROCESSING"]);
  });
});
