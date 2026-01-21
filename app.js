let map;
let markers = [];
let listings = [];
let searchMarker = null;
let savedListings = [];
let currentListing = null;
let demographicHeatmapES = null;
let demographicHeatmapESPlus = null;
let demographicScoreData = {};
let demographicGeometryData = {};
let loadedDemographicCounties = new Set();
let demographicFilterEnabled = false;
let countyMaxValues = {};
let filters = {
    state: '',
    status: 'AVAILABLE',
    priceMin: null,
    priceMax: null,
    sizeMin: null,
    sizeMax: null,
    demographics: false
};

function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function loadListings() {
    Papa.parse('trilogy_listings.csv', {
        download: true,
        header: true,
        complete: function(results) {
            // Map Trilogy data structure to portal format
            listings = results.data
                .filter(row => row.location_geopoint_latitude && row.location_geopoint_longitude)
                .map(row => ({
                    // Map Trilogy fields to expected portal fields
                    'Status': row.listed_space_availability_status || 'N/A',
                    'Listing Name': row.property_name || row.listed_space_title || 'Unnamed Property',
                    'Listing Address': row.property_standardized_address || row.location_street_address || 'N/A',
                    'Market': `${row.location_address_region} - ${row.location_address_locality}` || 'N/A',
                    'State': row.location_address_region || '',
                    'Lat': row.location_geopoint_latitude,
                    'Lon': row.location_geopoint_longitude,
                    'Price': formatPrice(row),
                    'Size': formatSize(row.space_size_available),
                    'Broker Name': 'N/A',
                    'Broker Email': 'N/A',
                    'Broker Phone': 'N/A',
                    'Listing Website': 'N/A',
                    // Keep original data for reference
                    '_original': row
                }));
            console.log(`Loaded ${listings.length} listings from Trilogy data`);
            populateStateDropdown();
            displayMarkers();
        },
        error: function(error) {
            console.error('Error loading CSV:', error);
        }
    });
}

function formatPrice(row) {
    // Try different price fields in order of preference
    const priceFields = [
        row.lease_asking_rent_general_price_average_amount,
        row.lease_asking_rent_general_price_minimum_amount,
        row.lease_asking_rent_industrial_office_price_average_amount,
        row.sale_price_amount
    ];
    
    for (let price of priceFields) {
        if (price && price !== '') {
            const numPrice = parseFloat(price);
            if (!isNaN(numPrice)) {
                return `$${numPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }
        }
    }
    return 'Contact for Price';
}

function formatSize(size) {
    if (!size || size === '') return 'N/A';
    const numSize = parseFloat(size);
    if (isNaN(numSize)) return 'N/A';
    return `${numSize.toLocaleString('en-US')} sq ft`;
}

// Demographic Heatmap Functions
const COUNTY_MAPPING_BY_STATE = {
    'AZ': [{ code: '04-013', name: 'Maricopa County' }],
    'CA': [
        { code: '06-001', name: 'Alameda County' },
        { code: '06-013', name: 'Contra Costa County' },
        { code: '06-037', name: 'Los Angeles County' },
        { code: '06-059', name: 'Orange County' },
        { code: '06-065', name: 'Riverside County' },
        { code: '06-073', name: 'San Diego County' },
        { code: '06-075', name: 'San Francisco County' },
        { code: '06-081', name: 'San Mateo County' },
        { code: '06-085', name: 'Santa Clara County' },
        { code: '06-111', name: 'Ventura County' }
    ],
    'CO': [
        { code: '08-001', name: 'Adams County' },
        { code: '08-005', name: 'Arapahoe County' },
        { code: '08-013', name: 'Boulder County' },
        { code: '08-014', name: 'Broomfield County' },
        { code: '08-019', name: 'Clear Creek County' },
        { code: '08-031', name: 'Denver County' },
        { code: '08-035', name: 'Douglas County' },
        { code: '08-047', name: 'Gilpin County' },
        { code: '08-059', name: 'Jefferson Count' },
        { code: '08-123', name: 'Weld County' }
    ],
    'CT': [{ code: '09-190', name: 'Fairfield County' }],
    'FL': [
        { code: '12-011', name: 'Broward County' },
        { code: '12-086', name: 'Miami-Dade County' },
        { code: '12-099', name: 'Palm Beach County' }
    ],
    'GA': [
        { code: '13-067', name: 'Cobb County' },
        { code: '13-121', name: 'Fulton County' },
        { code: '13-135', name: 'Gwinnett County' }
    ],
    'IL': [
        { code: '17-031', name: 'Cook County' },
        { code: '17-043', name: 'DuPage County' },
        { code: '17-089', name: 'Kane County' },
        { code: '17-097', name: 'Lake County' }
    ],
    'MA': [
        { code: '25-009', name: 'Essex County' },
        { code: '25-017', name: 'Middlesex County' },
        { code: '25-021', name: 'Norfolk County' },
        { code: '25-025', name: 'Suffolk County' }
    ],
    'MD': [{ code: '24-031', name: 'Montgomery County' }],
    'MI': [{ code: '26-125', name: 'Oakland County' }],
    'MN': [{ code: '27-053', name: 'Hennepin County' }],
    'MT': [{ code: '30-031', name: 'Gallatin County' }],
    'NC': [
        { code: '37-063', name: 'Durham County' },
        { code: '37-119', name: 'Mecklenburg County' },
        { code: '37-183', name: 'Wake County' }
    ],
    'NJ': [
        { code: '34-003', name: 'Bergen County' },
        { code: '34-013', name: 'Essex County' },
        { code: '34-023', name: 'Middlesex County' },
        { code: '34-025', name: 'Monmouth County' },
        { code: '34-027', name: 'Morris County' },
        { code: '34-035', name: 'Somerset County' },
        { code: '34-039', name: 'Union County' }
    ],
    'NY': [
        { code: '36-005', name: 'Bronx County' },
        { code: '36-047', name: 'Kings County' },
        { code: '36-059', name: 'Nassau County' },
        { code: '36-061', name: 'New York County' },
        { code: '36-081', name: 'Queens County' },
        { code: '36-103', name: 'Suffolk County' },
        { code: '36-119', name: 'Westchester County' }
    ],
    'OH': [{ code: '39-049', name: 'Franklin County' }],
    'PA': [
        { code: '42-017', name: 'Bucks County' },
        { code: '42-029', name: 'Chester County' },
        { code: '42-045', name: 'Delaware County' },
        { code: '42-091', name: 'Montgomery County' }
    ],
    'TN': [{ code: '47-037', name: 'Davidson County' }],
    'TX': [
        { code: '48-085', name: 'Collin County' },
        { code: '48-113', name: 'Dallas County' },
        { code: '48-121', name: 'Denton County' },
        { code: '48-157', name: 'Fort Bend County' },
        { code: '48-201', name: 'Harris County' },
        { code: '48-439', name: 'Tarrant County' },
        { code: '48-453', name: 'Travis County' },
        { code: '48-491', name: 'Williamson County' }
    ],
    'UT': [
        { code: '49-035', name: 'Salt Lake County' },
        { code: '49-043', name: 'Summit County' }
    ],
    'VA': [
        { code: '51-013', name: 'Arlington County' },
        { code: '51-059', name: 'Fairfax County' },
        { code: '51-107', name: 'Loudoun County' },
        { code: '51-600', name: 'Fairfax City' }
    ],
    'WA': [
        { code: '53-033', name: 'King County' },
        { code: '53-061', name: 'Snohomish County' }
    ]
};

let currentDemographicState = null;

async function loadDemographicHeatmapsForState(stateCode) {
    if (!stateCode) {
        console.log('No state selected');
        return;
    }
    
    // Check if already loaded
    if (currentDemographicState === stateCode) {
        console.log(`Demographic data for ${stateCode} already loaded`);
        return;
    }
    
    const counties = COUNTY_MAPPING_BY_STATE[stateCode];
    if (!counties || counties.length === 0) {
        console.log(`No demographic data available for state ${stateCode}`);
        return;
    }
    
    console.log(`Loading demographic data for ${stateCode}: ${counties.length} counties...`);
    
    // Clear existing data if switching states
    if (currentDemographicState !== stateCode) {
        demographicScoreData = {};
        demographicGeometryData = {};
        loadedDemographicCounties.clear();
        countyMaxValues = {};
    }
    
    // Load all counties for this state
    for (const county of counties) {
        await loadDemographicDataForCounty(stateCode, county.code, county.name);
    }
    
    currentDemographicState = stateCode;
    
    // Refresh heatmap display
    refreshDemographicHeatmaps();
    
    console.log(`Loaded ${counties.length} counties for ${stateCode} (${Object.keys(demographicScoreData).length} block groups)`);
}

async function loadDemographicDataForCounty(stateCode, countyCode, countyName) {
    try {
        // Load unified scores
        const scoresFile = `Metrics/${stateCode} - ${countyName} - Unified Scores.json`;
        const scoresResponse = await fetch(scoresFile);
        if (!scoresResponse.ok) {
            console.error(`Failed to load scores for ${countyName}`);
            return;
        }
        const scoresData = await scoresResponse.json();
        
        // Load geometry
        const geometryFile = `Geometry/${countyCode}.geojson`;
        const geometryResponse = await fetch(geometryFile);
        if (!geometryResponse.ok) {
            console.error(`Failed to load geometry for ${countyName}`);
            return;
        }
        const geometryData = await geometryResponse.json();
        
        // Calculate county max values for relative scoring
        let maxES = 0;
        let maxESPlus = 0;
        let maxWS = 0;
        
        scoresData.forEach(item => {
            if (item.enrollmentScore > maxES) maxES = item.enrollmentScore;
            if (item.enrollmentScorePlus > maxESPlus) maxESPlus = item.enrollmentScorePlus;
            if (item.wealthScore > maxWS) maxWS = item.wealthScore;
        });
        
        // Store max values for this county
        countyMaxValues[countyCode] = {
            maxES: maxES,
            maxESPlus: maxESPlus,
            maxWS: maxWS
        };
        
        // Merge scores into lookup with county code
        scoresData.forEach(item => {
            demographicScoreData[item.geoid] = {
                enrollmentScore: item.enrollmentScore,
                enrollmentScorePlus: item.enrollmentScorePlus,
                wealthScore: item.wealthScore,
                colors: item.colors,
                countyCode: countyCode
            };
        });
        
        // Store geometry features
        geometryData.features.forEach(feature => {
            const geoid = feature.properties.GEOID;
            demographicGeometryData[geoid] = feature;
        });
        
        loadedDemographicCounties.add(countyCode);
        console.log(`  Loaded ${countyName}: ${scoresData.length} block groups (ES max: ${maxES.toFixed(0)}, ES+ max: ${maxESPlus.toFixed(0)}, WS max: ${maxWS.toFixed(0)})`);
        
    } catch (error) {
        console.error(`Error loading demographic data for ${countyName}:`, error);
    }
}

function getDemographicFeatureStyle(feature, mode) {
    const geoid = feature.properties.GEOID;
    const data = demographicScoreData[geoid];
    
    if (!data) {
        return {
            fillColor: '#9ca3af',
            weight: 0,
            opacity: 0,
            color: 'transparent',
            fillOpacity: 0
        };
    }
    
    // Get the enrollment score based on mode
    const enrollmentScore = mode === 'private' ? data.enrollmentScore : data.enrollmentScorePlus;
    const wealthScore = data.wealthScore;
    
    // Filter: only show block groups with ES/ES+ >= 2500 AND WS >= 2500
    if (!enrollmentScore || enrollmentScore < 2500 || !wealthScore || wealthScore < 2500) {
        return {
            fillColor: '#9ca3af',
            weight: 0,
            opacity: 0,
            color: 'transparent',
            fillOpacity: 0
        };
    }
    
    // Get county max values for relative scoring
    const countyCode = data.countyCode;
    const maxValues = countyMaxValues[countyCode];
    
    if (!maxValues) {
        // Fallback if max values not available
        return {
            fillColor: '#eab308',
            weight: 0,
            opacity: 0,
            color: 'transparent',
            fillOpacity: 0.5
        };
    }
    
    // Calculate relative scores (as percentage of county max)
    const maxEnrollment = mode === 'private' ? maxValues.maxES : maxValues.maxESPlus;
    const relES = (enrollmentScore / maxEnrollment) * 100;
    const relWS = (wealthScore / maxValues.maxWS) * 100;
    
    // Apply color logic based on relative scores:
    // Red: Both Rel ES and Rel WS >= 75%
    // Blue: Either Rel ES or Rel WS <= 25%
    // Orange: Both Rel ES and Rel WS >= 50%
    // Yellow: All other combinations
    let fillColor;
    
    if (relES >= 75 && relWS >= 75) {
        fillColor = '#ef4444'; // Red
    } else if (relES <= 25 || relWS <= 25) {
        fillColor = '#3b82f6'; // Blue
    } else if (relES >= 50 && relWS >= 50) {
        fillColor = '#f97316'; // Orange
    } else {
        fillColor = '#eab308'; // Yellow
    }
    
    return {
        fillColor: fillColor,
        weight: 0,
        opacity: 0,
        color: 'transparent',
        fillOpacity: 0.5
    };
}

function refreshDemographicHeatmaps() {
    // Remove existing layers
    if (demographicHeatmapES) {
        map.removeLayer(demographicHeatmapES);
        demographicHeatmapES = null;
    }
    if (demographicHeatmapESPlus) {
        map.removeLayer(demographicHeatmapESPlus);
        demographicHeatmapESPlus = null;
    }
    
    // Create feature collection from loaded geometry
    const features = Object.values(demographicGeometryData);
    if (features.length === 0) return;
    
    const geojsonData = {
        type: 'FeatureCollection',
        features: features
    };
    
    // Create ES (Private) layer
    demographicHeatmapES = L.geoJSON(geojsonData, {
        style: (feature) => getDemographicFeatureStyle(feature, 'private'),
        onEachFeature: (feature, layer) => {
            const geoid = feature.properties.GEOID;
            const data = demographicScoreData[geoid];
            if (data) {
                layer.bindPopup(`
                    <div class="popup-title">Demographic Heatmap (Private)</div>
                    <div class="popup-address">GEOID: ${geoid}</div>
                    <div class="popup-address">ES: ${data.enrollmentScore?.toFixed(0) || 'N/A'}</div>
                    <div class="popup-address">WS: ${data.wealthScore?.toFixed(0) || 'N/A'}</div>
                `);
            }
        }
    });
    
    // Create ES+ (Public+Private) layer
    demographicHeatmapESPlus = L.geoJSON(geojsonData, {
        style: (feature) => getDemographicFeatureStyle(feature, 'public'),
        onEachFeature: (feature, layer) => {
            const geoid = feature.properties.GEOID;
            const data = demographicScoreData[geoid];
            if (data) {
                layer.bindPopup(`
                    <div class="popup-title">Demographic Heatmap (Public+Private)</div>
                    <div class="popup-address">GEOID: ${geoid}</div>
                    <div class="popup-address">ES+: ${data.enrollmentScorePlus?.toFixed(0) || 'N/A'}</div>
                    <div class="popup-address">WS: ${data.wealthScore?.toFixed(0) || 'N/A'}</div>
                `);
            }
        }
    });
    
    console.log(`Created demographic heatmaps with ${features.length} block groups`);
}

function toggleDemographicHeatmapES(show) {
    if (show && demographicHeatmapES) {
        map.addLayer(demographicHeatmapES);
    } else if (demographicHeatmapES) {
        map.removeLayer(demographicHeatmapES);
    }
}

function toggleDemographicHeatmapESPlus(show) {
    if (show && demographicHeatmapESPlus) {
        map.addLayer(demographicHeatmapESPlus);
    } else if (demographicHeatmapESPlus) {
        map.removeLayer(demographicHeatmapESPlus);
    }
}

function isListingInQualifyingBlockGroup(listing) {
    const lat = parseFloat(listing.Lat);
    const lon = parseFloat(listing.Lon);
    
    if (isNaN(lat) || isNaN(lon)) return false;
    
    // Find which block group contains this point
    for (const geoid in demographicGeometryData) {
        const feature = demographicGeometryData[geoid];
        const data = demographicScoreData[geoid];
        
        if (!data) continue;
        
        // Check if point is in polygon
        if (isPointInPolygon([lon, lat], feature.geometry)) {
            // Check if block group meets criteria: ES+ >= 2500 AND WS >= 2500
            return data.enrollmentScorePlus >= 2500 && data.wealthScore >= 2500;
        }
    }
    
    return false;
}

function isPointInPolygon(point, polygon) {
    // Simple point-in-polygon test using ray casting
    const x = point[0], y = point[1];
    let inside = false;
    
    const coords = polygon.type === 'Polygon' ? polygon.coordinates[0] : polygon.coordinates[0][0];
    
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const xi = coords[i][0], yi = coords[i][1];
        const xj = coords[j][0], yj = coords[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

function extractStateFromAddress(listing) {
    // Use the State field directly from the listing object
    return listing.State || '';
}

function populateStateDropdown() {
    const states = new Set();
    listings.forEach(listing => {
        const state = extractStateFromAddress(listing);
        if (state) states.add(state);
    });
    
    const stateFilter = document.getElementById('state-filter');
    const sortedStates = Array.from(states).sort();
    
    sortedStates.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateFilter.appendChild(option);
    });
}

function displayMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    const filteredListings = applyFilters();
    
    // Group listings by address
    const listingsByAddress = {};
    filteredListings.forEach(listing => {
        const address = listing['Listing Address'];
        if (!listingsByAddress[address]) {
            listingsByAddress[address] = [];
        }
        listingsByAddress[address].push(listing);
    });
    
    // Create one marker per unique address
    Object.entries(listingsByAddress).forEach(([address, addressListings]) => {
        // Use the first listing's coordinates for the marker
        const lat = parseFloat(addressListings[0].Lat);
        const lon = parseFloat(addressListings[0].Lon);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            const icon = L.divIcon({
                className: 'custom-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const marker = L.marker([lat, lon], { icon: icon }).addTo(map);
            
            // Create popup content with suite dropdown if multiple listings
            const popupContent = createPopupContent(addressListings);
            marker.bindPopup(popupContent, { maxWidth: 350 });
            
            marker.on('click', function() {
                // Show suite selector in side panel
                showSuiteSelector(addressListings, lat, lon);
                highlightParcel(lat, lon, addressListings[0]);
            });
            
            markers.push(marker);
        }
    });
    
    updateResultsCount(filteredListings.length);
}

function createPopupContent(addressListings) {
    const propertyName = addressListings[0]['Listing Name'];
    const address = addressListings[0]['Listing Address'];
    const suiteCount = addressListings.length;
    
    let content = `
        <div class="popup-title">${propertyName}</div>
        <div class="popup-address">${address}</div>
        <div class="popup-suite-count">${suiteCount} suite${suiteCount > 1 ? 's' : ''} available</div>
        <div class="popup-instruction">Click to view details in side panel →</div>
    `;
    
    return content;
}

function setupPopupEventListeners(addressListings, lat, lon) {
    const suiteItems = document.querySelectorAll('.suite-item');
    suiteItems.forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.dataset.suiteIndex);
            const listing = addressListings[index];
            
            // Remove active class from all items
            suiteItems.forEach(si => si.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            // Update info panel and highlight
            showInfoPanel(listing);
            highlightParcel(lat, lon, listing);
        });
    });
}

function parsePrice(priceStr) {
    return parseFloat(priceStr.replace(/[$,\s]/g, ''));
}

function parseSize(sizeStr) {
    return parseFloat(sizeStr.replace(/[,\s]/g, ''));
}

function applyFilters() {
    const filtered = listings.filter(listing => {
        const price = parsePrice(listing.Price);
        const size = parseSize(listing.Size);
        const state = extractStateFromAddress(listing);
        const status = listing.Status;
        
        if (filters.state && state !== filters.state) {
            console.log(`Filtered out by state: ${listing['Listing Name']} - extracted state: "${state}", filter state: "${filters.state}"`);
            return false;
        }
        if (filters.status && status !== filters.status) return false;
        if (filters.priceMin !== null && price < filters.priceMin) return false;
        if (filters.priceMax !== null && price > filters.priceMax) return false;
        if (filters.sizeMin !== null && size < filters.sizeMin) return false;
        if (filters.sizeMax !== null && size > filters.sizeMax) return false;
        
        // Demographic filter: only show listings in qualifying block groups
        if (filters.demographics && Object.keys(demographicScoreData).length > 0) {
            if (!isListingInQualifyingBlockGroup(listing)) return false;
        }
        
        return true;
    });
    
    console.log(`Applied filters: ${filtered.length} of ${listings.length} listings passed`);
    return filtered;
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('results-count');
    if (count === listings.length) {
        resultsCount.textContent = `Showing all ${count} listings`;
    } else {
        resultsCount.textContent = `Showing ${count} of ${listings.length} listings`;
    }
}

function showSuiteSelector(addressListings, lat, lon) {
    const infoPanel = document.getElementById('info-panel');
    const infoTitle = document.getElementById('info-title');
    const infoContent = document.getElementById('info-content');
    
    const propertyName = addressListings[0]['Listing Name'];
    const address = addressListings[0]['Listing Address'];
    
    infoTitle.textContent = propertyName;
    
    let content = `
        <div class="info-row">
            <div class="info-label">Address</div>
            <div class="info-value">${address}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Available Suites</div>
            <div class="info-value">${addressListings.length} suite${addressListings.length > 1 ? 's' : ''}</div>
        </div>
    `;
    
    if (addressListings.length > 1) {
        content += '<div class="suite-selector-label">Select a suite to view details:</div>';
        content += '<div class="suite-selector-list">';
        addressListings.forEach((listing, index) => {
            const isSaved = isListingSaved(listing);
            const savedClass = isSaved ? 'saved' : '';
            content += `
                <div class="suite-selector-item ${savedClass}" data-suite-index="${index}">
                    <div class="suite-selector-size">${listing.Size}</div>
                    <div class="suite-selector-price">${listing.Price}</div>
                    <div class="suite-selector-status">${listing.Status}</div>
                </div>
            `;
        });
        content += '</div>';
    } else {
        // Single suite - show full details immediately
        showInfoPanel(addressListings[0]);
        return;
    }
    
    infoContent.innerHTML = content;
    infoPanel.classList.remove('hidden');
    
    // Add event listeners to suite items
    const suiteItems = document.querySelectorAll('.suite-selector-item');
    suiteItems.forEach(item => {
        item.addEventListener('click', function() {
            const index = parseInt(this.dataset.suiteIndex);
            const listing = addressListings[index];
            
            // Remove active class from all items
            suiteItems.forEach(si => si.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
            
            // Show full details for selected suite
            showInfoPanel(listing);
            highlightParcel(lat, lon, listing);
        });
    });
}

function showInfoPanel(listing) {
    currentListing = listing;
    const infoPanel = document.getElementById('info-panel');
    const infoTitle = document.getElementById('info-title');
    const infoContent = document.getElementById('info-content');
    
    infoTitle.textContent = listing['Listing Name'];
    
    infoContent.innerHTML = `
        <div class="info-row">
            <div class="info-label">Address</div>
            <div class="info-value">${listing['Listing Address']}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Market</div>
            <div class="info-value">${listing.Market}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Status</div>
            <div class="info-value">${listing.Status}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Price</div>
            <div class="info-value large">${listing.Price}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Size (sq ft)</div>
            <div class="info-value">${listing.Size}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Broker</div>
            <div class="info-value">${listing['Broker Name']}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Email</div>
            <div class="info-value">${listing['Broker Email']}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Phone</div>
            <div class="info-value">${listing['Broker Phone']}</div>
        </div>
    `;
    
    infoPanel.classList.remove('hidden');
}

function hideInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    infoPanel.classList.add('hidden');
}

function highlightParcel(lat, lon, listing = null) {
    // Simplified - no parcel/building boundary highlighting
    // Just focus the map on the location
    if (lat && lon) {
        map.setView([lat, lon], 16);
    }
}

function normalizeAddress(address) {
    return address.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findListingByAddress(searchAddress) {
    const normalizedSearch = normalizeAddress(searchAddress);
    
    return listings.find(listing => {
        const listingAddress = normalizeAddress(listing['Listing Address']);
        return listingAddress.includes(normalizedSearch) || normalizedSearch.includes(listingAddress);
    });
}

async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

function showSearchMessage(message, type) {
    const messageEl = document.getElementById('search-message');
    messageEl.textContent = message;
    messageEl.className = `search-message ${type}`;
}

function clearSearchMessage() {
    const messageEl = document.getElementById('search-message');
    messageEl.textContent = '';
    messageEl.className = 'search-message';
}

function removeSearchMarker() {
    if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
    }
}

async function handleAddressSearch() {
    const searchInput = document.getElementById('address-search');
    const address = searchInput.value.trim();
    
    if (!address) {
        showSearchMessage('Please enter an address', 'error');
        return;
    }
    
    clearSearchMessage();
    removeSearchMarker();
    
    const matchingListing = findListingByAddress(address);
    
    if (matchingListing) {
        const lat = parseFloat(matchingListing.Lat);
        const lon = parseFloat(matchingListing.Lon);
        
        map.setView([lat, lon], 16);
        
        const marker = markers.find(m => {
            const markerLatLng = m.getLatLng();
            return Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lon) < 0.0001;
        });
        
        if (marker) {
            marker.openPopup();
        }
        
        showInfoPanel(matchingListing);
        showSearchMessage(`Found listing: ${matchingListing['Listing Name']}`, 'success');
    } else {
        showSearchMessage('Searching for address...', 'info');
        
        const result = await geocodeAddress(address);
        
        if (result) {
            const icon = L.divIcon({
                className: 'search-marker',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            
            searchMarker = L.marker([result.lat, result.lon], { icon: icon }).addTo(map);
            
            const popupContent = `
                <div class="popup-title">Search Result</div>
                <div class="popup-address">${result.displayName}</div>
            `;
            searchMarker.bindPopup(popupContent).openPopup();
            
            map.setView([result.lat, result.lon], 16);
            
            showSearchMessage('Address found (not a listing)', 'success');
        } else {
            showSearchMessage('Address not found. Please try a different search.', 'error');
        }
    }
}

function setupFilterListeners() {
    document.getElementById('apply-filters').addEventListener('click', async function() {
        filters.state = document.getElementById('state-filter').value;
        filters.status = document.getElementById('status-filter').value;
        filters.priceMin = parseFloat(document.getElementById('price-min').value) || null;
        filters.priceMax = parseFloat(document.getElementById('price-max').value) || null;
        filters.sizeMin = parseFloat(document.getElementById('size-min').value) || null;
        filters.sizeMax = parseFloat(document.getElementById('size-max').value) || null;
        
        // Load demographic data for selected state
        if (filters.state && filters.state !== currentDemographicState) {
            const statusEl = document.getElementById('demographic-status');
            statusEl.textContent = `Loading demographic data for ${filters.state}...`;
            statusEl.style.backgroundColor = '#fef3c7';
            statusEl.style.color = '#92400e';
            
            await loadDemographicHeatmapsForState(filters.state);
            
            if (Object.keys(demographicScoreData).length > 0) {
                const counties = COUNTY_MAPPING_BY_STATE[filters.state];
                statusEl.textContent = `✓ Loaded ${counties.length} counties for ${filters.state}`;
                statusEl.style.backgroundColor = '#dcfce7';
                statusEl.style.color = '#166534';
            } else {
                statusEl.textContent = `No demographic data for ${filters.state}`;
                statusEl.style.backgroundColor = '#fee2e2';
                statusEl.style.color = '#991b1b';
            }
        }
        
        displayMarkers();
    });
    
    document.getElementById('reset-filters').addEventListener('click', function() {
        filters = {
            state: '',
            status: 'AVAILABLE',
            priceMin: null,
            priceMax: null,
            sizeMin: null,
            sizeMax: null
        };
        
        document.getElementById('state-filter').value = '';
        document.getElementById('status-filter').value = 'AVAILABLE';
        document.getElementById('price-min').value = '';
        document.getElementById('price-max').value = '';
        document.getElementById('size-min').value = '';
        document.getElementById('size-max').value = '';
        
        displayMarkers();
    });
}

function isListingSaved(listing) {
    return savedListings.some(saved => saved['Listing Name'] === listing['Listing Name']);
}

function toggleSaveListing(listing) {
    if (isListingSaved(listing)) {
        removeSavedListing(listing);
    } else {
        addSavedListing(listing);
    }
}

function addSavedListing(listing) {
    if (!isListingSaved(listing)) {
        savedListings.push(listing);
        updateSavedListingsDisplay();
    }
}

function removeSavedListing(listing) {
    savedListings = savedListings.filter(saved => saved['Listing Name'] !== listing['Listing Name']);
    updateSavedListingsDisplay();
}

function clearAllSavedListings() {
    if (savedListings.length > 0 && confirm('Are you sure you want to clear all saved listings?')) {
        savedListings = [];
        updateSavedListingsDisplay();
        displayMarkers();
    }
}

function updateSavedListingsDisplay() {
    const container = document.getElementById('saved-listings-container');
    const countEl = document.getElementById('saved-count');
    const exportBtn = document.getElementById('export-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    
    countEl.textContent = `${savedListings.length} saved`;
    
    if (savedListings.length === 0) {
        container.innerHTML = '<p class="placeholder">No saved listings yet. Click on a pin and add it to your list.</p>';
        exportBtn.disabled = true;
        clearAllBtn.disabled = true;
    } else {
        exportBtn.disabled = false;
        clearAllBtn.disabled = false;
        container.innerHTML = savedListings.map(listing => `
            <div class="saved-listing-card" data-listing-name="${listing['Listing Name']}">
                <div class="saved-listing-name">${listing['Listing Name']}</div>
                <div class="saved-listing-address">${listing['Listing Address']}</div>
                <div class="saved-listing-footer">
                    <div class="saved-listing-price">${listing.Price}</div>
                    <button class="btn-remove" data-listing-name="${listing['Listing Name']}">Remove</button>
                </div>
            </div>
        `).join('');
        
        document.querySelectorAll('.saved-listing-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.classList.contains('btn-remove')) {
                    const listingName = this.dataset.listingName;
                    const listing = savedListings.find(l => l['Listing Name'] === listingName);
                    if (listing) {
                        const lat = parseFloat(listing.Lat);
                        const lon = parseFloat(listing.Lon);
                        map.setView([lat, lon], 16);
                        showInfoPanel(listing);
                        highlightParcel(lat, lon, listing);
                    }
                }
            });
        });
        
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const listingName = this.dataset.listingName;
                const listing = savedListings.find(l => l['Listing Name'] === listingName);
                if (listing) {
                    removeSavedListing(listing);
                    displayMarkers();
                }
            });
        });
    }
}

function exportToCSV() {
    if (savedListings.length === 0) return;
    
    const headers = ['Status', 'Listing Name', 'Listing Address', 'Market', 'Lat', 'Lon', 'Price', 'Size', 'Broker Name', 'Broker Email', 'Broker Phone', 'Listing Website'];
    
    const csvContent = [
        headers.join(','),
        ...savedListings.map(listing => [
            listing.Status,
            `"${listing['Listing Name']}"`,
            `"${listing['Listing Address']}"`,
            listing.Market,
            listing.Lat,
            listing.Lon,
            `"${listing.Price}"`,
            listing.Size,
            listing['Broker Name'],
            listing['Broker Email'],
            listing['Broker Phone'],
            listing['Listing Website']
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `saved_listings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadListings();
    setupFilterListeners();
    updateSavedListingsDisplay();
    
    document.getElementById('close-info').addEventListener('click', hideInfoPanel);
    
    document.getElementById('search-btn').addEventListener('click', handleAddressSearch);
    
    document.getElementById('address-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleAddressSearch();
        }
    });
    
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    
    document.getElementById('clear-all-btn').addEventListener('click', clearAllSavedListings);
    
    // Demographic heatmap controls
    document.getElementById('toggle-demographic-es').addEventListener('change', function(e) {
        toggleDemographicHeatmapES(e.target.checked);
    });
    
    document.getElementById('toggle-demographic-es-plus').addEventListener('change', function(e) {
        toggleDemographicHeatmapESPlus(e.target.checked);
    });
    
    document.getElementById('toggle-demographic-filter').addEventListener('change', function(e) {
        filters.demographics = e.target.checked;
        displayMarkers();
    });
});
