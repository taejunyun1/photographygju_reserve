#!/usr/bin/env bash
set -euo pipefail

: "${DOTHOME_FTP_HOST:?Set DOTHOME_FTP_HOST}"
: "${DOTHOME_FTP_USER:?Set DOTHOME_FTP_USER}"
: "${DOTHOME_REMOTE_DIR:=/hosting/photographygju/html}"

if [[ -z "${DOTHOME_FTP_PASSWORD:-}" ]]; then
  read -r -s -p "Dothome FTP password: " DOTHOME_FTP_PASSWORD
  echo
fi

npm run build

for file in index.html styles.css app.js config.js; do
  curl --fail --ftp-create-dirs \
    --user "${DOTHOME_FTP_USER}:${DOTHOME_FTP_PASSWORD}" \
    --upload-file "dist/${file}" \
    "ftp://${DOTHOME_FTP_HOST}${DOTHOME_REMOTE_DIR}/${file}"
done

echo "Uploaded frontend files to Dothome."
