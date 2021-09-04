# torrey-playground-lambda

The Lambda function that powers the [Torrey Playground](https://www.torrey.xyz/play/).

## Testing the Lambda function locally

### Prerequisite

In order to invoke the Lambda function locally for testing purposes, the [AWS Lambda Runtime Emulator](https://github.com/aws/aws-lambda-runtime-interface-emulator#installing) must be installed. To install the emulator, from within the `lambda/` directory, run:

```
curl -Lo ./aws-lambda-rie \
	https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie \
	&& chmod +x ./aws-lambda-rie
```

Once the emulator is installed, continue on with the following instructions to invoke the Lambda function.

### Invoking the Lambda function

From within the `lambda/` directory:

1. Build the Docker image using the current directory as the build context:

```
docker build -t matthewkosloski/torrey-playground-lambda .
```

2. Start up a container named `test1`, mapping guest port `8080` to host port `9000`:

This will run the container in an interactive mode. Any `console.log` statements in the handler code will show up in this window.

```
docker run --name test1 -p 9000:8080 matthewkosloski/torrey-playground-lambda:latest
```

3. Within a new terminal window, post data to the Lambda function using cURL:

```
curl --location --request POST 'http://localhost:9000/2015-03-31/functions/function/invocations' \
--header 'Content-Type: application/json' \
--data-raw '{
  "program": "(println (* 2 (+ 5 6)))",
  "options": {
    "semanticVersion": "3.0.2",
    "flags": []
  }
}'
```

4. Observe the output from the Lambda function:

```
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"stdout\":\"22\\n\",\"stderr\":\"\"}"
}
```