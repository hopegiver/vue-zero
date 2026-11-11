#!/bin/sh
# 벤치용 자체서명 인증서 생성(.cert/ 는 .gitignore). Chromium 은 --ignore-certificate-errors-spki-list 로 신뢰해 HTTP 캐시가 정상 동작한다.
set -e
d="$(cd "$(dirname "$0")/.." && pwd)/.cert"
mkdir -p "$d"
[ -f "$d/key.pem" ] && exit 0
cat > "$d/openssl.cnf" <<CNF
[req]
distinguished_name=dn
x509_extensions=v3
prompt=no
[dn]
CN=localhost
[v3]
subjectAltName=DNS:localhost,IP:127.0.0.1
CNF
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$d/key.pem" -out "$d/cert.pem" -days 30 -config "$d/openssl.cnf" >/dev/null 2>&1
openssl x509 -in "$d/cert.pem" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64 > "$d/spki.txt"
