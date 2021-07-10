# torrey-playground

The Torrey Playground (Work in Progress).

## Testing the lambda function locally

From within the `lambda/` directory:

1. Build the Docker image using the current directory as the build context:

```
docker build -t matthewkosloski/torrey-playground-lambda .
```

2. Start up a container named `test1`:

```
docker run --name test1 -d -v ~/.aws-lambda-rie:/aws-lambda -p 9000:8080 \
    --entrypoint /aws-lambda/aws-lambda-rie \
    matthewkosloski/torrey-playground-lambda:latest \
        /usr/local/bin/npx aws-lambda-ric app.handler
```

3. Post data to the lambda function using cURL:

```
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" -d \
    '{"program": "(println (* 6 7))"}'
```