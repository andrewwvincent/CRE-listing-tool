let map;
let markers = [];
let listings = [];
let searchMarker = null;
let savedListings = [];
let currentListing = null;
let filters = {
    state: '',
    priceMin: null,
    priceMax: null,
    sizeMin: null,
    sizeMax: null
};

function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

function loadListings() {
    Papa.parse('sample_listings.csv', {
        download: true,
        header: true,
        complete: function(results) {
            listings = results.data.filter(row => row.Lat && row.Lon);
            populateStateDropdown();
            displayMarkers();
        },
        error: function(error) {
            console.error('Error loading CSV:', error);
        }
    });
}

function extractStateFromAddress(address) {
    const match = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
    return match ? match[1] : '';
}

function populateStateDropdown() {
    const states = new Set();
    listings.forEach(listing => {
        const state = extractStateFromAddress(listing['Listing Address']);
        if (state) {
            states.add(state);
        }
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
    
    filteredListings.forEach(listing => {
        const lat = parseFloat(listing.Lat);
        const lon = parseFloat(listing.Lon);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            const icon = L.divIcon({
                className: 'custom-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            const marker = L.marker([lat, lon], { icon: icon }).addTo(map);
            
            const isSaved = isListingSaved(listing);
            const buttonText = isSaved ? 'Remove from List' : 'Add to List';
            const buttonClass = isSaved ? 'popup-btn saved' : 'popup-btn';
            
            const popupContent = `
                <div class="popup-title">${listing['Listing Name']}</div>
                <div class="popup-address">${listing['Listing Address']}</div>
                <div class="popup-price">${listing.Price}</div>
                <button class="${buttonClass}" data-listing-name="${listing['Listing Name']}">${buttonText}</button>
            `;
            marker.bindPopup(popupContent);
            
            marker.on('click', function() {
                showInfoPanel(listing);
            });
            
            marker.on('popupopen', function() {
                const popupBtn = document.querySelector('.popup-btn');
                if (popupBtn) {
                    popupBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const listingName = this.dataset.listingName;
                        const listing = listings.find(l => l['Listing Name'] === listingName);
                        if (listing) {
                            toggleSaveListing(listing);
                            displayMarkers();
                            map.closePopup();
                        }
                    });
                }
            });
            
            markers.push(marker);
        }
    });
    
    updateResultsCount(filteredListings.length);
}

function parsePrice(priceStr) {
    return parseFloat(priceStr.replace(/[$,\s]/g, ''));
}

function parseSize(sizeStr) {
    return parseFloat(sizeStr.replace(/[,\s]/g, ''));
}

function applyFilters() {
    return listings.filter(listing => {
        const price = parsePrice(listing.Price);
        const size = parseSize(listing.Size);
        const state = extractStateFromAddress(listing['Listing Address']);
        
        if (filters.state && state !== filters.state) return false;
        if (filters.priceMin !== null && price < filters.priceMin) return false;
        if (filters.priceMax !== null && price > filters.priceMax) return false;
        if (filters.sizeMin !== null && size < filters.sizeMin) return false;
        if (filters.sizeMax !== null && size > filters.sizeMax) return false;
        
        return true;
    });
}

function updateResultsCount(count) {
    const resultsCount = document.getElementById('results-count');
    if (count === listings.length) {
        resultsCount.textContent = `Showing all ${count} listings`;
    } else {
        resultsCount.textContent = `Showing ${count} of ${listings.length} listings`;
    }
}

function showInfoPanel(listing) {
    currentListing = listing;
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    infoContent.innerHTML = `
        <div class="info-row">
            <div class="info-label">Listing Name</div>
            <div class="info-value large">${listing['Listing Name']}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Address</div>
            <div class="info-value">${listing['Listing Address']}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Market</div>
            <div class="info-value">${listing.Market}</div>
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
        <div class="info-row">
            <div class="info-label">Status</div>
            <div class="info-value">${listing.Status}</div>
        </div>
    `;
    
    infoPanel.classList.remove('hidden');
}

function hideInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    infoPanel.classList.add('hidden');
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
    document.getElementById('apply-filters').addEventListener('click', function() {
        const state = document.getElementById('state-filter').value;
        const priceMin = document.getElementById('price-min').value;
        const priceMax = document.getElementById('price-max').value;
        const sizeMin = document.getElementById('size-min').value;
        const sizeMax = document.getElementById('size-max').value;
        
        filters.state = state;
        filters.priceMin = priceMin ? parseFloat(priceMin) : null;
        filters.priceMax = priceMax ? parseFloat(priceMax) : null;
        filters.sizeMin = sizeMin ? parseFloat(sizeMin) : null;
        filters.sizeMax = sizeMax ? parseFloat(sizeMax) : null;
        
        displayMarkers();
    });
    
    document.getElementById('reset-filters').addEventListener('click', function() {
        filters = {
            state: '',
            priceMin: null,
            priceMax: null,
            sizeMin: null,
            sizeMax: null
        };
        
        document.getElementById('state-filter').value = '';
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
});
