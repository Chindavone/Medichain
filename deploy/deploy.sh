#!/bin/sh
# Build and (re)start the POC stack. Safe to re-run: the contract is only deployed once.
set -e
cd "$(dirname "$0")/.."
C="docker compose -f docker-compose.prod.yml"

if [ ! -f .env.prod ]; then
  pw=$(openssl rand -hex 16)
  {
    echo "POSTGRES_PASSWORD=$pw"
    echo "DATABASE_URL=postgres://medichain:$pw@db:5432/medichain"
    echo "DATA_KEY=$(openssl rand -hex 32)"
    echo "SESSION_SECRET=$(openssl rand -hex 32)"
  } > .env.prod
  chmod 600 .env.prod
  echo "Created .env.prod — back it up: losing DATA_KEY makes stored records unreadable."
fi

$C build
$C up -d db chain
if ! $C run --rm --no-deps api test -f /shared/deployment.json; then
  sleep 5
  $C run --rm api npx hardhat run scripts/deploy.js --network localhost
fi
$C up -d
$C ps
