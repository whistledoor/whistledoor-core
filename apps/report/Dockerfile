# Copies an already built dist, so the image serves the files of the release
# and not a second build. Run `pnpm build` first. Build context: apps/report.
FROM caddy:2.11.7-alpine@sha256:e70b164da81ef698b3ad19af799ea6086ce6d9e48ed4079eb9fe26f6fbf14ee5

# The image name differs from the repository's, so GHCR needs this to link them.
LABEL org.opencontainers.image.source="https://github.com/whistledoor/whistledoor-core"

COPY Caddyfile /etc/caddy/Caddyfile
COPY dist /srv
