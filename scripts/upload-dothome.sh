#!/usr/bin/env bash
set -euo pipefail

: "${DOTHOME_FTP_HOST:?Set DOTHOME_FTP_HOST}"
: "${DOTHOME_FTP_USER:?Set DOTHOME_FTP_USER}"
: "${DOTHOME_REMOTE_DIR:=/html}"

if [[ -z "${DOTHOME_FTP_PASSWORD:-}" ]]; then
  read -r -s -p "Dothome FTP password: " DOTHOME_FTP_PASSWORD
  echo
fi

npm run build

while IFS= read -r -d "" file; do
  relative="${file#dist/}"
  curl --fail --ftp-create-dirs \
    --connect-timeout 12 \
    --max-time 60 \
    --user "${DOTHOME_FTP_USER}:${DOTHOME_FTP_PASSWORD}" \
    --upload-file "${file}" \
    "ftp://${DOTHOME_FTP_HOST}${DOTHOME_REMOTE_DIR}/${relative}"
done < <(find dist -type f -print0)

echo "Uploaded frontend files to Dothome."
