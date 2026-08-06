FROM node:20-alpine

# Phase 0.5: dedicated non-root user with fixed UID/GID
RUN addgroup -g 10001 zrh-runner && adduser -D -u 10001 -G zrh-runner zrh-runner

# Only required runtime tools; no sudo, no docker CLI, no docker.sock
RUN apk add --no-cache git bash findutils grep

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY test ./test

# Controlled temp dir and writable HOME (compose mounts tmpfs on /tmp and /home/zrh-runner)
RUN mkdir -p /zrh-workspaces /home/zrh-runner \
  && chown -R zrh-runner:zrh-runner /app /zrh-workspaces /home/zrh-runner

ENV NODE_ENV=production
ENV RUNNER_PORT=5055
ENV WORKSPACES_ROOT=/zrh-workspaces
ENV HOME=/home/zrh-runner

USER zrh-runner

EXPOSE 5055
CMD ["node", "src/server.js"]
