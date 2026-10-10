#!/usr/bin/env bash
# Lays each beat's narration onto a silent video at the moment the beat starts.
#   mux.sh <video.mp4> <starts.json> <audio-dir> <out.mp4>
# starts.json maps a beat id to its start time in seconds; <audio-dir> holds <id>.mp3.
set -euo pipefail
video="$1" starts="$2" audio="$3" out="$4"

inputs=() filter="" labels="" i=1
while IFS=$'\t' read -r id start; do
  inputs+=(-i "$audio/$id.mp3")
  ms=$(awk -v s="$start" 'BEGIN { printf "%d", s * 1000 }')
  filter+="[$i:a]adelay=$ms:all=1[a$i];"
  labels+="[a$i]"
  i=$((i + 1))
done < <(jq -r 'to_entries[] | [.key, .value] | @tsv' "$starts")

ffmpeg -loglevel error -y -i "$video" "${inputs[@]}" \
  -filter_complex "${filter}${labels}amix=inputs=$((i - 1)):normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac "$out"
echo "$out"
