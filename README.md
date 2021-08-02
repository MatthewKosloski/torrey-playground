# torrey-playground-lambda

The Lambda function that powers the [Torrey Playground](https://www.torrey.xyz/play/).

## Testing the Lambda function locally

From within the `lambda/` directory:

1. Build the Docker image using the current directory as the build context:

```
docker build -t matthewkosloski/torrey-playground-lambda .
```

2. Start up a container named `test1`:

```
s docker run --name test1 -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
    --entrypoint /aws-lambda/aws-lambda-rie \
    matthewkosloski/torrey-playground-lambda:latest \
        /usr/local/bin/npx aws-lambda-ric app.handler
```

3. Post data to the lambda function using cURL:

```
curl --location --request POST 'http://localhost:9000/2015-03-31/functions/function/invocations' \
--header 'Content-Type: application/json' \
--data-raw '{
    "program": "(println (* 2 (+ 5 6)))",
    "options": {
        "semanticVersion": "3.0.0",
        "flags": ["-ir"]
    }
}'
```

4. Observe the output from the lambda function:

```
{"statusCode":200,"headers":{"Content-Type":"application/json"},"body":"{\"stdout\":\"42\\n\",\"stderr\":\"\"}"}
```

5. When testing is complete, stop the running container to free up resources:

```
docker stop test1
```