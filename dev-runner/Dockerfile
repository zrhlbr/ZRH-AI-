FROM node:20-alpine
RUN apk add --no-cache git bash findutils grep
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
ENV RUNNER_PORT=5055
ENV WORKSPACES_ROOT=/zrh-workspaces
EXPOSE 5055
CMD ["node", "src/server.js"]
