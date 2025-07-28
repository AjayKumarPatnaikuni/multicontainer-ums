FROM node:18-alpine

WORKDIR /app

# Install dependencies for MySQL client
RUN apk add --no-cache mysql-client

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]