---
name: places
description: >-
  City exploration coordinator using Google Maps APIs. Use this skill whenever the user
  wants to find a place, search for nearby restaurants/cafes/shops, get directions between
  locations (by bus, metro, walking, driving, cycling), compare travel times to multiple
  destinations, look up an address or get coordinates, check what time zone a location is in,
  or validate/standardize an address. Also use when the user says things like "how do I get
  there", "what's nearby", "find me a restaurant", "route to", "how far is", "what time is it in",
  or any city navigation and exploration task. This skill coordinates multiple Google APIs
  together — use it even if the user's request requires chaining several steps
  (e.g., geocode an address, then find nearby places, then get directions).
---

# Places — City Exploration Coordinator

This skill coordinates multiple Google Maps APIs to help with city exploration: finding places, getting directions with transit, comparing distances, geocoding addresses, and more. Each section below is a capability you can use independently or chain together.

## Setup

This skill requires a Google Cloud project with a Maps API key. One key covers all APIs below.

### Step 1: Create a Google Cloud project

If you don't have one, create a project at https://console.cloud.google.com and enable billing.

### Step 2: Enable these APIs

Go to **Google Cloud Console > APIs & Services > Library** and enable all of the following:

| API to enable | Used for |
|--------------|----------|
| Places API (New) | Text Search, Nearby Search, Place Details |
| Routes API | Directions, transit routes, distance matrix |
| Geocoding API | Address ↔ coordinate conversion |
| Time Zone API | Local time at any location |
| Address Validation API | Verify and standardize addresses |

You can also enable them via `gcloud`:
```bash
gcloud services enable places.googleapis.com routes.googleapis.com geocoding-backend.googleapis.com timezone-backend.googleapis.com addressvalidation.googleapis.com --project=YOUR_PROJECT_ID
```

### Step 3: Create an API key

Go to **Google Cloud Console > APIs & Services > Credentials > Create Credentials > API Key**. Restrict the key to the 5 APIs listed above.

### Step 4: Set the environment variable

```bash
export GOOGLE_MAPS_API_KEY="your-api-key-here"
```

Add this to your shell profile (`.zshrc`, `.bashrc`) so it persists across sessions.

### Verify

```bash
echo "$GOOGLE_MAPS_API_KEY"
```

If empty, stop and ask the user to complete the setup above.

---

## How to Choose

Match the user's intent to the right capability — and chain them when needed:

| User intent | Capability | Chain with |
|------------|-----------|------------|
| "Find [place] in [city]" | Text Search | Place Details for more info |
| "Restaurants near [location]" | Nearby Search | Geocoding if location is an address |
| "Tell me more about [place]" | Place Details | Text Search to get place ID first |
| "How do I get from A to B" | Routes | Geocoding if A or B are addresses |
| "Take the bus to [place]" | Routes (transit) | Text Search to resolve place name |
| "Which is closer, X or Y?" | Distance Matrix | Geocoding + Text Search as needed |
| "What's the address of [coords]" | Geocoding (reverse) | — |
| "Coordinates for [address]" | Geocoding (forward) | — |
| "What time is it in [city]" | Time Zone | Geocoding to get coordinates |
| "Is this address valid?" | Address Validation | — |

**Chaining example:** "Find the best route by bus from 350 Rue Saint-Paul to the nearest sushi restaurant"
1. Geocode "350 Rue Saint-Paul" → get coordinates for the nearby search center
2. Nearby Search at those coordinates for `includedTypes: ["sushi_restaurant"]`
3. Routes from origin address to the best result, with `travelMode: TRANSIT`

Note: Routes accepts addresses directly via `{"address": "..."}`, so you only need Geocoding when you need raw coordinates (e.g., for Nearby Search center point or Time Zone lookup).

---

## 1. Text Search

Find places by name or description anywhere in the world.

```bash
curl -s -X POST \
  'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount' \
  -d '{"textQuery": "SEARCH_QUERY", "maxResultCount": 5}'
```

**Response:**
```json
{
  "places": [
    {
      "id": "ChIJLU7jZClu5kcR4PcOOO6p3I0",
      "displayName": {"text": "Eiffel Tower", "languageCode": "en"},
      "formattedAddress": "Av. Gustave Eiffel, 75007 Paris, France",
      "location": {"latitude": 48.8583701, "longitude": 2.2944813},
      "rating": 4.7,
      "userRatingCount": 248562
    }
  ]
}
```

**Extract with jq:**
```bash
| jq '.places[] | {name: .displayName.text, address: .formattedAddress, lat: .location.latitude, lng: .location.longitude, place_id: .id, rating: .rating}'
```

**Bias results near a location** (add to request body):
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

---

## 2. Nearby Search

Find places within a radius of a point, filtered by type. Unlike Text Search, this is purely location-based — no text query, just type filtering.

```bash
curl -s -X POST \
  'https://places.googleapis.com/v1/places:searchNearby' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount' \
  -d '{
    "includedTypes": ["restaurant"],
    "maxResultCount": 10,
    "locationRestriction": {
      "circle": {
        "center": {"latitude": 45.5017, "longitude": -73.5673},
        "radius": 1000.0
      }
    }
  }'
```

**Key parameters:**
- `includedTypes` — array of place types (400+ available). Common values by category:
  - **Food:** `restaurant`, `cafe`, `coffee_shop`, `bar`, `bakery`, `fast_food_restaurant`, `pizza_restaurant`, `sushi_restaurant`, `italian_restaurant`, `chinese_restaurant`, `mexican_restaurant`, `indian_restaurant`, `thai_restaurant`, `seafood_restaurant`, `steak_house`, `ice_cream_shop`, `brewery`, `wine_bar`
  - **Culture:** `museum`, `art_gallery`, `performing_arts_theater`, `tourist_attraction`
  - **Recreation:** `park`, `national_park`, `botanical_garden`, `hiking_area`, `playground`, `stadium`, `amusement_park`, `zoo`
  - **Shopping:** `shopping_mall`, `grocery_store`, `supermarket`, `book_store`, `clothing_store`, `department_store`
  - **Transport:** `bus_station`, `train_station`, `subway_station`, `gas_station`, `parking`
  - **Services:** `bank`, `atm`, `post_office`, `library`, `pharmacy`, `hospital`, `gym`, `hotel`
- `locationRestriction.circle.radius` — in meters (max 50000)
- `maxResultCount` — 1 to 20
- `rankPreference` — `POPULARITY` (default) or `DISTANCE`

**Response format** is identical to Text Search. Extract the same way.

---

## 3. Place Details

Get rich information about a specific place using its place ID (from Text Search or Nearby Search results).

```bash
curl -s \
  "https://places.googleapis.com/v1/places/PLACE_ID" \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: id,displayName,formattedAddress,location,rating,userRatingCount,currentOpeningHours,nationalPhoneNumber,websiteUri,types,priceLevel,editorialSummary'
```

Replace `PLACE_ID` with the actual ID (e.g., `ChIJLU7jZClu5kcR4PcOOO6p3I0`).

**Response:**
```json
{
  "id": "ChIJLU7jZClu5kcR4PcOOO6p3I0",
  "displayName": {"text": "Eiffel Tower"},
  "formattedAddress": "Av. Gustave Eiffel, 75007 Paris, France",
  "location": {"latitude": 48.8583701, "longitude": 2.2944813},
  "rating": 4.7,
  "userRatingCount": 248562,
  "currentOpeningHours": {
    "openNow": true,
    "weekdayDescriptions": [
      "Monday: 9:30 AM – 11:45 PM",
      "Tuesday: 9:30 AM – 11:45 PM"
    ]
  },
  "nationalPhoneNumber": "01 23 45 67 89",
  "websiteUri": "https://www.toureiffel.paris",
  "types": ["tourist_attraction", "point_of_interest"],
  "priceLevel": "PRICE_LEVEL_MODERATE",
  "editorialSummary": {"text": "Iconic iron lattice tower..."}
}
```

**Present results as:** name, address, rating (X/5 with N reviews), open now yes/no, hours, phone, website, price level.

---

## 4. Geocoding

Convert between addresses and coordinates. Use this before Routes or Nearby Search when the user provides an address instead of coordinates.

### Forward (address → coordinates)

```bash
curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("ADDRESS_HERE"))')&key=$GOOGLE_MAPS_API_KEY"
```

**Response:**
```json
{
  "results": [
    {
      "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "geometry": {
        "location": {"lat": 37.4224764, "lng": -122.0842499}
      },
      "place_id": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
      "address_components": [
        {"long_name": "1600", "types": ["street_number"]},
        {"long_name": "Amphitheatre Parkway", "types": ["route"]},
        {"long_name": "Mountain View", "types": ["locality"]},
        {"long_name": "CA", "types": ["administrative_area_level_1"]},
        {"long_name": "United States", "types": ["country"]},
        {"long_name": "94043", "types": ["postal_code"]}
      ]
    }
  ],
  "status": "OK"
}
```

**Extract with jq:**
```bash
| jq '.results[0] | {address: .formatted_address, lat: .geometry.location.lat, lng: .geometry.location.lng, place_id: .place_id}'
```

### Reverse (coordinates → address)

```bash
curl -s "https://maps.googleapis.com/maps/api/geocode/json?latlng=45.5017,-73.5673&key=$GOOGLE_MAPS_API_KEY"
```

Same response structure. The first result is the most specific address.

---

## 5. Routes & Transit

Get directions between two locations with step-by-step instructions. Supports driving, walking, cycling, and public transit with detailed bus/metro information.

```bash
curl -s -X POST \
  'https://routes.googleapis.com/directions/v2:computeRoutes' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues,routes.legs.steps.transitDetails,routes.legs.duration,routes.legs.distanceMeters' \
  -d '{
    "origin": {
      "location": {
        "latLng": {"latitude": 45.5017, "longitude": -73.5673}
      }
    },
    "destination": {
      "location": {
        "latLng": {"latitude": 45.5088, "longitude": -73.5540}
      }
    },
    "travelMode": "TRANSIT",
    "computeAlternativeRoutes": true
  }'
```

### Travel modes

| Mode | Value | Notes |
|------|-------|-------|
| Driving | `DRIVE` | Default, includes traffic |
| Walking | `WALK` | Pedestrian paths |
| Cycling | `BICYCLE` | Bike lanes where available |
| Transit | `TRANSIT` | Bus, metro, train — includes line details |

### Origin/destination formats

**By coordinates:**
```json
{"location": {"latLng": {"latitude": 45.5017, "longitude": -73.5673}}}
```

**By place ID** (from Text Search or Geocoding):
```json
{"placeId": "ChIJLU7jZClu5kcR4PcOOO6p3I0"}
```

**By address:**
```json
{"address": "350 Rue Saint-Paul, Montreal, QC"}
```

### Transit options

Add to the request body for transit-specific preferences:

```json
{
  "travelMode": "TRANSIT",
  "transitPreferences": {
    "routingPreference": "LESS_WALKING",
    "allowedTravelModes": ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL"]
  },
  "departureTime": "2026-03-15T09:00:00Z"
}
```

`routingPreference` options: `LESS_WALKING`, `FEWER_TRANSFERS`

### Response

```json
{
  "routes": [
    {
      "duration": "1320s",
      "distanceMeters": 4500,
      "legs": [
        {
          "duration": "1320s",
          "distanceMeters": 4500,
          "steps": [
            {
              "travelMode": "WALK",
              "navigationInstruction": {"instructions": "Walk to Aeroporto"},
              "localizedValues": {"distance": {"text": "200 m"}, "staticDuration": {"text": "3 mins"}}
            },
            {
              "travelMode": "TRANSIT",
              "transitDetails": {
                "stopDetails": {
                  "departureStop": {"name": "Aeroporto"},
                  "departureTime": "2026-03-15T10:32:10Z",
                  "arrivalStop": {"name": "Saldanha"},
                  "arrivalTime": "2026-03-15T10:49:42Z"
                },
                "localizedValues": {
                  "departureTime": {"time": {"text": "10:32 AM"}},
                  "arrivalTime": {"time": {"text": "10:49 AM"}}
                },
                "headsign": "São Sebastião",
                "transitLine": {
                  "name": "Vermelha",
                  "nameShort": "Vm",
                  "color": "#f23061",
                  "vehicle": {"type": "SUBWAY"},
                  "agencies": [{"name": "Metropolitano de Lisboa"}]
                },
                "stopCount": 11
              }
            },
            {
              "travelMode": "WALK",
              "navigationInstruction": {"instructions": "Walk to destination"}
            }
          ]
        }
      ]
    }
  ]
}
```

**Present transit results as:** total duration, then each step: walk X min → take [Line Name] ([BUS/SUBWAY]) from [Departure Stop] to [Arrival Stop] (departs X:XX, arrives X:XX, N stops) → walk X min.

**Note:** Transit directions depend on the transit agency publishing schedule data to Google. If no transit routes are returned, transit data may not be available for that area.

---

## 6. Distance Matrix

Compare travel times and distances from one or more origins to multiple destinations. Ideal for "which of these 3 restaurants is closest by bus?"

```bash
curl -s -X POST \
  'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -H 'X-Goog-FieldMask: originIndex,destinationIndex,duration,distanceMeters,status,condition' \
  -d '{
    "origins": [
      {
        "waypoint": {"location": {"latLng": {"latitude": 45.5017, "longitude": -73.5673}}}
      }
    ],
    "destinations": [
      {
        "waypoint": {"location": {"latLng": {"latitude": 45.5088, "longitude": -73.5540}}}
      },
      {
        "waypoint": {"location": {"latLng": {"latitude": 45.5048, "longitude": -73.5772}}}
      }
    ],
    "travelMode": "TRANSIT"
  }'
```

**Response** is a JSON array of origin→destination pairs:

```json
[
  {"originIndex": 0, "destinationIndex": 0, "duration": "1320s", "distanceMeters": 4500, "status": {}, "condition": "ROUTE_EXISTS"},
  {"originIndex": 0, "destinationIndex": 1, "duration": "980s", "distanceMeters": 2100, "status": {}, "condition": "ROUTE_EXISTS"}
]
```

`condition` is `ROUTE_EXISTS` on success or `ROUTE_NOT_FOUND` if no route exists.

**Present as a comparison table:**

| Destination | Duration | Distance |
|------------|----------|----------|
| Restaurant A | 22 min | 4.5 km |
| Restaurant B | 16 min | 2.1 km |

---

## 7. Time Zone

Get the time zone and local time for any location.

```bash
curl -s "https://maps.googleapis.com/maps/api/timezone/json?location=LAT,LNG&timestamp=$(date +%s)&key=$GOOGLE_MAPS_API_KEY"
```

Replace `LAT,LNG` with actual coordinates (e.g., `45.5017,-73.5673`).

**Response:**
```json
{
  "dstOffset": 3600,
  "rawOffset": -18000,
  "status": "OK",
  "timeZoneId": "America/Toronto",
  "timeZoneName": "Eastern Daylight Time"
}
```

**Present as:** Time zone name, timezone ID, and compute local time:
- UTC offset = `rawOffset + dstOffset` (in seconds)
- Local time = UTC time + offset

---

## 8. Address Validation

Verify whether an address is real and get a standardized version.

```bash
curl -s -X POST \
  'https://addressvalidation.googleapis.com/v1:validateAddress' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $GOOGLE_MAPS_API_KEY" \
  -d '{
    "address": {
      "regionCode": "CA",
      "addressLines": ["ADDRESS_HERE"]
    }
  }'
```

**Response (key fields):**
```json
{
  "result": {
    "verdict": {
      "validationGranularity": "PREMISE",
      "geocodeGranularity": "PREMISE",
      "hasUnconfirmedComponents": false,
      "addressComplete": true
    },
    "address": {
      "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043-1351, USA",
      "postalAddress": {
        "regionCode": "US",
        "postalCode": "94043-1351",
        "administrativeArea": "CA",
        "locality": "Mountain View",
        "addressLines": ["1600 Amphitheatre Pkwy"]
      }
    },
    "geocode": {
      "location": {"latitude": 37.4220656, "longitude": -122.0862784}
    }
  }
}
```

**Present as:**
- Valid: yes/no (based on `addressComplete`)
- Standardized address: `formattedAddress`
- Any unconfirmed components flagged
- Coordinates if available

---

## Error Handling

All APIs share these common error patterns:

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad request | Check required fields are present and valid |
| 403 | API key invalid or API not enabled | Tell user to enable the specific API in Google Cloud Console |
| 429 | Rate limit exceeded | Wait a moment and retry |

For 403 errors, tell the user to:
1. Verify their API key is correct
2. Enable the specific API in Google Cloud Console (APIs & Services > Library)
3. Check that billing is enabled on the project
