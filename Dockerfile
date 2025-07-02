FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install --production && npm install diskusage express-rate-limit
COPY . .
RUN mkdir -p /var/data/downloads
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
