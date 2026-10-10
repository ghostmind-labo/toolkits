#!/usr/bin/env bash
# Draws a random era, part of the world and discipline, so that the choice of a figure
# does not fall on the same famous few each time.
#   draw.sh [count]     prints <count> draws (default 3), one per line
set -euo pipefail

eras=(
  "antiquity (before 500)" "500 to 1000" "1000 to 1300" "the 1300s" "the 1400s" "the 1500s"
  "the 1600s" "the 1700s" "1800 to 1850" "1850 to 1900" "1900 to 1925" "1925 to 1950"
  "1950 to 1975" "1975 to 2000"
)
places=(
  "East Asia" "South Asia" "Southeast Asia" "Central Asia and Persia" "the Arab world"
  "Sub-Saharan Africa" "North Africa and the Mediterranean" "Southern Europe" "Western Europe"
  "Northern Europe" "Eastern Europe and Russia" "North America" "Latin America and the Caribbean"
  "Oceania and the Pacific"
)
fields=(
  "painting" "sculpture" "architecture" "music composition" "music performance" "poetry"
  "the novel" "theatre" "dance and choreography" "film" "photography" "typography and print"
  "textiles and fashion" "ceramics and craft" "garden and landscape" "cooking"
  "mathematics" "physics and astronomy" "medicine and biology" "civil and mechanical engineering"
  "computing" "cartography and navigation" "philosophy" "teaching and pedagogy"
  "industrial and furniture design" "calligraphy"
)

for _ in $(seq "${1:-3}"); do
  echo "${eras[RANDOM % ${#eras[@]}]} · ${places[RANDOM % ${#places[@]}]} · ${fields[RANDOM % ${#fields[@]}]}"
done
