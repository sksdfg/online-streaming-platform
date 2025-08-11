FROM node:latest

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application, including public/
COPY . .

# Make sure to expose the port your app runs on
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
