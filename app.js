let map;
let markerGroup;
let userLocationMarker;
let allSites = [];

function getBoroughColor(borough) {
  switch (borough) {
    case "Queens":
      return "orange";
    case "Brooklyn":
      return "purple";
    case "Bronx":
      return "red";
    case "Manhattan":
      return "blue";
    case "Staten Island":
      return "green";
    default:
      return "#198754";
  }
}

function createCustomMarker(color) {
  const L = window.L;

  return L.divIcon({
    className: "custom-pin",
    html: `
      <div
        style="
          background-color: ${color};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.45);
        "
      ></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

function createUserLocationMarker() {
  const L = window.L;

  return L.divIcon({
    className: "user-pin",
    html: `
      <div
        style="
          background-color: #007bff;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 9px #007bff;
        "
      ></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9]
  });
}

function safeText(value, fallback = "") {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function validSite(site) {
  return (
    site &&
    safeText(site.name).trim() &&
    safeText(site.address).trim() &&
    Number.isFinite(Number(site.lat)) &&
    Number.isFinite(Number(site.lng))
  );
}

function initMap() {
  const L = window.L;
  const mapElement = document.getElementById("map");
  const locateButton = document.getElementById("locate-btn");
  const zipFilter = document.getElementById("zipFilter");

  if (!L) {
    console.error(
      "Leaflet failed to load. Make sure leaflet.js appears before app.js in index.html."
    );

    mapElement.innerHTML = `
      <div class="map-error">
        The map library failed to load. Please refresh or check the Leaflet script tag.
      </div>
    `;
    return;
  }

  if (!mapElement) {
    console.error('The HTML element with id="map" is missing.');
    return;
  }

  map = L.map("map").setView([40.7128, -74.006], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  markerGroup = L.layerGroup().addTo(map);

  locateButton.addEventListener("click", locateUser);
  zipFilter.addEventListener("change", filterMarkers);

  loadSites();
}

async function loadSites() {
  const listContainer = document.getElementById("site-list");

  try {
    const response = await fetch("sites.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`sites.json returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("sites.json must contain a JSON array.");
    }

    allSites = data.filter(validSite);

    populateZipFilter(allSites);
    displaySites(allSites);
    updateTimestamp();
  } catch (error) {
    console.error("Error loading sites.json:", error);

    listContainer.innerHTML = `
      <p class="error-message">
        The donation-site database could not load. Please try again later.
      </p>
    `;
  }
}

function populateZipFilter(sites) {
  const zipFilter = document.getElementById("zipFilter");

  const zipCodes = [
    ...new Set(
      sites
        .map((site) => safeText(site.zip).trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  zipFilter.innerHTML = `<option value="all">All ZIP codes</option>`;

  zipCodes.forEach((zip) => {
    const option = document.createElement("option");
    option.value = zip;
    option.textContent = zip;
    zipFilter.appendChild(option);
  });
}

function displaySites(sites) {
  const L = window.L;
  const listContainer = document.getElementById("site-list");

  markerGroup.clearLayers();
  listContainer.innerHTML = "";

  if (sites.length === 0) {
    listContainer.innerHTML = `
      <p class="empty-message">
        No verified donation sites have been found yet. This map will update
        when the scraper identifies active collection locations.
      </p>
    `;
    return;
  }

  sites.forEach((site) => {
    const name = safeText(site.name, "Unnamed donation site");
    const address = safeText(site.address);
    const borough = safeText(site.borough, "NYC area");
    const phone = safeText(site.phone, "Phone unavailable");
    const latitude = Number(site.lat);
    const longitude = Number(site.lng);
    const pinColor = getBoroughColor(site.borough);

    const routingUrl =
      "https://www.google.com/maps/dir/?api=1" +
      `&destination=${encodeURIComponent(address)}` +
      "&travelmode=transit";

    const marker = L.marker([latitude, longitude], {
      icon: createCustomMarker(pinColor),
      title: name
    });

    marker.bindPopup(`
      <strong>${escapeHtml(name)}</strong><br>
      <span style="color: #666; font-size: 12px;">
        ${escapeHtml(borough)}
      </span><br>
      ${escapeHtml(address)}<br>
      <a href="tel:${encodeURIComponent(phone)}">${escapeHtml(phone)}</a><br>
      <a
        href="${routingUrl}"
        target="_blank"
        rel="noopener noreferrer"
        class="route-btn"
      >
        Get train / bus route
      </a>
    `);

    markerGroup.addLayer(marker);

    const card = document.createElement("article");
    card.className = "site-card";
    card.style.borderLeft = `5px solid ${pinColor}`;
    card.tabIndex = 0;

    card.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <p class="site-address">${escapeHtml(address)}</p>
      <p class="site-phone">${escapeHtml(phone)}</p>
      <a
        href="${routingUrl}"
        target="_blank"
        rel="noopener noreferrer"
        class="route-btn"
      >
        Route via transit
      </a>
    `;

    const focusSite = (event) => {
      if (event.target.closest("a")) {
        return;
      }

      map.flyTo([latitude, longitude], 15, {
        duration: 0.75
      });

      marker.openPopup();
    };

    card.addEventListener("click", focusSite);

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        focusSite(event);
      }
    });

    listContainer.appendChild(card);
  });
}

function filterMarkers() {
  const selectedZip = document.getElementById("zipFilter").value;

  if (selectedZip === "all") {
    displaySites(allSites);
    return;
  }

  const filteredSites = allSites.filter(
    (site) => safeText(site.zip).trim() === selectedZip
  );

  displaySites(filteredSites);
}

function locateUser() {
  const L = window.L;
  const button = document.getElementById("locate-btn");

  if (!navigator.geolocation) {
    button.textContent = "❌ Location Unsupported";
    alert("This browser does not support location services.");
    return;
  }

  button.textContent = "🌀 Finding you...";
  button.disabled = true;

  map.once("locationfound", (event) => {
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
    }

    userLocationMarker = L.marker(event.latlng, {
      icon: createUserLocationMarker(),
      title: "Your location"
    })
      .addTo(map)
      .bindPopup("<strong>You are here</strong>")
      .openPopup();

    map.flyTo(event.latlng, 14, {
      duration: 0.75
    });

    button.textContent = "📍 Location Found";
    button.disabled = false;
  });

  map.once("locationerror", (event) => {
    console.error("Location error:", event.message);

    button.textContent = "❌ Location Denied";
    button.disabled = false;

    alert(
      "Could not access your location. Check browser privacy permissions and try again."
    );
  });

  map.locate({
    setView: false,
    maxZoom: 14,
    enableHighAccuracy: true,
    timeout: 10000
  });
}

function updateTimestamp() {
  const timestamp = document.getElementById("timestamp");
  const now = new Date();

  timestamp.textContent = `Last checked: ${now.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;
}

document.addEventListener("DOMContentLoaded", initMap);
