FROM node:22-alpine AS build
WORKDIR /srv
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=http://backend:8000
RUN npm run build
FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://backend:8000
COPY --from=build --chown=node:node /srv ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
