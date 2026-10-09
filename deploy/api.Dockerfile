FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts
COPY server ./server
RUN npx hardhat compile
CMD ["node", "server/index.js"]
