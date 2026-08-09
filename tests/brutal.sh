#!/usr/bin/env bash
# Brutal end-to-end / adversarial test suite for AgentDraft.
#
# This is NOT a smoke test. It attacks the deployment: XSS bypass attempts, auth
# bypass, privilege escalation, cross-tenant access, injection, race conditions,
# malformed input, and cache/conditional-request correctness. It runs against a REAL
# deployment over the network.
#
# Usage:
#   API=https://api.agentdraft.tapetide.com \
#   CONTENT=https://agentdraft.tapetide.com \
#   KEY=ad_xxx [BOOTSTRAP_SECRET=xxx] ./tests/brutal.sh
#
# Exit code 0 only if every assertion passes.

set -uo pipefail

API="${API:-https://api.agentdraft.tapetide.com}"
CONTENT="${CONTENT:-https://agentdraft.tapetide.com}"
KEY="${KEY:-}"

if [ -z "$KEY" ]; then echo "FATAL: set KEY to a valid ad_ API key" >&2; exit 2; fi

PASS=0; FAIL=0; FAILED_NAMES=()
RED=$'\033[31m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; OFF=$'\033[0m'

ok()   { PASS=$((PASS+1)); printf "  ${GREEN}PASS${OFF} %s\n" "$1"; }
# If we hit the rate limit mid-run, later results are meaningless. Stop immediately
# rather than emitting a wall of phantom failures.
rl_guard() { if [ "$1" = "429" ]; then printf "\n${RED}ABORT: hit upload rate limit mid-run. Results after this point are invalid.${OFF}\n"; printf "passed=%d failed=%d (incomplete)\n" "$PASS" "$FAIL"; exit 3; fi; }
bad()  { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); printf "  ${RED}FAIL${OFF} %s ${DIM}(%s)${OFF}\n" "$1" "$2"; }
sect() { printf "\n${BOLD}== %s${OFF}\n" "$1"; }

# assert_eq <name> <expected> <actual>
assert_eq() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "expected=$2 got=$3"; fi; }
# assert_ne <name> <not-expected> <actual>
assert_ne() { if [ "$2" != "$3" ]; then ok "$1"; else bad "$1" "should not be $2"; fi; }
# assert_contains <name> <needle> <haystack>
assert_contains() { case "$3" in *"$2"*) ok "$1";; *) bad "$1" "missing '$2'";; esac; }

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }

jqf() { python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print(''); sys.exit(0)
cur=d
for k in sys.argv[1].split('.'):
    if k=='': continue
    if isinstance(cur,list):
        try: cur=cur[int(k)]
        except Exception: print(''); sys.exit(0)
    elif isinstance(cur,dict): cur=cur.get(k)
    else: print(''); sys.exit(0)
    if cur is None: print(''); sys.exit(0)
print(json.dumps(cur) if isinstance(cur,(dict,list,bool)) else cur)
" "$1"; }

# upload_raw <json-body> [extra curl args...] -> prints "HTTPCODE<TAB>BODY"
upload_raw() {
  local b="$1"; shift
  local out; out=$(curl -s -w '\n%{http_code}' -X POST "$API/api/upload" \
    -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
    "$@" -d "$b")
  local hc; hc=$(printf '%s' "$out" | tail -1)
  local bd; bd=$(printf '%s' "$out" | sed '$d')
  rl_guard "$hc"
  printf '%s\t%s' "$hc" "$bd"
}

mkjson() { python3 -c "
import json,sys
o={'html':sys.argv[1]}
if len(sys.argv)>2 and sys.argv[2]: o['draft_id']=sys.argv[2]
print(json.dumps(o))
" "$1" "${2:-}"; }

# upload_html <html> [draft] -> prints "HTTPCODE<TAB>BODY"
upload_html() { upload_raw "$(mkjson "$1" "${2:-}")"; }

printf "${BOLD}AgentDraft brutal suite${OFF}\n"
printf "  API=%s\n  CONTENT=%s\n" "$API" "$CONTENT"

# This suite performs ~70 uploads. The API rate-limits uploads to 100/hour PER KEY, so
# two runs inside one hour will exhaust the budget and every later assertion fails with
# an empty body — phantom failures that look like real regressions. Fail fast and loudly
# instead, and tell the operator exactly what to do.
RL_PROBE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/upload" \
  -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d "$(python3 -c "import json;print(json.dumps({'html':'<!DOCTYPE html><html><head><title>rl</title></head><body>probe</body></html>'}))")")
if [ "$RL_PROBE" = "429" ]; then
  printf "\n${RED}ABORT: upload rate limit already exhausted for this key (HTTP 429).${OFF}\n"
  printf "  The suite needs ~70 uploads; the limit is 100/hour per key.\n"
  printf "  Mint a fresh key and re-run:\n"
  printf "    KEY=\$(curl -s -X POST %s/api/api-keys -H \"authorization: Bearer \$MANAGE_KEY\" \\\n" "$API"
  printf "      -H 'content-type: application/json' -d '{\"name\":\"brutal\",\"scopes\":[\"upload\",\"read\",\"manage\"]}' \\\n"
  printf "      | python3 -c 'import sys,json;print(json.load(sys.stdin)[\"api_key\"])')\n"
  exit 3
fi
if [ "$RL_PROBE" != "201" ]; then
  printf "\n${RED}ABORT: pre-flight upload returned %s (expected 201). Deployment unhealthy?${OFF}\n" "$RL_PROBE"
  exit 3
fi

# ---------------------------------------------------------------- reachability
sect "0. Reachability"
assert_eq "api /api/health 200"        200 "$(code "$API/api/health")"
assert_eq "content /health 200"        200 "$(code "$CONTENT/health")"

# ---------------------------------------------------------------- XSS / policy
sect "1. HTML policy — every one of these MUST be rejected 422"
# name|html  (pipe-delimited so we can loop)
BLOCKED=(
  'inline script|<html><head><title>t</title></head><body><script>alert(1)</script></body></html>'
  'script src|<html><head><title>t</title><script src="https://e.co/x.js"></script></head><body>x</body></html>'
  'script uppercase|<html><head><title>t</title></head><body><SCRIPT>alert(1)</SCRIPT></body></html>'
  'script mixed case|<html><head><title>t</title></head><body><ScRiPt>alert(1)</ScRiPt></body></html>'
  'script type=module|<html><head><title>t</title></head><body><script type="module">x</script></body></html>'
  'script in template|<html><head><title>t</title></head><body><template><script>alert(1)</script></template></body></html>'
  'script in noscript|<html><head><title>t</title></head><body><noscript><script>alert(1)</script></noscript></body></html>'
  'svg script|<html><head><title>t</title></head><body><svg><script>alert(1)</script></svg></body></html>'
  'iframe|<html><head><title>t</title></head><body><iframe src="https://e.co"></iframe></body></html>'
  'object|<html><head><title>t</title></head><body><object data="x"></object></body></html>'
  'embed|<html><head><title>t</title></head><body><embed src="x"></body></html>'
  'form|<html><head><title>t</title></head><body><form action="https://e.co"><input name="p"></form></body></html>'
  'bare input|<html><head><title>t</title></head><body><input type="password"></body></html>'
  'textarea|<html><head><title>t</title></head><body><textarea>x</textarea></body></html>'
  'base tag|<html><head><title>t</title><base href="https://e.co/"></head><body>x</body></html>'
  'link tag|<html><head><title>t</title><link rel=stylesheet href="https://e.co/a.css"></head><body>x</body></html>'
  'meta refresh|<html><head><title>t</title><meta http-equiv="refresh" content="0;url=https://e.co"></head><body>x</body></html>'
  'onclick|<html><head><title>t</title></head><body><div onclick="alert(1)">x</div></body></html>'
  'onload body|<html><head><title>t</title></head><body onload="alert(1)">x</body></html>'
  'onerror img|<html><head><title>t</title></head><body><img src=x onerror="alert(1)"></body></html>'
  'onmouseover caps|<html><head><title>t</title></head><body><a href="https://e.co" OnMouseOver="x">y</a></body></html>'
  'onfocus autofocus|<html><head><title>t</title></head><body><div onfocus="alert(1)">x</div></body></html>'
  'js: url|<html><head><title>t</title></head><body><a href="javascript:alert(1)">x</a></body></html>'
  'js: tab entity|<html><head><title>t</title></head><body><a href="java&#x09;script:alert(1)">x</a></body></html>'
  'js: newline|<html><head><title>t</title></head><body><a href="java
script:alert(1)">x</a></body></html>'
  'js: mixed case+space|<html><head><title>t</title></head><body><a href="  JaVaScRiPt:alert(1)">x</a></body></html>'
  'js: colon entity|<html><head><title>t</title></head><body><a href="javascript&colon;alert(1)">x</a></body></html>'
  'vbscript:|<html><head><title>t</title></head><body><a href="vbscript:msgbox(1)">x</a></body></html>'
  'data:text/html|<html><head><title>t</title></head><body><a href="data:text/html,<script>x</script>">x</a></body></html>'
  'file: url|<html><head><title>t</title></head><body><a href="file:///etc/passwd">x</a></body></html>'
  'img js src|<html><head><title>t</title></head><body><img src="javascript:alert(1)"></body></html>'
  'srcdoc|<html><head><title>t</title></head><body><iframe srcdoc="<script>x</script>"></iframe></body></html>'
  'css expression|<html><head><title>t</title><style>div{width:expression(alert(1))}</style></head><body>x</body></html>'
  'css behavior|<html><head><title>t</title><style>div{behavior:url(x.htc)}</style></head><body>x</body></html>'
  'css url(js:)|<html><head><title>t</title></head><body><div style="background:url(javascript:alert(1))">x</div></body></html>'
  'css @import|<html><head><title>t</title><style>@import url("https://e.co/x.css");</style></head><body>x</body></html>'
  'mathml annotation-xml|<html><head><title>t</title></head><body><math><annotation-xml encoding="text/html"><span>x</span></annotation-xml></math></body></html>'
  'svg onload|<html><head><title>t</title></head><body><svg onload="alert(1)"><circle r=1/></svg></body></html>'
  'svg xlink js|<html><head><title>t</title></head><body><svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg></body></html>'
  'unterminated comment|<html><head><title>t</title></head><body><!-- <script>alert(1)</script> <p>x</body></html>'
  'CDATA|<html><head><title>t</title></head><body><![CDATA[<script>alert(1)</script>]]></body></html>'
  'frameset|<html><head><title>t</title></head><frameset><frame src="https://e.co"></frameset></html>'
  'portal|<html><head><title>t</title></head><body><portal src="https://e.co"></portal></body></html>'
  'style close escape|<html><head><title>t</title><style></style><script>x</script></head><body>y</body></html>'
  'ping attr|<html><head><title>t</title></head><body><a href="https://e.co" ping="https://e.co/t">x</a></body></html>'
  'meta set-cookie|<html><head><title>t</title><meta http-equiv="set-cookie" content="a=b"></head><body>x</body></html>'
)
for entry in "${BLOCKED[@]}"; do
  n="${entry%%|*}"; h="${entry#*|}"
  r=$(upload_html "$h"); hc="${r%%$'\t'*}"
  assert_eq "reject: $n" 422 "$hc"
done

sect "2. HTML policy — these MUST be accepted 201"
ALLOWED=(
  'minimal doc|<!DOCTYPE html><html><head><title>ok</title></head><body><h1>hi</h1></body></html>'
  'inline style block|<!DOCTYPE html><html><head><title>ok</title><style>body{color:red}</style></head><body>x</body></html>'
  'style attribute|<!DOCTYPE html><html><head><title>ok</title></head><body><p style="color:blue">x</p></body></html>'
  'https image|<!DOCTYPE html><html><head><title>ok</title></head><body><img src="https://e.co/a.png" alt="a"></body></html>'
  'data image|<!DOCTYPE html><html><head><title>ok</title></head><body><img src="data:image/png;base64,iVBORw0KGgo=" alt="a"></body></html>'
  'inline svg|<!DOCTYPE html><html><head><title>ok</title></head><body><svg viewBox="0 0 9 9"><circle cx=4 cy=4 r=3/></svg></body></html>'
  'table|<!DOCTYPE html><html><head><title>ok</title></head><body><table><tr><td>1</td></tr></table></body></html>'
  'mailto+fragment|<!DOCTYPE html><html><head><title>ok</title></head><body><a href="mailto:a@b.co">m</a><a href="#s">s</a></body></html>'
  'comment|<!DOCTYPE html><html><head><title>ok</title></head><body><!-- fine --><p>x</p></body></html>'
  'unicode content|<!DOCTYPE html><html><head><meta charset="utf-8"><title>ok</title></head><body><p>日本語 ✓ émoji 🎉</p></body></html>'
)
for entry in "${ALLOWED[@]}"; do
  n="${entry%%|*}"; h="${entry#*|}"
  r=$(upload_html "$h"); hc="${r%%$'\t'*}"
  assert_eq "accept: $n" 201 "$hc"
done

# ------------------------------------------------------------- byte fidelity
sect "3. Byte-for-byte fidelity (the core product promise)"
FID='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fidelity</title><style>body{margin:0}</style></head><body><h1>ünïcödé &amp; &lt;escaped&gt; "quotes"</h1><p>	tab and  double space</p></body></html>'
r=$(upload_html "$FID"); hc="${r%%$'\t'*}"; bd="${r#*$'\t'}"
DID=$(printf '%s' "$bd" | jqf draft_id)
if [ "$hc" = "201" ] && [ -n "$DID" ]; then
  printf '%s' "$FID" > /tmp/_bf_src.html
  curl -s "$CONTENT/d/$DID" -o /tmp/_bf_got.html
  if cmp -s /tmp/_bf_src.html /tmp/_bf_got.html; then ok "served bytes identical to uploaded"; else bad "served bytes identical to uploaded" "cmp differs"; fi

  # CRITICAL: a CDN/proxy can inject HTML (Cloudflare Web Analytics/RUM, Email
  # Obfuscation, Rocket Loader) and several of those are gated on a BROWSER user-agent.
  # curl's default UA does NOT trigger them, so testing only with curl's default
  # FALSE-PASSES the product's core promise. Re-check as a browser would, on both the
  # canonical and /raw paths, and assert no <script> ever reaches served content.
  BUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  for path in "/d/$DID" "/d/$DID/raw"; do
    injected=0; mismatched=0
    for _ in 1 2 3 4; do
      curl -s "$CONTENT$path" -H 'accept: text/html,application/xhtml+xml' -H "user-agent: $BUA" -o /tmp/_bf_ua.html
      cmp -s /tmp/_bf_src.html /tmp/_bf_ua.html || mismatched=$((mismatched+1))
      grep -qi 'cloudflareinsights\|rocket-loader\|/cdn-cgi/' /tmp/_bf_ua.html && injected=$((injected+1))
    done
    assert_eq "browser-UA bytes identical ($path)" 0 "$mismatched"
    assert_eq "no CDN script injected ($path)"     0 "$injected"
  done
  if grep -qi '<script' /tmp/_bf_got.html; then bad "no <script> in served document" "found <script>"; else ok "no <script> in served document"; fi
  assert_eq "content-type is text/html; charset=utf-8" "text/html; charset=utf-8" \
    "$(curl -sI "$CONTENT/d/$DID" | tr -d '\r' | awk 'tolower($1)=="content-type:"{$1="";sub(/^ /,"");print}')"
else
  bad "fidelity upload" "hc=$hc"
fi

# ------------------------------------------------------------ security headers
sect "4. Content-origin security headers"
H=$(curl -sI "$CONTENT/d/$DID" | tr -d '\r')
lc() { printf '%s' "$H" | tr 'A-Z' 'a-z'; }
assert_contains "CSP script-src 'none'"        "script-src 'none'"      "$(lc)"
assert_contains "CSP default-src 'none'"       "default-src 'none'"     "$(lc)"
assert_contains "CSP object-src or default"    "default-src 'none'"     "$(lc)"
assert_contains "CSP form-action 'none'"       "form-action 'none'"     "$(lc)"
assert_contains "CSP base-uri 'none'"          "base-uri 'none'"        "$(lc)"
assert_contains "X-Content-Type-Options"       "nosniff"                "$(lc)"
assert_contains "X-Robots-Tag noindex"         "noindex"                "$(lc)"
assert_contains "Referrer-Policy no-referrer"  "no-referrer"            "$(lc)"
assert_contains "CORP present"                 "cross-origin-resource-policy" "$(lc)"
if printf '%s' "$(lc)" | grep -q "set-cookie"; then
  bad "content origin sets NO cookie" "Set-Cookie present on untrusted origin"
else ok "content origin sets NO cookie"; fi

# ------------------------------------------------------------------ auth
sect "5. Authentication / authorization"
assert_eq "no credential -> 401"        401 "$(code -X POST "$API/api/upload" -H 'content-type: application/json' -d '{"html":"<p>x</p>"}')"
assert_eq "garbage bearer -> 401"       401 "$(code -X POST "$API/api/upload" -H 'authorization: Bearer ad_0000000000000000000000000000000000000000' -H 'content-type: application/json' -d '{"html":"<p>x</p>"}')"
assert_eq "non-ad_ bearer -> 401"       401 "$(code -X POST "$API/api/upload" -H 'authorization: Bearer notakey' -H 'content-type: application/json' -d '{"html":"<p>x</p>"}')"
assert_eq "Basic scheme -> 401"         401 "$(code -X POST "$API/api/upload" -H 'authorization: Basic YWRtaW46YWRtaW4=' -d '{}')"
assert_eq "empty bearer -> 401"         401 "$(code -X POST "$API/api/upload" -H 'authorization: Bearer ' -d '{}')"
assert_eq "valid key /api/me -> 200"    200 "$(code "$API/api/me" -H "authorization: Bearer $KEY")"
assert_eq "bootstrap wrong secret->401" 401 "$(code -X POST "$API/api/bootstrap" -H 'x-bootstrap-secret: definitely-not-the-secret' -d '{}')"
assert_eq "bootstrap no secret -> 401"  401 "$(code -X POST "$API/api/bootstrap" -d '{}')"

sect "6. Privilege escalation — an upload/read key must NOT mint keys"
LK=$(body -X POST "$API/api/api-keys" -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
      -d '{"name":"brutal-limited","scopes":["upload","read"]}' | jqf api_key)
if [ -n "$LK" ]; then
  ok "created a limited (upload,read) key"
  assert_eq "limited key cannot LIST keys -> 403"   403 "$(code "$API/api/api-keys" -H "authorization: Bearer $LK")"
  assert_eq "limited key cannot MINT keys -> 403"   403 "$(code -X POST "$API/api/api-keys" -H "authorization: Bearer $LK" -H 'content-type: application/json' -d '{"name":"escalated","scopes":["manage"]}')"
  assert_eq "limited key CAN upload -> 201"         201 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $LK" -H 'content-type: application/json' -d "$(mkjson '<!DOCTYPE html><html><head><title>lim</title></head><body>x</body></html>')")"
  # revoke it, then prove it is dead
  LKID=$(body "$API/api/api-keys" -H "authorization: Bearer $KEY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for k in d.get('keys',[]):
    if k['name']=='brutal-limited' and not k.get('revoked_at'): print(k['id']); break
")
  if [ -n "$LKID" ]; then
    curl -s -o /dev/null -X DELETE "$API/api/api-keys/$LKID" -H "authorization: Bearer $KEY"
    assert_eq "revoked key -> 401"  401 "$(code "$API/api/me" -H "authorization: Bearer $LK")"
  else bad "find limited key id" "not found"; fi
else bad "create limited key" "no api_key returned"; fi

# ------------------------------------------------------------ cross-tenant
sect "7. Cross-tenant / IDOR"
assert_eq "foreign draft id -> 404"       404 "$(code "$API/api/drafts/aaaaaaaaaaaa" -H "authorization: Bearer $KEY")"
assert_eq "foreign project -> 404"        404 "$(code "$API/api/projects/proj_zzzzzzzzzzzz" -H "authorization: Bearer $KEY" -X PATCH -H 'content-type: application/json' -d '{"name":"x"}')"
assert_eq "upload to foreign draft ->404" 404 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d "$(mkjson '<!DOCTYPE html><html><head><title>x</title></head><body>y</body></html>' 'aaaaaaaaaaaa')")"
assert_eq "delete foreign draft -> 404"   404 "$(code -X DELETE "$API/api/drafts/aaaaaaaaaaaa" -H "authorization: Bearer $KEY")"

# ------------------------------------------------------------ malformed input
sect "8. Malformed / hostile input (must be 4xx, never 5xx)"
for t in \
  'not json at all' \
  '{' \
  '[]' \
  'null' \
  '{"html":null}' \
  '{"html":123}' \
  '{"html":{"a":1}}' \
  '{"html":[]}' \
  '{"html":""}' \
  '{"nothtml":"x"}' \
  '{"html":"<p>x</p>","draft_id":123}' \
  '{"html":"<p>x</p>","project_id":{"a":1}}' \
; do
  hc=$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d "$t")
  case "$hc" in 4*) ok "malformed body -> $hc  ${DIM}${t:0:34}${OFF}";; *) bad "malformed body ${t:0:34}" "got $hc (want 4xx)";; esac
done

sect "8b. JSON shape + field-type validation (regression: null body used to 500)"
assert_eq "bare null body -> 400"        400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d 'null')"
assert_eq "bare array body -> 400"       400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '[]')"
assert_eq "numeric body -> 400"          400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '42')"
assert_eq "string body -> 400"           400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '"hello"')"
assert_eq "numeric draft_id -> 400"      400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '{"html":"<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>","draft_id":123}')"
assert_eq "object project_id -> 400"     400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '{"html":"<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>","project_id":{"a":1}}')"
assert_eq "array metadata -> 400"        400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '{"html":"<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>","metadata":[1,2]}')"
assert_eq "numeric html -> 400"          400 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d '{"html":123}')"
assert_eq "null body on /api/session"    400 "$(code -X POST "$API/api/session" -H 'content-type: application/json' -d 'null')"
assert_eq "null body on /api/projects"   400 "$(code -X POST "$API/api/projects" -H "authorization: Bearer $KEY" -H 'content-type: application/json' -d 'null')"

sect "9. SQL / path injection attempts (must not 500 or leak)"
for inj in "' OR 1=1--" "'; DROP TABLE drafts;--" "../../etc/passwd" "%2e%2e%2f%2e%2e%2fetc%2fpasswd" "<script>alert(1)</script>" "$(printf 'a%.0s' {1..300})"; do
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$inj")
  hc=$(code "$API/api/drafts/$enc" -H "authorization: Bearer $KEY")
  case "$hc" in 4*) ok "injection rejected -> $hc  ${DIM}${inj:0:24}${OFF}";; *) bad "injection ${inj:0:24}" "got $hc";; esac
  hc2=$(code "$CONTENT/d/$enc")
  case "$hc2" in 4*) ok "content injection -> $hc2  ${DIM}${inj:0:24}${OFF}";; *) bad "content injection ${inj:0:24}" "got $hc2";; esac
done

# ------------------------------------------------------------ size limits
sect "10. Size limit (2 MiB)"
python3 -c "
import json
pad='x'*(2*1024*1024+1024)
print(json.dumps({'html':'<!DOCTYPE html><html><head><title>big</title></head><body><p>'+pad+'</p></body></html>'}))
" > /tmp/_big.json
assert_eq "oversize doc -> 422" 422 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' --data-binary @/tmp/_big.json)"
python3 -c "
import json
pad='y'*(400*1024)
print(json.dumps({'html':'<!DOCTYPE html><html><head><title>okbig</title></head><body><p>'+pad+'</p></body></html>'}))
" > /tmp/_okbig.json
assert_eq "400KB doc -> 201"    201 "$(code -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' --data-binary @/tmp/_okbig.json)"

# ------------------------------------------------------ versioning + dedup
sect "11. Versioning, dedup, idempotency"
A='<!DOCTYPE html><html><head><title>VA</title></head><body>alpha</body></html>'
B='<!DOCTYPE html><html><head><title>VB</title></head><body>beta different</body></html>'
r=$(upload_html "$A"); VD=$(printf '%s' "${r#*$'\t'}" | jqf draft_id)
v1=$(printf '%s' "${r#*$'\t'}" | jqf version_number)
d1=$(printf '%s' "${r#*$'\t'}" | jqf content_deduplicated)
assert_eq "first upload is v1" 1 "$v1"
assert_eq "first upload not deduped" false "$d1"
r=$(upload_html "$B" "$VD"); v2=$(printf '%s' "${r#*$'\t'}" | jqf version_number); d2=$(printf '%s' "${r#*$'\t'}" | jqf content_deduplicated)
assert_eq "different bytes -> v2" 2 "$v2"
assert_eq "different bytes NOT deduped" false "$d2"
r=$(upload_html "$A" "$VD"); v3=$(printf '%s' "${r#*$'\t'}" | jqf version_number); d3=$(printf '%s' "${r#*$'\t'}" | jqf content_deduplicated)
assert_eq "repeat bytes -> v3" 3 "$v3"
assert_eq "repeat bytes DEDUPED" true "$d3"
curl -s "$CONTENT/d/$VD/v/1" -o /tmp/_v1; curl -s "$CONTENT/d/$VD/v/2" -o /tmp/_v2; curl -s "$CONTENT/d/$VD/v/3" -o /tmp/_v3
if cmp -s /tmp/_v1 /tmp/_v3; then ok "v1 and v3 serve identical bytes"; else bad "v1==v3" "differ"; fi
if cmp -s /tmp/_v1 /tmp/_v2; then bad "v1!=v2" "identical but should differ"; else ok "v1 and v2 serve different bytes"; fi
assert_contains "latest serves newest version" "VA" "$(body "$CONTENT/d/$VD")"
assert_eq "old version still reachable" 200 "$(code "$CONTENT/d/$VD/v/1")"
assert_eq "nonexistent version -> 404"  404 "$(code "$CONTENT/d/$VD/v/9999")"
assert_eq "version 0 -> 404"            404 "$(code "$CONTENT/d/$VD/v/0")"
assert_eq "negative version -> 404"     404 "$(code "$CONTENT/d/$VD/v/-1")"
# idempotency
IDK="brutal-$RANDOM$RANDOM"
i1=$(upload_raw "$(mkjson "$A" "$VD")" -H "idempotency-key: $IDK")
i2=$(upload_raw "$(mkjson "$A" "$VD")" -H "idempotency-key: $IDK")
n1=$(printf '%s' "${i1#*$'\t'}" | jqf version_number); n2=$(printf '%s' "${i2#*$'\t'}" | jqf version_number)
rep=$(printf '%s' "${i2#*$'\t'}" | jqf idempotent_replay)
assert_eq "idempotent replay same version" "$n1" "$n2"
assert_eq "idempotent_replay flag true"    true  "$rep"

# ------------------------------------------------- conditional requests / cache
sect "11b. Markdown support (rendered at /d/:id, byte-exact source at /raw)"
# md_upload <markdown> [filename] -> "HTTPCODE<TAB>BODY"
md_upload() {
  local body
  body=$(python3 -c "
import json,sys
o={'markdown':sys.argv[1]}
if len(sys.argv)>2 and sys.argv[2]: o['filename']=sys.argv[2]
print(json.dumps(o))" "$1" "${2:-}")
  upload_raw "$body"
}
MD_SRC='# Brutal MD

Body with **bold**, `code`, and a [link](https://example.com).

| a | b |
|---|---|
| 1 | 2 |

- [x] done
- [ ] open
'
r=$(md_upload "$MD_SRC" "brutal.md")
hc="${r%%$'\t'*}"; bd="${r#*$'\t'}"
assert_eq "md upload accepted" 201 "$hc"
MD_ID=$(printf '%s' "$bd" | jqf draft_id)
assert_eq "response reports source_format=md" "md" "$(printf '%s' "$bd" | jqf source_format)"
assert_eq "title extracted from H1" "Brutal MD" "$(printf '%s' "$bd" | jqf title)"

if [ -n "$MD_ID" ]; then
  # /d/:id must be RENDERED html a human can read
  curl -s "$CONTENT/d/$MD_ID" -o /tmp/_md_rendered.html
  assert_contains "rendered output has <h1>"    "<h1"       "$(cat /tmp/_md_rendered.html)"
  assert_contains "rendered output has <table>" "<table>"   "$(cat /tmp/_md_rendered.html)"
  assert_contains "rendered output has <strong>" "<strong>" "$(cat /tmp/_md_rendered.html)"
  assert_eq "rendered content-type is html" "text/html; charset=utf-8" \
    "$(curl -sI "$CONTENT/d/$MD_ID" | tr -d '\r' | awk 'tolower($1)=="content-type:"{$1="";sub(/^ /,"");print}')"
  # GFM task lists must NOT emit <input> — it is a form control the policy blocks, so
  # the renderer substitutes inert ballot glyphs. Regression guard for a real defect.
  if grep -qi '<input' /tmp/_md_rendered.html; then
    bad "no <input> in rendered md" "found <input> (form control)"
  else ok "no <input> in rendered md"; fi
  assert_contains "task glyph rendered" "task-box" "$(cat /tmp/_md_rendered.html)"

  # /raw must be the EXACT markdown source — the byte-for-byte promise for md
  printf '%s' "$MD_SRC" > /tmp/_md_src.md
  curl -s "$CONTENT/d/$MD_ID/raw" -o /tmp/_md_raw.md
  if cmp -s /tmp/_md_src.md /tmp/_md_raw.md; then ok "md /raw is byte-for-byte source"; else bad "md /raw byte-for-byte" "differs"; fi
  assert_eq "raw content-type is markdown" "text/markdown; charset=utf-8" \
    "$(curl -sI "$CONTENT/d/$MD_ID/raw" | tr -d '\r' | awk 'tolower($1)=="content-type:"{$1="";sub(/^ /,"");print}')"
  assert_contains "format header present" "md" \
    "$(curl -sI "$CONTENT/d/$MD_ID" | tr -d '\r' | tr 'A-Z' 'a-z' | grep x-agentdraft-format)"
fi

# Markdown permits raw HTML passthrough, so rendering must NOT be treated as
# sanitising: hostile md has to be rejected by the SAME validator.
for entry in \
  'md script|# T

<script>alert(1)</script>
' \
  'md onerror|# T

<img src=x onerror="alert(1)">
' \
  'md iframe|# T

<iframe src="https://evil.example"></iframe>
' \
  'md js link|# T

<a href="javascript:alert(1)">x</a>
' \
; do
  n="${entry%%|*}"; h="${entry#*|}"
  r=$(md_upload "$h" "evil.md"); assert_eq "reject: $n" 422 "${r%%$'\t'*}"
done

# format inferred from the FILENAME alone (agents send bytes in `html` + a .md name)
r=$(upload_raw "$(python3 -c "
import json;print(json.dumps({'html':'# Inferred\n\nBody.\n','filename':'inferred.md'}))")")
assert_eq "md inferred from .md filename" "md" "$(printf '%s' "${r#*$'\t'}" | jqf source_format)"

# HTML uploads must be completely unaffected by md support
r=$(upload_html '<!DOCTYPE html><html><head><title>StillHTML</title></head><body><h1>h</h1></body></html>')
HID=$(printf '%s' "${r#*$'\t'}" | jqf draft_id)
assert_eq "html upload still source_format=html" "html" "$(printf '%s' "${r#*$'\t'}" | jqf source_format)"
if [ -n "$HID" ]; then
  curl -s "$CONTENT/d/$HID" -o /tmp/_h_a.html; curl -s "$CONTENT/d/$HID/raw" -o /tmp/_h_b.html
  if cmp -s /tmp/_h_a.html /tmp/_h_b.html; then ok "html: /d and /raw identical"; else bad "html /d vs /raw" "differ"; fi
fi

sect "12. Conditional requests (cold AND warm cache)"
r=$(upload_html '<!DOCTYPE html><html><head><title>Cond</title></head><body>conditional</body></html>')
CD=$(printf '%s' "${r#*$'\t'}" | jqf draft_id)
ET=$(curl -sI "$CONTENT/d/$CD" | tr -d '\r' | awk 'tolower($1)=="etag:"{print $2}')
if [ -z "$ET" ]; then bad "etag present" "no etag header"; else
  ok "etag present"
  for phase in cold warm; do
    if [ "$phase" = warm ]; then for _ in 1 2 3; do curl -s -o /dev/null "$CONTENT/d/$CD"; done; sleep 2; fi
    assert_eq "[$phase] exact tag -> 304"    304 "$(code "$CONTENT/d/$CD" -H "If-None-Match: $ET")"
    assert_eq "[$phase] wildcard -> 304"     304 "$(code "$CONTENT/d/$CD" -H 'If-None-Match: *')"
    assert_eq "[$phase] weak W/ -> 304"      304 "$(code "$CONTENT/d/$CD" -H "If-None-Match: W/$ET")"
    assert_eq "[$phase] multi-tag -> 304"    304 "$(code "$CONTENT/d/$CD" -H "If-None-Match: \"aaa\", $ET, \"bbb\"")"
    assert_eq "[$phase] wrong tag -> 200"    200 "$(code "$CONTENT/d/$CD" -H 'If-None-Match: "nope"')"
    assert_eq "[$phase] no header -> 200"    200 "$(code "$CONTENT/d/$CD")"
  done
  assert_eq "304 has empty body" 0 "$(curl -s -o /dev/null -w '%{size_download}' "$CONTENT/d/$CD" -H "If-None-Match: $ET")"
fi
assert_eq "HEAD -> 200"                200 "$(code -I "$CONTENT/d/$CD")"
assert_ne "HEAD sends Content-Length"  ""  "$(curl -sI "$CONTENT/d/$CD" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}')"
assert_contains "versioned URL immutable cache" "immutable" "$(curl -sI "$CONTENT/d/$CD/v/1" | tr 'A-Z' 'a-z')"

# ------------------------------------------------------------ methods & routes
sect "13. Method and route hygiene"
assert_eq "POST to content origin -> 405"  405 "$(code -X POST "$CONTENT/d/$CD")"
assert_eq "DELETE to content -> 405"       405 "$(code -X DELETE "$CONTENT/d/$CD")"
assert_eq "PUT to content -> 405"          405 "$(code -X PUT "$CONTENT/d/$CD")"
assert_eq "unknown api route -> 404"       404 "$(code "$API/api/nope")"
assert_eq "content root -> 200"            200 "$(code "$CONTENT/")"
assert_eq "content bad path -> 404"        404 "$(code "$CONTENT/not-a-draft-path")"
assert_eq "raw alias -> 200"               200 "$(code "$CONTENT/d/$CD/raw")"
if cmp -s <(body "$CONTENT/d/$CD") <(body "$CONTENT/d/$CD/raw"); then ok "raw alias serves same bytes"; else bad "raw alias" "differs"; fi

# ------------------------------------------------------------ soft delete
sect "14. Soft delete revokes public access — INCLUDING warm cache (security regression)"
# REGRESSION GUARD: the content worker once answered from the Cache API *before* checking
# the draft's status in D1, so a soft-deleted draft kept serving its bytes publicly from
# any colo that had it cached. Cache purging cannot fix that (the Cache API is per-colo),
# so the status gate must run on every request. This test WARMS THE CACHE FIRST — without
# that, the bug is invisible.
SECRET_MARK="CLASSIFIED-$RANDOM"
r=$(upload_html "<!DOCTYPE html><html><head><title>Doomed</title></head><body>$SECRET_MARK</body></html>")
DD=$(printf '%s' "${r#*$'\t'}" | jqf draft_id)
assert_eq "before delete -> 200" 200 "$(code "$CONTENT/d/$DD")"
for _ in 1 2 3 4 5; do curl -s -o /dev/null "$CONTENT/d/$DD"; done   # warm it hard
assert_contains "cached copy readable pre-delete" "$SECRET_MARK" "$(body "$CONTENT/d/$DD")"
assert_eq "delete -> 200"        200 "$(code -X DELETE "$API/api/drafts/$DD" -H "authorization: Bearer $KEY")"
sleep 2
hc=$(code "$CONTENT/d/$DD")
case "$hc" in 404|410|451) ok "after delete latest URL gone ($hc)";; *) bad "after delete latest URL gone" "got $hc";; esac
assert_eq "after delete versioned URL gone" 404 "$(code "$CONTENT/d/$DD/v/1")"
if body "$CONTENT/d/$DD" | grep -q "$SECRET_MARK"; then
  bad "deleted content NOT readable" "cached body still leaks $SECRET_MARK"
else ok "deleted content NOT readable (no cache leak)"; fi
# hammer it: different colos may hold independent cached copies
LEAKS=0
for _ in $(seq 1 6); do
  if body "$CONTENT/d/$DD" | grep -q "$SECRET_MARK"; then LEAKS=$((LEAKS+1)); fi
done
assert_eq "no leak across 6 repeat reads" 0 "$LEAKS"
assert_eq "deleted draft hidden from API" 404 "$(code "$API/api/drafts/$DD" -H "authorization: Bearer $KEY")"

# ------------------------------------------------------------ concurrency
sect "15. Concurrent uploads to one draft — no lost/duplicate versions"
r=$(upload_html '<!DOCTYPE html><html><head><title>Race</title></head><body>seed</body></html>')
RD=$(printf '%s' "${r#*$'\t'}" | jqf draft_id)
BEFORE=$(body "$API/api/drafts/$RD" -H "authorization: Bearer $KEY" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('versions',[])))")
for i in $(seq 1 8); do
  ( curl -s -o /dev/null -X POST "$API/api/upload" -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
      -d "$(mkjson "<!DOCTYPE html><html><head><title>Race $i</title></head><body>concurrent body number $i</body></html>" "$RD")" ) &
done
wait
sleep 2
AFTER_JSON=$(body "$API/api/drafts/$RD" -H "authorization: Bearer $KEY")
AFTER=$(printf '%s' "$AFTER_JSON" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('versions',[])))")
UNIQ=$(printf '%s' "$AFTER_JSON" | python3 -c "
import sys,json
vs=json.load(sys.stdin).get('versions',[])
ns=[v['version_number'] for v in vs]
print(len(set(ns)))
")
assert_eq "8 concurrent uploads all recorded" "$((BEFORE+8))" "$AFTER"
assert_eq "no duplicate version numbers"      "$AFTER"        "$UNIQ"
assert_eq "latest still serves 200"           200 "$(code "$CONTENT/d/$RD")"

# ------------------------------------------------------------ summary
printf "\n${BOLD}────────────────────────────────────────${OFF}\n"
printf "${BOLD}passed=%d failed=%d${OFF}\n" "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf "${RED}failures:${OFF}\n"
  for f in "${FAILED_NAMES[@]}"; do printf "  - %s\n" "$f"; done
  exit 1
fi
printf "${GREEN}ALL ASSERTIONS PASSED${OFF}\n"
