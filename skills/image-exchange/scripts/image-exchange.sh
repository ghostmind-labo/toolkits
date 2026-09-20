#!/usr/bin/env bash
# image-exchange — move images between machines, projects and agents through a
# Google Cloud Storage bucket, using whatever account gcloud is logged into.
#
#   image-exchange.sh export <file>... [--prefix p] [--name n] [--json]
#   image-exchange.sh import <url|gs://...>... [--out dir] [--json]
#   image-exchange.sh list [prefix] [--limit n]
#   image-exchange.sh setup
#   image-exchange.sh whoami
#
# Configuration (flag > environment > ~/.env > default):
#   --project / GCP_PROJECT_ID   GCP project owning the bucket (else gcloud's core/project)
#   --bucket  / GCS_IMAGE_BUCKET bucket name (default: <project>-images)
#   GCS_IMAGE_LOCATION           location used when creating the bucket (default: us-central1)
#
# Exported files print one URL per line on stdout:
#   https://storage.googleapis.com/<bucket>/<prefix>/<timestamp>-<slug>.<ext>
# The bucket is private: that URL is the handle to pass around, and `import`
# reads it back through gcloud on any machine logged into an account with access.
# Imported files print one local path per line on stdout.
# Everything else goes to stderr.

set -euo pipefail

die() { echo "error: $*" >&2; exit 1; }
note() { echo "$*" >&2; }

command -v gcloud >/dev/null 2>&1 || die "gcloud not found on PATH (brew install --cask google-cloud-sdk)"

# --- config -------------------------------------------------------------------

# Pull a single KEY from ~/.env without sourcing the whole file.
env_file_value() {
  local key="$1"
  [ -f "$HOME/.env" ] || return 0
  { grep -E "^${key}=" "$HOME/.env" || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

PROJECT="${GCP_PROJECT_ID:-}"
BUCKET="${GCS_IMAGE_BUCKET:-}"
LOCATION="${GCS_IMAGE_LOCATION:-}"
[ -n "$PROJECT" ] || PROJECT="$(env_file_value GCP_PROJECT_ID)"
[ -n "$BUCKET" ]  || BUCKET="$(env_file_value GCS_IMAGE_BUCKET)"
[ -n "$LOCATION" ] || LOCATION="$(env_file_value GCS_IMAGE_LOCATION)"
[ -n "$LOCATION" ] || LOCATION="us-central1"

resolve_project() {
  [ -n "$PROJECT" ] && return 0
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  [ -n "$PROJECT" ] && [ "$PROJECT" != "(unset)" ] && return 0
  note "No project configured. Pass --project, set GCP_PROJECT_ID, or run: gcloud config set project <id>"
  note "Projects visible to the active account:"
  gcloud projects list --format='value(projectId)' 2>/dev/null | sed 's/^/  /' >&2 || true
  exit 1
}

resolve_bucket() {
  resolve_project
  [ -n "$BUCKET" ] || BUCKET="${PROJECT}-images"
}

active_account() {
  gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1
}

require_auth() {
  local acct
  acct="$(active_account)"
  [ -n "$acct" ] || die "no active gcloud account — run: gcloud auth login"
  if ! gcloud auth print-access-token >/dev/null 2>&1; then
    die "gcloud credential for $acct cannot refresh — run: gcloud auth login"
  fi
}

# Create the bucket if missing. It stays private: readers use `import` with a gcloud login.
ensure_bucket() {
  resolve_bucket
  if gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1; then
    return 0
  fi
  note "Bucket gs://${BUCKET} not found in project ${PROJECT}; creating it in ${LOCATION}..."
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" --location="$LOCATION" \
    --uniform-bucket-level-access --public-access-prevention >&2
  note "Bucket created (private)."
}

# --- helpers ------------------------------------------------------------------

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-60
}

# Turn any of the accepted forms into gs://bucket/key. Prints nothing for foreign URLs.
to_gs() {
  local u="$1"
  case "$u" in
    gs://*) echo "$u" ;;
    https://storage.googleapis.com/*) echo "gs://${u#https://storage.googleapis.com/}" ;;
    https://storage.cloud.google.com/*) echo "gs://${u#https://storage.cloud.google.com/}" ;;
    *) echo "" ;;
  esac
}

json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

# --- commands -----------------------------------------------------------------

cmd_whoami() {
  resolve_bucket
  echo "account:  $(active_account)"
  echo "project:  $PROJECT"
  echo "bucket:   gs://$BUCKET"
  echo "base url: https://storage.googleapis.com/$BUCKET/  (private; read with: import <url>)"
}

cmd_setup() {
  require_auth
  ensure_bucket
  cmd_whoami
}

cmd_export() {
  local prefix="images" name="" json=0
  local -a files=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --prefix) prefix="$2"; shift 2 ;;
      --name) name="$2"; shift 2 ;;
      --json) json=1; shift ;;
      --project|--bucket) shift 2 ;;
      -*) die "unknown flag for export: $1" ;;
      *) files+=("$1"); shift ;;
    esac
  done
  [ "${#files[@]}" -gt 0 ] || die "export needs at least one file"
  [ -n "$name" ] && [ "${#files[@]}" -gt 1 ] && die "--name only works with a single file"
  for f in "${files[@]}"; do [ -f "$f" ] || die "no such file: $f"; done

  require_auth
  ensure_bucket
  prefix="${prefix#/}"; prefix="${prefix%/}"

  local out_json="["
  local first=1
  for f in "${files[@]}"; do
    local base ext stem key
    base="$(basename "$f")"
    ext="${base##*.}"; [ "$ext" = "$base" ] && ext="" || ext=".$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
    stem="${base%.*}"
    if [ -n "$name" ]; then
      key="$name"
      case "$key" in *.*) ;; *) key="${key}${ext}" ;; esac
    else
      key="$(date +%Y%m%d-%H%M%S)-$(slugify "$stem")${ext}"
    fi
    [ -n "$prefix" ] && key="${prefix}/${key}"

    note "Uploading $f -> gs://${BUCKET}/${key}"
    gcloud storage cp "$f" "gs://${BUCKET}/${key}" >/dev/null 2>&1 \
      || die "upload failed for $f"

    local url="https://storage.googleapis.com/${BUCKET}/${key}"
    if [ "$json" -eq 1 ]; then
      [ "$first" -eq 1 ] || out_json+=","
      first=0
      out_json+="{\"file\":$(json_escape "$f"),\"gs\":$(json_escape "gs://${BUCKET}/${key}"),\"url\":$(json_escape "$url")}"
    else
      echo "$url"
    fi
  done
  [ "$json" -eq 1 ] && echo "${out_json}]"
  return 0
}

cmd_import() {
  local out="imported-images" json=0
  local -a srcs=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --out) out="$2"; shift 2 ;;
      --json) json=1; shift ;;
      --project|--bucket) shift 2 ;;
      -*) die "unknown flag for import: $1" ;;
      *) srcs+=("$1"); shift ;;
    esac
  done
  [ "${#srcs[@]}" -gt 0 ] || die "import needs at least one URL or gs:// path"
  mkdir -p "$out"

  local out_json="["
  local first=1
  for s in "${srcs[@]}"; do
    local gs dest base
    gs="$(to_gs "$s")"
    base="$(basename "${s%%\?*}")"
    dest="${out%/}/${base}"
    if [ -n "$gs" ]; then
      note "Downloading $gs -> $dest"
      if ! gcloud storage cp "$gs" "$dest" >/dev/null 2>&1; then
        # No access through gcloud: last try over plain HTTP in case the object is public.
        local http="https://storage.googleapis.com/${gs#gs://}"
        curl -fsSL "$http" -o "$dest" || die "download failed for $s — is gcloud logged into an account with access? (gcloud auth login)"
      fi
    else
      note "Fetching $s -> $dest"
      curl -fsSL "$s" -o "$dest" || die "download failed for $s"
    fi
    if [ "$json" -eq 1 ]; then
      [ "$first" -eq 1 ] || out_json+=","
      first=0
      out_json+="{\"source\":$(json_escape "$s"),\"path\":$(json_escape "$dest")}"
    else
      echo "$dest"
    fi
  done
  [ "$json" -eq 1 ] && echo "${out_json}]"
  return 0
}

cmd_list() {
  local prefix="" limit=50
  while [ $# -gt 0 ]; do
    case "$1" in
      --limit) limit="$2"; shift 2 ;;
      --project|--bucket) shift 2 ;;
      -*) die "unknown flag for list: $1" ;;
      *) prefix="$1"; shift ;;
    esac
  done
  require_auth
  resolve_bucket
  prefix="${prefix#/}"; prefix="${prefix%/}"
  local target="gs://${BUCKET}/"
  [ -n "$prefix" ] && target="gs://${BUCKET}/${prefix}/"
  gcloud storage ls -r "${target}**" 2>/dev/null \
    | grep -v '/$' | grep -v ':$' | grep '^gs://' \
    | sort -r | head -n "$limit" \
    | sed "s#^gs://#https://storage.googleapis.com/#"
}

# --- main ---------------------------------------------------------------------

# Global flags may appear anywhere; strip --project/--bucket before dispatch.
args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
set -- "${args[@]:-}"

cmd="${1:-}"
[ $# -gt 0 ] && shift || true
case "$cmd" in
  export) cmd_export "$@" ;;
  import) cmd_import "$@" ;;
  list) cmd_list "$@" ;;
  setup) cmd_setup ;;
  whoami) cmd_whoami ;;
  ""|-h|--help|help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown command: $cmd (export | import | list | setup | whoami)" ;;
esac
