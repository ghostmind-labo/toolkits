---
name: places
description: >-
  Search for places and return location data (name, coordinates, address, place ID).
  Use this skill whenever the user wants to find a place, look up a location,
  get coordinates or lat/lng for an address, find restaurants, businesses, landmarks,
  or search for any kind of place by name or description. Also use when the user
  mentions needing geographic data, mapping info, or place details for storage.
---

# Places

Search for places using the Google Places API v1 Text Search endpoint and return structured location data. Results include the place name, latitude, longitude, formatted address, and place ID — everything needed to store in a database or display on a map.

## Prerequisites

Before making any request, verify the API key is available:

```bash
echo "$GOOGLE_PLACES_API_KEY"
```

If the variable is empty or unset, stop and ask the user to set it:
```bash
export GOOGLE_PLACES_API_KEY="their-api-key"
```

## Search Request

Use this exact curl command, replacing `SEARCH_QUERY` with the user's search term:

```bash
curl -s -X POST \
  'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location' \
  -d '{"textQuery": "SEARCH_QUERY"}'
```

Always use the `-s` flag to suppress curl progress output.

## Response Format

The API returns JSON in this structure:

```json
{
  "places": [
    {
      "id": "ChIJLU7jZClu5kcR4PcOOO6p3I0",
      "displayName": {
        "text": "Eiffel Tower",
        "languageCode": "en"
      },
      "formattedAddress": "Av. Gustave Eiffel, 75007 Paris, France",
      "location": {
        "latitude": 48.8583701,
        "longitude": 2.2944813
      }
    }
  ]
}
```

## Presenting Results

Extract and present these fields from each result:

| Field      | JSON Path                |
|------------|--------------------------|
| name       | `displayName.text`       |
| address    | `formattedAddress`       |
| latitude   | `location.latitude`      |
| longitude  | `location.longitude`     |
| place_id   | `id`                     |

If `jq` is available, use it to extract clean output:

```bash
curl -s -X POST \
  'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_PLACES_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location' \
  -d '{"textQuery": "SEARCH_QUERY"}' \
| jq '.places[] | {name: .displayName.text, address: .formattedAddress, latitude: .location.latitude, longitude: .location.longitude, place_id: .id}'
```

## Optional Parameters

Add these to the request body JSON as needed:

**Limit results:**
```json
{"textQuery": "coffee shops in Montreal", "maxResultCount": 5}
```

**Search near a specific location** (radius in meters):
```json
{
  "textQuery": "restaurants",
  "maxResultCount": 10,
  "locationBias": {
    "circle": {
      "center": {"latitude": 45.5017, "longitude": -73.5673},
      "radius": 2000.0
    }
  }
}
```

## Error Handling

| Status | Meaning                                          |
|--------|--------------------------------------------------|
| 400    | Bad request — check that textQuery is not empty   |
| 403    | API key is invalid or Places API is not enabled in Google Cloud Console |
| 429    | Rate limit exceeded — wait and retry              |

If you get a 403, tell the user to:
1. Verify their API key is correct
2. Enable "Places API (New)" in their Google Cloud Console
3. Check that billing is enabled on the project
