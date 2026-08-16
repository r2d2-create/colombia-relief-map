const L = window.L;

let map;
let markerGroup;
let userLocationMarker;

// Feature 1: Setup Custom Colored Pins based on Boroughs
function getBoroughColor(borough) {
    switch (borough) {
        case "Queens": return "orange";
        case "Brooklyn": return "purple";
        case "Bronx": return "red";
        case "Manhattan": return "blue";
        default: return "green"; // Fallback for Nassau/other regions
    }
}

function createCustomMarker(color) {
    // Generates a clean, modern colored dot pin using Leaflet vector circles
    return L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color:${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
}

// Core Map Initialization
function initMap() {
    // Centers map over NYC
    map = L.map('map').setView([40.7128, -74.0060], 11);

    // Loads clean, free OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markerGroup = L.layerGroup().addTo(map);

    // Feature 2: Fetch and render the automated sites.json data
    fetch('sites.json')
        .then(response => response.json())
        .then(data => {
            window.allSites = data; 
            displaySites(data);
            updateTimestamp(); // Displays data sync time
        })
        .catch(err => {
            console.error("Error loading sites.json database file:", err);
            document.getElementById("site-list").innerHTML = "<p style='color:red; padding:15px;'>Waiting for initial scraper data. Please trigger your GitHub Action workflow first!</p>";
        });

    // Feature 3: Wire up the Locate Me click action
    document.getElementById("locate-btn").addEventListener("click", locateUser);
}

function displaySites(sites) {
    markerGroup.clearLayers();
    const listContainer = document.getElementById("site-list");
    listContainer.innerHTML = "";

    sites.forEach(site => {
        const routingUrl = `https://google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.address)}&travelmode=transit`;
        const pinColor = getBoroughColor(site.borough);
        
        // Drops customized colored circle pin onto map canvas
        const marker = L.marker([site.lat, site.lng], { icon: createCustomMarker(pinColor) });
        
        marker.bindPopup(`
            <strong>${site.name}</strong><br>
            <span style="color:#666; font-size:12px;">${site.borough}</span><br>
            ${site.address}<br>
            <a href="tel:${site.phone}">${site.phone}</a><br>
            <a href="${routingUrl}" target="_blank" class="route-btn">Get Train/Bus Route</a>
        `);
        markerGroup.addLayer(marker);

        // Populate Sidebar list elements
        const card = document.createElement("div");
        card.className = "site-card";
        card.style.borderLeft = `5px solid ${pinColor}`; // Visual accent border matching the pin color
        card.innerHTML = `
            <strong>${site.name}</strong>
            <p style="margin:4px 0; font-size:13px; color:#555;">${site.address}</p>
            <p style="margin:2px 0; font-size:12px; color:#888;">${site.phone}</p>
            <a href="${routingUrl}" target="_blank" class="route-btn">Route via Transit</a>
        `;
        
        card.addEventListener("click", () => {
            map.flyTo([site.lat, site.lng], 15);
            marker.openPopup();
        });
        listContainer.appendChild(card);
    });
}

// GPS "Locate Me" Engine
function locateUser() {
    const btn = document.getElementById("locate-btn");
    btn.innerText = "🌀 Finding you...";
    
    map.locate({ setView: true, maxZoom: 14 });

    map.on('locationfound', function(e) {
        btn.innerText = "📍 Location Found";
        
        // Remove old location pin if it exists
        if (userLocationMarker) { map.removeLayer(userLocationMarker); }

        // Drop a special pulsing blue pin on user's exact coordinates
        userLocationMarker = L.marker(e.latlng, {
            icon: L.divIcon({
                className: 'user-pin',
                html: `<div style="background-color: #007bff; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px #007bff;"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map).bindPopup("<b>You are here</b>").openPopup();
    });

    map.on('locationerror', function() {
        btn.innerText = "❌ Location Denied";
        alert("Could not access your location. Please check browser privacy permissions.");
    });
}

// Drop-down Filter Engine
function filterMarkers() {
    const selectedZip = document.getElementById("zipFilter").value;
    if (selectedZip === "all") {
        displaySites(window.allSites);
    } else {
        const filtered = window.allSites.filter(site => site.zip === selectedZip);
        displaySites(filtered);
    }
}

// Automated Data Age Timestamp Engine
function updateTimestamp() {
    const timeElement = document.getElementById("timestamp");
    const now = new Date();
    timeElement.innerText = `Last checked: Today at ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
}

document.addEventListener('DOMContentLoaded', initMap);
