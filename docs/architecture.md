1. What are the exact components? List every AWS resource you'll need - Lambda, DynamoDB, IAM, API Gateway, SQS, CloudWatch, S3
2. What is the data flow step by step from HTTP request to final job completion? - Submit: HTTP Request > API Gateway > Lambda > SQS > Worker Lambda > DynamoDB - Status: HTTP Request >API Gateway > Lambda > DynamoDB > response to client
3. What happens if the worker Lambda throws an error mid-processing? - Request stays in queue until 3 errors are thrown then it is sent to dead letter queue.
4. What goes in DynamoDB? What's the partition key, what attributes does a job record need? - Pending, processing, completed, and failed. ID is partition key.
5. What does "done" look like? What's the success state a client would receive? - Job ID, status, and created timestamp.
