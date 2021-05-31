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

FROM node:12-buster as build-image

# Include args in this stage of the build.
ARG FUNCTION_DIR
ARG BASE_TEMP_DIR
ARG COMPILER_DIR

# Install aws-lambda-cpp build dependencies and
# download the compilers to a temporary directory.
RUN apt-get update \
  && apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  wget \
  && mkdir -p ${FUNCTION_DIR} \
  && mkdir ${BASE_TEMP_DIR} \
  && mkdir ${COMPILER_DIR} \
  && cd ${COMPILER_DIR} \
  && for i in "1.0.1" "2.0.1" "3.0.0"; do \
  mkdir "$i" \
  && cd ./"$i" \
  && wget https://github.com/MatthewKosloski/torrey/releases/download/"$i"/torreyc-"$i".zip \
  && unzip *.zip \
  && rm -rf *.zip \
  && chmod o+x torreyc-"$i".jar \
  && cd ../; done

# Copy the function code from the build context
# into the container.
COPY func/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

RUN npm install aws-lambda-ric && npm install

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

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]