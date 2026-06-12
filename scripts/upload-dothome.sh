#!/usr/bin/env bash
set -euo pipefail

: "${DOTHOME_FTP_HOST:?Set DOTHOME_FTP_HOST}"
: "${DOTHOME_FTP_USER:?Set DOTHOME_FTP_USER}"
: "${DOTHOME_FTP_PASSWORD:?Set DOTHOME_FTP_PASSWORD}"
: "${DOTHOME_REMOTE_DIR:=/hosting/photographygju/html}"

npm run build

for file in index.html styles.css app.js config.js; do
  curl --fail --ftp-create-dirs \
    --user "${DOTHOME_FTP_USER}:${DOTHOME_FTP_PASSWORD}" \
    --upload-file "dist/${file}" \
    "ftp://${DOTHOME_FTP_HOST}${DOTHOME_REMOTE_DIR}/${file}"
done

echo "Uploaded frontend files to Dothome."
