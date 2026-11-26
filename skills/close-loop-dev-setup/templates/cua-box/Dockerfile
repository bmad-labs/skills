# syntax=docker/dockerfile:1
# cua-box: a Linux XFCE desktop with cua-driver installed, for close-loop checks.
# Copy to tests/close-loop/docker/ and build through compose.yaml.
#
# Pin the base image by digest. trycua/cua-xfce is Debian Bookworm with XFCE, TigerVNC on :1 and
# noVNC on 6901. It is an amd64 image; on Apple Silicon, Docker runs it through emulation.
# Find the digest with: docker buildx imagetools inspect trycua/cua-xfce:latest
FROM trycua/cua-xfce@sha256:<digest>

USER root

# at-spi2-core: the accessibility bus that cua-driver reads app widgets through.
# socat: forwards a server that binds container-localhost to a published port.
RUN apt-get update \
 && apt-get install -y --no-install-recommends at-spi2-core socat \
 && rm -rf /var/lib/apt/lists/*

# Install the app under test here, pinned and checked. Example shape:
# ARG APP_VERSION=<version>
# ARG APP_SHA256=<sha256 from the vendor's release page>
# RUN curl -fsSL -o /tmp/app.tar.gz "https://<vendor>/releases/${APP_VERSION}/app.tar.gz" \
#  && echo "${APP_SHA256}  /tmp/app.tar.gz" | sha256sum -c - \
#  && tar -xzf /tmp/app.tar.gz -C /opt && rm /tmp/app.tar.gz

# cua-driver from the pinned release binary, checked against the release's checksums.txt.
# Declared late: a build argument joins the cache key of every later RUN.
# The base image bundles an older Python cua-driver in /opt/venv; this binary replaces it on PATH.
ARG CUA_DRIVER_VERSION=<version>
ARG CUA_DRIVER_SHA256=<sha256 from checksums.txt>
ARG CUA_DRIVER_ASSET=cua-driver-rs-${CUA_DRIVER_VERSION}-linux-x86_64-binary.tar.gz
RUN curl -fsSL -o /tmp/cua-driver.tar.gz \
      "https://github.com/trycua/cua/releases/download/cua-driver-rs-v${CUA_DRIVER_VERSION}/${CUA_DRIVER_ASSET}" \
 && echo "${CUA_DRIVER_SHA256}  /tmp/cua-driver.tar.gz" | sha256sum -c - \
 && mkdir -p /opt/cua-driver \
 && tar -xzf /tmp/cua-driver.tar.gz -C /opt/cua-driver cua-driver cua-cursor-theme \
 && ln -sf /opt/cua-driver/cua-driver /usr/local/bin/cua-driver \
 && rm /tmp/cua-driver.tar.gz

COPY --chmod=0755 bin/ /usr/local/bin/
COPY supervisor/ /etc/supervisor/conf.d/

USER cua
RUN /usr/local/bin/cua-driver telemetry disable

USER root
