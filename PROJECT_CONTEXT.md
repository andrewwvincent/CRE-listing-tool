# CRE Listings Portal - Project Context

## Overview

This is a Commercial Real Estate (CRE) listings portal that displays property listings on a Leaflet map with multiple overlay layers for site selection analysis. The primary use case is identifying locations suitable for **private K-12 schools** based on demographic data and zoning regulations.

## Live Demo

Hosted on GitHub Pages: https://andrewwvincent.github.io/CRE-listing-tool/

## Core Features

### 1. Property Listings Map
- Displays CRE listings from `trilogy_listings.csv` on an interactive Leaflet map
- Listings can be filtered by state, status, price range, and size
- Click markers to view property details in side panel
- Save listings and export to CSV

### 2. Demographic Heatmaps
- Two heatmap modes:
  - **ES (Private Only)**: Enrollment Score for private school demand
  - **ES+ (Public+Private)**: Combined enrollment score
- Color-coded by relative scores within each county:
  - Red: Both ES and WS >= 75% of county max
  - Orange: Both ES and WS >= 50%
  - Yellow: Other qualifying areas
  - Blue: Either ES or WS <= 25%
- Filter threshold: Only shows block groups with ES/ES+ >= 2500 AND WS >= 2500

### 3. Zoning Layer (Travis & Williamson Counties, TX)
- 30,379 zoning polygons covering qualifying demographic areas
- Two coloring modes:
  - **Zone Type**: Residential (blue), Commercial (red), Industrial (orange), Mixed (purple), Agricultural (green), Parks (emerald), Other (gray)
  - **Private K-12 School Permission**: Permitted (green), Conditional (amber), Prohibited (red), Unknown (gray)
- Click any zone to see details including school permission status

### 4. Zoning Permission Filters
- **Permitted Only**: Show only listings in zones where private schools are permitted by right
- **Permitted + Conditional**: Show listings in zones where schools are permitted or require conditional use permit
- Works in combination with all other filters

## Data Sources

### Demographic Data
- **Metrics/*.json**: Unified demographic scores by county (ES, ES+, WS)
- **Geometry/*.geojson**: Census block group boundaries by FIPS code
- Counties covered: 48 counties across 18 states (AZ, CA, CO, CT, FL, GA, IL, MA, MD, MI, MN, MT, NC, NJ, NY, OH, PA, TN, TX, UT, VA, WA)

### Zoning Data
- **austin_area_zoning.geojson**: Zoning polygons for Travis & Williamson counties
- Source: Zoneomics API (tiles endpoint)
- Coverage: Areas with qualifying demographics (ES+ >= 2500, WS >= 2500)

### School Permission Data
- **zone_school_permissions.json**: Classification of each zone code for private K-12 school permissions
- Source: Zoneomics API (zoneDetail endpoint with output_fields=plu)
- Classification logic:
  - **P (Permitted)**: "Private primary/secondary educational facilities" in `as_of_right`
  - **C (Conditional)**: In `conditional_uses`
  - **X (Prohibited)**: In `prohibited` or not listed
  - **U (Unknown)**: No PLU data available

### Listings Data
- **trilogy_listings.csv**: Property listings with coordinates, pricing, size, status

## Technical Architecture

### Frontend
- **index.html**: Main UI with filter controls, layer toggles, side panels
- **app.js**: Core application logic (~1,400 lines)
- **styles.css**: Styling
- Libraries:
  - Leaflet.js for mapping
  - PapaParse for CSV parsing
  - Leaflet.VectorGrid for vector tiles (legacy, not currently used)

### Key Functions in app.js

| Function | Purpose |
|----------|---------|
| `loadListings()` | Parse CSV and display markers |
| `loadDemographicHeatmapsForState()` | Load demographic data for selected state |
| `loadZoningLayerForState()` | Load zoning GeoJSON for TX |
| `loadSchoolPermissions()` | Load zone_school_permissions.json |
| `getSchoolPermissionColor()` | Return color based on P/C/X/U status |
| `setZoningColorMode()` | Switch between zone type and school permission coloring |
| `isListingInPermittedZone()` | Check if listing is in permitted/conditional zone |
| `applyFilters()` | Apply all filters including zoning permission |

### Data Processing Scripts (not needed for runtime)

| Script | Purpose |
|--------|---------|
| `fetch_zoning.js` | Fetch zoning MVT tiles from Zoneomics API |
| `clip_zoning_tiles.js` | Clip features to tile bounds to remove overlap |
| `extract_zone_types.js` | Extract unique zone codes from GeoJSON |
| `fetch_plu_data.js` | Fetch PLU data for each zone from Zoneomics |
| `classify_school_permissions.js` | Classify zones by school permission |

## Zoneomics API Integration

### API Key
```
58fca2f84d43ab1455275525caed295b68a632ee
```

### Endpoints Used

1. **Tiles**: `GET /v2/tiles?x={x}&y={y}&z={z}&api_key={key}`
   - Returns MVT (Mapbox Vector Tiles) with zoning polygons
   - Used to build austin_area_zoning.geojson

2. **Zone Detail**: `GET /v2/zoneDetail?lat={lat}&lng={lng}&radius=1&output_fields=plu&api_key={key}`
   - Returns PLU (Permitted Land Use) data for a location
   - Response includes `as_of_right`, `conditional_uses`, `prohibited` arrays
   - Used to classify school permissions

### PLU Response Structure
```json
{
  "properties": {
    "zone_details": {
      "zone_code": "SF-3",
      "zone_name": "Family Residence",
      "zone_type": "Residential"
    },
    "land_uses": {
      "as_of_right": ["Private primary educational facilities", ...],
      "conditional_uses": [...],
      "prohibited": [...]
    }
  }
}
```

## School Permission Classification Results

| Permission | Count | Description |
|------------|-------|-------------|
| Permitted (P) | 338 zones | Private schools allowed by right |
| Conditional (C) | 197 zones | Requires special use permit |
| Prohibited (X) | 78 zones | Not allowed |
| Unknown (U) | 24 zones | No PLU data available |

## File Structure for GitHub Pages

```
/
├── index.html                    # Main HTML
├── app.js                        # Application logic
├── styles.css                    # Styles
├── trilogy_listings.csv          # Listings data
├── austin_area_zoning.geojson    # Zoning polygons (48MB)
├── zone_school_permissions.json  # School permission classifications
├── Metrics/                      # Demographic scores by county
│   ├── TX - Travis County - Unified Scores.json
│   ├── TX - Williamson County - Unified Scores.json
│   └── ... (other counties)
├── Geometry/                     # Block group boundaries
│   ├── 48-453.geojson           # Travis County
│   ├── 48-491.geojson           # Williamson County
│   └── ... (other counties)
└── PROJECT_CONTEXT.md           # This file
```

## Files NOT Needed for Runtime (Data Processing Only)

- `fetch_zoning.js` - Fetches tiles from Zoneomics
- `clip_zoning_tiles.js` - Clips tile overlap
- `extract_zone_types.js` - Extracts unique zones
- `fetch_plu_data.js` - Fetches PLU data
- `classify_school_permissions.js` - Classifies permissions
- `test_api_call.js` - API testing
- `zone_types.json` - Intermediate data
- `zone_plu_raw.json` - Raw API responses
- `austin_area_zoning_original.geojson` - Pre-clipped backup
- `node_modules/` - Node dependencies
- `package.json` / `package-lock.json` - Node config
- Various planning/documentation markdown files

## Usage Instructions

1. **Select a State**: Choose from dropdown and click "Apply Filters"
2. **Enable Layers**: Toggle demographic heatmaps and/or zoning layer
3. **Switch Color Mode**: Under "Color By", select "Zone Type" or "Private K-12 School Permission"
4. **Filter by Zoning**: Click "Permitted Only" or "Permitted + Conditional" to filter listings
5. **View Details**: Click markers or zones to see details
6. **Save Listings**: Add to saved list and export to CSV

## Future Enhancements

- Expand zoning data to additional metros beyond Austin
- Add more PLU categories (restaurants, medical offices, etc.)
- Real-time Zoneomics tile layer instead of static GeoJSON
- Parcel-level data integration
- Building footprint overlays
