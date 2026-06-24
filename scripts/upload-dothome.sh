#!/usr/bin/env bash
set -euo pipefail

: "${DOTHOME_FTP_HOST:?Set DOTHOME_FTP_HOST}"
: "${DOTHOME_FTP_USER:?Set DOTHOME_FTP_USER}"
: "${DOTHOME_REMOTE_DIR:=/html}"
: "${DOTHOME_FTP_SCHEME:=ftps}"

case "${DOTHOME_FTP_SCHEME}" in
  ftps|sftp) ;;
  ftp)
    if [[ "${DOTHOME_ALLOW_INSECURE_FTP:-}" != "1" ]]; then
      echo "Refusing insecure upload protocol 'ftp'. Set DOTHOME_ALLOW_INSECURE_FTP=1 only when the host does not support FTPS/SFTP." >&2
      exit 1
    fi
    ;;
  *)
    echo "Refusing insecure upload protocol '${DOTHOME_FTP_SCHEME}'. Use ftps or sftp." >&2
    exit 1
    ;;
esac

if [[ -z "${DOTHOME_FTP_PASSWORD:-}" ]]; then
  read -r -s -p "Dothome FTP password: " DOTHOME_FTP_PASSWORD
  echo
fi

npm run build

upload_scheme="${DOTHOME_FTP_SCHEME}"
if [[ "${DOTHOME_FTP_SCHEME}" == "ftps" ]]; then
  # Dothome FTP servers commonly expect explicit FTPS: ftp:// plus --ssl-reqd.
  upload_scheme="ftp"
fi

while IFS= read -r -d "" file; do
  relative="${file#dist/}"
  curl_args=(
    --fail
    --silent
    --show-error
    --ftp-create-dirs
    --connect-timeout 12
    --max-time 60
    --user "${DOTHOME_FTP_USER}:${DOTHOME_FTP_PASSWORD}"
    --upload-file "${file}"
  )
  if [[ "${DOTHOME_FTP_SCHEME}" == "ftps" ]]; then
    curl_args+=(--ssl-reqd)
  fi
  curl "${curl_args[@]}" \
    "${upload_scheme}://${DOTHOME_FTP_HOST}${DOTHOME_REMOTE_DIR}/${relative}"
done < <(find dist -type f -print0)

echo "Uploaded frontend files to Dothome."
