FROM python:3.12-slim

# Install Node.js for JS execution
RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Install common Python data libraries
RUN pip install --no-cache-dir numpy pandas matplotlib scipy

# Create non-root user
RUN useradd -m sandbox
USER sandbox
WORKDIR /home/sandbox

# No network access is enforced by Docker at runtime (--network none)
# CPU and memory limits are set at runtime via HostConfig
