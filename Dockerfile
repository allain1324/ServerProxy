# Base image
FROM node:18-bullseye-slim

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install app dependencies (including playwright)
RUN npm install

# Copy rest of the app
COPY . .

# Expose port
EXPOSE 3001

# Start app
CMD ["npm", "start"]
