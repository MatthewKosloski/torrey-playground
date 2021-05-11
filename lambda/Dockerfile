# Define custom function directory
ARG FUNCTION_DIR="/function"

FROM node:12-buster as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install aws-lambda-cpp build dependencies
RUN apt-get update && \
  apt-get install -y \
  g++ \
  make \
  cmake \
  unzip \
  libcurl4-openssl-dev \
  wget

# Create function directory
RUN mkdir -p ${FUNCTION_DIR}

# Copy function code from build context
# into container at ${FUNCTION_DIR}
COPY func/* ${FUNCTION_DIR}

WORKDIR ${FUNCTION_DIR}

# Download the compilers.
RUN for i in "1.0.1" "2.0.1" "3.0.0"; do \
  mkdir "$i" \
  && chown 5000 "$i" \
  && cd ./"$i" \
  && wget https://github.com/MatthewKosloski/torrey/releases/download/"$i"/torreyc-"$i".zip \
  && unzip torreyc-"$i".zip \
  && rm -rf torreyc-"$i".zip \
  && cd ../; done

# If the dependency is not in package.json uncomment the following line
RUN npm install aws-lambda-ric

RUN npm install

# Grab a fresh slim copy of the image to reduce the final size
FROM node:12-buster-slim

# Include global arg in this stage of the build
ARG FUNCTION_DIR

# Install compiler dependencies and create
# function directory with owner 5000
RUN apt-get update && \
  mkdir -p /usr/share/man/man1 && \
  apt-get install -y \
  gcc \
  openjdk-11-jdk

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

# Create a non-root user
USER 5000

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]