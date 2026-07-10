#!/usr/bin/env bash
# Usage: BASE=https://vitamind-dev.vercel.app bash scripts/smoke-i18n.sh
set -euo pipefail
BASE="${BASE:?set BASE to the deployment URL}"
fail=0

# NOTE: `set -o pipefail` + `set -e` means a command substitution whose pipeline
# ends in a failing grep kills the script outright. That is exactly what happens
# when a check is about to FAIL, so without the `|| true` guards below the script
# exits 1 having printed nothing -- it hides the very failure it exists to report.
check_lang() { # url expected_lang
  local got
  got=$(curl -s "$BASE$1" | grep -o '<html lang="[^"]*"' | head -1 || true)
  if echo "$got" | grep -q "\"$2\""; then echo "OK  lang $2  $1"; else echo "FAIL lang $1 -> ${got:-<no html lang>} (want $2)"; fail=1; fi
}
check_redirect() { # path expected_location expected_code
  local loc code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$1" || true)
  loc=$(curl -s -I "$BASE$1" | grep -i '^location:' | tr -d '\r' | awk '{print $2}' || true)
  if [ "$code" = "$3" ] && echo "$loc" | grep -q "$2"; then echo "OK  redirect $1 -> $loc ($code)"; else echo "FAIL redirect $1 -> ${loc:-<none>} ($code), want $2 ($3)"; fail=1; fi
}

check_lang "/" es
check_lang "/en" en
check_lang "/fr/learn" fr
# Legacy ?locale= is a permanent (301) consolidation of the old query scheme.
check_redirect "/?locale=fr" "/fr" 301
# /es/... → /... is next-intl stripping the default-locale prefix; it emits a
# temporary (307) redirect, which is fine since /es/* was never a public URL.
check_redirect "/es/learn" "/learn" 307

# ---------------------------------------------------------------- city pages --

# Fetch once into a variable rather than piping curl into grep. `grep -q` exits on
# the first match, curl then dies of SIGPIPE (exit 23), and `pipefail` reports the
# whole pipeline as failed -- so the check FAILs precisely because it matched, and
# the bigger the body the more reliably it misfires (the 400 KB sitemap always did).
body_of() { curl -s "$BASE$1" || true; }

has() { # url pattern label   -- pattern must be a *rendered* value, not a template
  if printf '%s' "$(body_of "$1")" | grep -q "$2"; then echo "OK  $3"; else echo "FAIL $3  ($1)"; fail=1; fi
}
hasnt() { # url pattern label
  if printf '%s' "$(body_of "$1")" | grep -q "$2"; then echo "FAIL $3  ($1 should not contain it)"; fail=1; else echo "OK  $3"; fi
}
has_i() { # url pattern label   -- case-insensitive
  if printf '%s' "$(body_of "$1")" | grep -qi "$2"; then echo "OK  $3"; else echo "FAIL $3  ($1)"; fail=1; fi
}
code_is() { # url expected_code label
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$1" || true)
  if [ "$code" = "$2" ]; then echo "OK  $3 ($code)"; else echo "FAIL $3 -> $code (want $2)"; fail=1; fi
}

# hreflang present on a localized page. Next serializes the attribute as
# `hrefLang` (camelCase); HTML attributes are case-insensitive, so match with -i.
has_i "/en/learn" 'hreflang="fr"' "hreflang present on /en/learn"

check_lang "/vitamina-d/madrid" es
check_lang "/en/vitamin-d/london" en
check_lang "/fr/vitamine-d/londres" fr
check_lang "/lt/vitaminas-d/londonas" lt
# ru borrows the real Latin name; "moskva" would be a back-transliteration.
check_lang "/ru/vitamin-d/moscow" ru

# The [cityPrefix] segment sits beside static siblings (dashboard, explore...),
# so a prefix that does not belong to the locale must 404, not render a city.
code_is "/en/vitamina-d/london" 404 "wrong prefix for locale 404s"
code_is "/vitamina-d/atlantis" 404 "unknown city 404s"

# SEO plumbing on a city page.
has "/en/vitamin-d/london" '"@type":"FAQPage"' "city FAQPage schema"
has "/en/vitamin-d/london" 'rel="canonical" href="[^"]*/en/vitamin-d/london"' "city canonical self-references"
has_i "/en/vitamin-d/london" 'hreflang="fr"' "city hreflang"

# Content: the corrected UV model must not claim a vitamin-D winter where there is
# none, nor deny one where there is. These two cities bracket the model.
has   "/en/vitamin-d/london"  'from April to September' "London: Apr-Sep verdict (SACN says no synthesis Oct-Mar)"
has   "/en/vitamin-d/london"  'More precisely: March 24' "London: exact window line"
hasnt "/en/vitamin-d/singapore" 'More precisely: [0-9A-Z]' "Singapore: no exact-window line (all year)"
hasnt "/en/vitamin-d/singapore" 'When to supplement in Singapore' "Singapore: no supplement block (all year)"
has   "/en/vitamin-d/madrid"  'When to supplement in Madrid' "Madrid: supplement block present"

# The sitemap must carry every city, with alternates.
has "/sitemap.xml" 'vitamina-d/madrid'      "sitemap: es Madrid"
has "/sitemap.xml" '/ru/vitamin-d/london'   "sitemap: ru London (Latin name)"
has "/sitemap.xml" '/lt/vitaminas-d/londonas' "sitemap: lt Londonas"

exit $fail
