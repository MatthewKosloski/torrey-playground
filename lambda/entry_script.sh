#!/bin/sh
if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
	# The AWS_LAMBDA_RUNTIME_API env var is not present,
	# so run the runtime interface emulator.
  exec /usr/local/bin/aws-lambda-rie /usr/local/bin/npx aws-lambda-ric $@
else
	# The AWS_LAMBDA_RUNTIME_API env var is indeed present,
	# so run the runtime interface client.
  exec /usr/local/bin/npx aws-lambda-ric $@
fi