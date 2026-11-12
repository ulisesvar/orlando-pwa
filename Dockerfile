# syntax=docker/dockerfile:1
# Etapa 1: generar dist/ (hash del Service Worker y lista de precache).
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY scripts/build.mjs scripts/build.mjs
COPY src src
RUN node scripts/build.mjs

# Etapa 2: Nginx sin privilegios (UID 101), puerto 8080, sin escritura en el código.
FROM nginxinc/nginx-unprivileged:1.30-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

ARG VERSION=dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="orlando-pwa" \
      org.opencontainers.image.description="PWA familiar Orlando 2026" \
      org.opencontainers.image.source="https://github.com/ulisesvar/orlando-pwa" \
      org.opencontainers.image.url="https://github.com/ulisesvar/orlando-pwa" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.licenses="UNLICENSED"

COPY --chown=root:root --chmod=0644 infra/nginx.conf /etc/nginx/nginx.conf
USER root
# Aplica parches de seguridad de Alpine publicados después de la base fijada por digest.
RUN apk upgrade --no-cache && rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*
COPY --from=build --chown=root:root --chmod=0755 /app/dist/ /usr/share/nginx/html/

USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
