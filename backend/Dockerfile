# Backend Development - Hot Reload
FROM node:22-slim

# Install dependencies for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (postinstall will run prisma generate)
RUN npm install --legacy-peer-deps

# Expose port
EXPOSE 3001

# Start development server with hot reload
CMD ["npm", "run", "dev"]
