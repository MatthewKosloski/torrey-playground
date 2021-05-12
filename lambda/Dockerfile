# Define custom function directory
ARG FUNCTION_DIR="/function"
ARG TEMP_DIR="/tmp2"

FROM node:12-buster as build-image

# Include global arg in this stage of the build
ARG FUNCTION_DIR
ARG TEMP_DIR

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

# Download the compilers to a compilers
# folder within the temp directory.
RUN mkdir ${TEMP_DIR} \
  && mkdir ${TEMP_DIR}/compilers \
  && cd ${TEMP_DIR}/compilers \
  && for i in "1.0.1" "2.0.1" "3.0.0"; do \
  mkdir "$i" \
  && cd ./"$i" \
  && wget https://github.com/MatthewKosloski/torrey/releases/download/"$i"/torreyc-"$i".zip \
  && unzip *.zip \
  && rm -rf *.zip \
  && chmod o+x torreyc-"$i".jar \
  && cd ../; done

WORKDIR ${FUNCTION_DIR}

# If the dependency is not in package.json uncomment the following line
RUN npm install aws-lambda-ric

RUN npm install

# Grab a fresh slim copy of the image to reduce the final size
FROM node:12-buster-slim

# Include global arg in this stage of the build
ARG FUNCTION_DIR
ARG TEMP_DIR

# Install compiler dependencies and create
# function directory with owner 5000
RUN apt-get update && \
  mkdir -p /usr/share/man/man1 && \
  apt-get install -y \
  gcc \
  openjdk-11-jdk

# Copy in the built dependencies
COPY --from=build-image ${FUNCTION_DIR} ${FUNCTION_DIR}

# Copy in the compilers.
COPY --from=build-image ${TEMP_DIR}/compilers ${TEMP_DIR}/compilers

# Set working directory to function root directory
WORKDIR ${FUNCTION_DIR}

ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["app.handler"]