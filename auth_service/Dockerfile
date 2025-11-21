# Use official Node.js LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
ENV PORT=4000
EXPOSE 4000

# Use a non-root user (optional security)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Start the app
CMD ["node", "index.js"]
