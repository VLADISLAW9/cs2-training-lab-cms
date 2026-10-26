FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p public/uploads && chown -R node:node public/uploads
ENV NODE_ENV=production
EXPOSE 1337
USER node
CMD ["npm", "start"]
