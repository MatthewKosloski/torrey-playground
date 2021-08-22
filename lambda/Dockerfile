# Define a custom function directory
# for the handler code.
ARG FUNCTION_DIR="/function"

# Define a custom temp directory
# at which the compilers will be
# downloaded.
ARG BASE_TEMP_DIR="/tmp2"

# Define the temporary directory
# to which the compilers will be
# installed.
ARG COMPILER_DIR="$BASE_TEMP_DIR/compilers"

# The directory that contains the lambda
# function's handler.
ARG LAMBDA_HANDLER_DIR="/func"

# The path to the lambda function's config file. 
ARG CONFIG_FILE_PATH="config.json"

FROM node:12-buster as build-image

# Include args in this stage of the build.
ARG FUNCTION_DIR
ARG BASE_TEMP_DIR
ARG COMPILER_DIR
ARG LAMBDA_HANDLER_DIR
ARG CONFIG_FILE_PATH

# Change shell from sh to bash
SHELL ["/bin/bash", "-c"]

# Copy the config file into the image's file system.
COPY ${CONFIG_FILE_PATH} /

# Install aws-lambda-cpp build dependencies.
RUN apt-get update \
  && apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  wget \
  jq

# Download the compilers to a temporary directory.
RUN declare -a versions=($(jq -r '.[0] | .supportedSemanticVersions | join(" ")' ${CONFIG_FILE_PATH})) \
  && mkdir -p ${FUNCTION_DIR} \
  && mkdir ${BASE_TEMP_DIR} \
  && mkdir ${COMPILER_DIR} \
  && cd ${COMPILER_DIR} \
  && for version in ${versions[@]}; do \
  mkdir "$version" \
  && cd ./"$version" \
  && wget https://github.com/MatthewKosloski/torrey/releases/download/"$version"/torreyc-"$version".zip \
  && unzip *.zip \
  && rm -rf *.zip \
  && chmod o+x torreyc-"$version".jar \
  && cd ../; done

# Copy the function code from the build context
# into the image's file system.
COPY ${LAMBDA_HANDLER_DIR}/ ${FUNCTION_DIR}

# Copy the config file into the image's file system.
COPY ${CONFIG_FILE_PATH} ${FUNCTION_DIR}

# Copy the entrypoint script into the image's file system.
COPY ./entry_script.sh ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

RUN npm install jsonschema aws-lambda-ric && npm install

# Grab a fresh slim copy of the image to reduce the final size.
FROM node:12-buster-slim

# Include args in this stage of the build.
ARG FUNCTION_DIR
ARG BASE_TEMP_DIR
ARG COMPILER_DIR

# Install the compiler dependencies.
RUN apt-get update && \
  mkdir -p /usr/share/man/man1 && \
  apt-get install -y \
  gcc \
  openjdk-11-jdk

# Copy in the handler code.
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

# Copy in the compilers.
COPY --from=build-image ${COMPILER_DIR} ${COMPILER_DIR}

# Set working directory to the root directory
# containing the handler code.
WORKDIR ${FUNCTION_DIR}

ADD aws-lambda-rie /usr/local/bin/aws-lambda-rie 
ENTRYPOINT [ "./entry_script.sh" ]
CMD [ "app.handler" ]