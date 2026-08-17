#!/bin/sh
set -e

: "${BACKEND_URL:?BACKEND_URL environment variable is required}"
: "${PORT:=8080}"

envsubst '${PORT} ${BACKEND_URL}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
