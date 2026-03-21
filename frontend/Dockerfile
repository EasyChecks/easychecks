# Frontend Development - Hot Reload
FROM node:22-slim

WORKDIR /app

# Improve resilience for transient npm network failures during image builds
ENV NPM_CONFIG_FETCH_RETRIES=5 \
	NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
	NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
	NPM_CONFIG_FETCH_TIMEOUT=300000

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Expose port
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "run", "dev"]
