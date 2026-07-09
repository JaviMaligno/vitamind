#!/usr/bin/env bash
# Usage: BASE=https://vitamind-dev.vercel.app bash scripts/smoke-i18n.sh
set -euo pipefail
BASE="${BASE:?set BASE to the deployment URL}"
fail=0

check_lang() { # url expected_lang
  local got
  got=$(curl -s "$BASE$1" | grep -o '<html lang="[^"]*"' | head -1)
  if echo "$got" | grep -q "\"$2\""; then echo "OK  lang $2  $1"; else echo "FAIL lang $1 -> $got (want $2)"; fail=1; fi
}
check_redirect() { # path expected_location expected_code
  local loc code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$1")
  loc=$(curl -s -I "$BASE$1" | grep -i '^location:' | tr -d '\r' | awk '{print $2}')
  if [ "$code" = "$3" ] && echo "$loc" | grep -q "$2"; then echo "OK  redirect $1 -> $loc ($code)"; else echo "FAIL redirect $1 -> $loc ($code), want $2 ($3)"; fail=1; fi
}

check_lang "/" es
check_lang "/en" en
check_lang "/fr/learn" fr
check_redirect "/?locale=fr" "/fr" 301
check_redirect "/es/learn" "/learn" 301

# hreflang + canonical present on a localized page
if curl -s "$BASE/en/learn" | grep -q 'hreflang="fr"'; then echo "OK  hreflang present"; else echo "FAIL hreflang missing on /en/learn"; fail=1; fi

exit $fail
