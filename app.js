let map;
let markerGroup;
let userLocationMarker;
let allSites = [];

let startPinCounter = 0;
let selectedStartMarker = null;
let selectedStartPoint = null;
let selectedDestination = null;
let routeLayer = null;
let transitStepLayerGroup = null;
let transitBadgeLayerGroup = null;
let routeAbortController = null;
let currentLanguage = "en";
let currentSidebarView = "home";
let dragRouteTimer = null;
let geocodeQueueTimer = null;
let lastRouteKey = "";
let lastRouteData = null;
let directionsHasOpened = false;
let routeRequestStarted = false;
let activeRouteGeometry = null;
let activeRouteSummary = null;

const startMarkers = new Map();
const reverseGeocodeCache = new Map();
const routeCache = new Map();

const ROUTING_PROXY_URL =
  "https://colombia-relief-routing.end259-b4a.workers.dev/route";

const translations = {
  en: {
    documentTitle: "Colombia Relief Donation Map",
    title: "Colombia Earthquake Relief: NYC Donation Site Map",
    subtitle:
      "Find current NYC-area donation locations for people affected by the August 2026 Colombia earthquake. \n *** CALL YOUR DESIRED LOCATION TO ASK WHAT DONATIONS THEY ACCEPT, AS NEEDS CONSTANTLY CHANGE. *** ",
    zipLabel: "Filter donation sites by ZIP code",
    allZipCodes: "All ZIP codes",
    locate: "📍 Use My Current Location",
    findingLocation: "🌀 Finding you...",
    locationFound: "📍 Location Found",
    locationUnsupported: "❌ Location Unsupported",
    instructionsHeading: "Instructions",
    instructions:
      "Click or tap anywhere on the map to add a red location pin. You can add multiple pins, press and hold a pin to drag it, and click or tap a pin to select or delete it. Select a donation site from the map or list to view the location’s details and get directions.",
    loadingSites: "Loading verified donation sites…",
    noSites:
      "No verified donation sites have been found yet. This map will update when the scraper identifies active collection locations.",
    routeButton: "Directions",
    selectedPin: "Selected pinned location",
    selectPin: "Select this pinned location",
    selectPinnedLocation: "Select a pinned location",
    removePin: "Delete pin",
    deletePinTitle: "Delete pin?",
    no: "No",
    yes: "Yes",
    pinInstructions:
      "Press and hold this pin, then drag it to move it. Select it to use it for directions.",
    findingAddress: "Finding address…",
    pinnedLocation: "Pinned location",
    yourLocation: "Your current location",
    youAreHere: "You are here",
    detailsBack: "← Back to donation sites",
    directionsBack: "← Back to donation site",
    directionsHeading: "Directions",
    startPoint: "Starting point",
    destination: "Destination",
    reverseDirections: "Reverse directions",
    travelMode: "Travel mode",
    chooseTravelMode: "Choose a travel mode",
    transit: "Transit",
    drive: "Driving",
    walk: "Walking",
    bicycle: "Cycling",
    chooseStartAndMode:
      "Choose a pinned location and travel mode to get directions.",
    chooseTravelModeFirst:
      "Choose a travel mode to calculate directions.",
    calculatingRoute: "Calculating route",
    translatingRoute: "Translating directions…",
    routeError:
      "Could not calculate this route. Check your connection or try another travel mode.",
    noRoute: "No route found for this travel mode.",
    routeShown:
      "Route shown on the map. Step-by-step directions are unavailable for this route.",
    takeLine: "Take",
    toward: "toward",
    from: "from",
    to: "to",
    stops: "stops",
    call: "Call",
    sendToPhone: "Send to phone",
    callUnavailable: "Phone unavailable",
    phoneCopied: "Directions link copied. Paste it into a text message or email.",
    shareError: "Could not share directions. The directions link was copied instead.",
    lastChecked: "Last checked",
    locationNotSupported: "This browser does not support location services.",
    locationDeniedAlert:
      "Could not access your location. Check browser privacy permissions and try again.",
    mapLabel: "Interactive donation site map",
    siteListLabel: "Donation site locations",
    filterLabel: "Donation site filters",
    boroughLegend: "Donation-site borough",
    pinnedLocationLegend: "Your pinned location",
    phone: "Phone",
    address: "Address",
    selectedForDirections: "Selected donation site",
    continueRoute: "Continue on the route."
  },

  es: {
    documentTitle: "Mapa de Donaciones en NYC para Colombia",
    title: "Mapa de Ayuda para Colombia",
    subtitle:
      "Encuentra lugares actuales de donación en el área de Nueva York para las personas afectadas por el terremoto en Colombia de agosto de 2026. \n *** LLAME AL CENTRO QUE ELIJA PARA PREGUNTAR QUÉ DONACIONES ACEPTAN, YA QUE LAS NECESIDADES CAMBIAN CONSTANTEMENTE. ***",
    zipLabel: "Filtrar lugares de donación por código postal",
    allZipCodes: "Todos los códigos postales",
    locate: "📍 Usar mi ubicación actual",
    findingLocation: "🌀 Buscando tu ubicación...",
    locationFound: "📍 Ubicación encontrada",
    locationUnsupported: "❌ Ubicación no disponible",
    instructionsHeading: "Instrucciones",
    instructions:
      "Haz clic o toca cualquier lugar del mapa para agregar un pin rojo de ubicación. Puedes agregar varios pins, mantener presionado un pin para arrastrarlo y hacer clic o tocar un pin para seleccionarlo o eliminarlo. Selecciona un lugar de donación en el mapa o la lista para ver los detalles y obtener indicaciones.",
    loadingSites: "Cargando lugares de donación verificados…",
    noSites:
      "Aún no se han encontrado lugares de donación verificados. Este mapa se actualizará cuando el recopilador identifique lugares de recolección activos.",
    routeButton: "Indicaciones",
    selectedPin: "Ubicación marcada seleccionada",
    selectPin: "Seleccionar esta ubicación marcada",
    selectPinnedLocation: "Selecciona una ubicación marcada",
    removePin: "Eliminar pin",
    deletePinTitle: "¿Eliminar pin?",
    no: "No",
    yes: "Sí",
    pinInstructions:
      "Mantén presionado este pin y arrástralo para moverlo. Selecciónalo para usarlo en las indicaciones.",
    findingAddress: "Buscando dirección…",
    pinnedLocation: "Ubicación marcada",
    yourLocation: "Tu ubicación actual",
    youAreHere: "Estás aquí",
    detailsBack: "← Volver a los lugares de donación",
    directionsBack: "← Volver al lugar de donación",
    directionsHeading: "Indicaciones",
    startPoint: "Punto de partida",
    destination: "Destino",
    reverseDirections: "Invertir indicaciones",
    travelMode: "Modo de viaje",
    chooseTravelMode: "Elige un modo de viaje",
    transit: "Transporte público",
    drive: "Auto",
    walk: "A pie",
    bicycle: "Bicicleta",
    chooseStartAndMode:
      "Elige una ubicación marcada y un modo de viaje para obtener indicaciones.",
    chooseTravelModeFirst:
      "Elige un modo de viaje para calcular las indicaciones.",
    calculatingRoute: "Calculando ruta",
    translatingRoute: "Traduciendo indicaciones…",
    routeError:
      "No se pudo calcular esta ruta. Revisa tu conexión o prueba otro modo de viaje.",
    noRoute: "No se encontró una ruta para este modo de viaje.",
    routeShown:
      "La ruta se muestra en el mapa. Las indicaciones paso a paso no están disponibles para esta ruta.",
    takeLine: "Toma",
    toward: "hacia",
    from: "desde",
    to: "hasta",
    stops: "paradas",
    call: "Llamar",
    sendToPhone: "Enviar al teléfono",
    callUnavailable: "Teléfono no disponible",
    phoneCopied:
      "El enlace de indicaciones se copió. Pégalo en un mensaje de texto o correo electrónico.",
    shareError:
      "No se pudieron compartir las indicaciones. El enlace se copió en su lugar.",
    lastChecked: "Última actualización",
    locationNotSupported:
      "Este navegador no admite los servicios de ubicación.",
    locationDeniedAlert:
      "No se pudo acceder a tu ubicación. Revisa los permisos de privacidad del navegador e inténtalo de nuevo.",
    mapLabel: "Mapa interactivo de lugares de donación",
    siteListLabel: "Lugares de donación",
    filterLabel: "Filtros de lugares de donación",
    boroughLegend: "Distrito del lugar de donación",
    pinnedLocationLegend: "Tu ubicación marcada",
    phone: "Teléfono",
    address: "Dirección",
    selectedForDirections: "Lugar de donación seleccionado",
    continueRoute: "Continúa por la ruta."
  }
};

function text(key) {
  return translations[currentLanguage][key];
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

function normalizeStreetNumberComma(address) {
  return safeText(address)
    .replace(/^(\d+(?:-\d+)?)\s*,\s*/u, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSiteAddress(site) {
  const address = normalizeStreetNumberComma(site.address);
  const zip = safeText(site.zip).trim();

  if (!zip || /\b\d{5}(?:-\d{4})?\b/.test(address)) {
    return address;
  }

  return `${address}, NY ${zip}`;
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
  return window.L.divIcon({
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

function createStartPointMarker(isSelected = false) {
  return window.L.divIcon({
    className: "start-pin-wrapper",
    html: `
      <div class="start-pin${isSelected ? " is-selected" : ""}">
        <span>📍</span>
      </div>
    `,
    iconSize: [28, 35],
    iconAnchor: [14, 34],
    popupAnchor: [0, -31]
  });
}

function createUserLocationMarker() {
  return window.L.divIcon({
    className: "user-pin",
    html: `
      <div
        style="
          background-color: #007bff;
          width: 18px;
          height: 18px;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 9px #007bff;
        "
      ></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9]
  });
}

function coordinatesCacheKey(latlng) {
  return `${Number(latlng.lat).toFixed(5)},${Number(latlng.lng).toFixed(5)}`;
}

function fallbackPinnedLocationAddress(latlng) {
  return `${text("pinnedLocation")} (${Number(latlng.lat).toFixed(5)}, ${Number(
    latlng.lng
  ).toFixed(5)})`;
}

function formatReverseGeocodeAddress(address) {
  if (!address) {
    return "";
  }

  const street = normalizeStreetNumberComma(
    [address.house_number, address.road].filter(Boolean).join(" ")
  );

  const parts = [
    street,
    address.neighbourhood || address.suburb,
    address.city || address.town || address.village,
    address.state,
    address.postcode
  ].filter(Boolean);

  return [...new Set(parts)].join(", ");
}

function getPinAddress(marker) {
  const latlng = marker.getLatLng();

  return (
    marker.options.addressLabel ||
    reverseGeocodeCache.get(coordinatesCacheKey(latlng)) ||
    fallbackPinnedLocationAddress(latlng)
  );
}

function queueReverseGeocode(marker) {
  const latlng = marker.getLatLng();
  const cacheKey = coordinatesCacheKey(latlng);

  if (reverseGeocodeCache.has(cacheKey)) {
    marker.options.addressLabel = reverseGeocodeCache.get(cacheKey);
    populateStartPinSelect();
    return;
  }

  marker.options.addressLabel = text("findingAddress");
  populateStartPinSelect();

  clearTimeout(geocodeQueueTimer);

  geocodeQueueTimer = setTimeout(async () => {
    try {
      const parameters = new URLSearchParams({
        format: "jsonv2",
        lat: latlng.lat,
        lon: latlng.lng,
        zoom: "18",
        addressdetails: "1",
        "accept-language": currentLanguage === "es" ? "es" : "en"
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${parameters.toString()}`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding failed.");
      }

      const result = await response.json();

      const address =
        formatReverseGeocodeAddress(result.address) ||
        normalizeStreetNumberComma(result.display_name) ||
        fallbackPinnedLocationAddress(latlng);

      reverseGeocodeCache.set(cacheKey, address);

      if (startMarkers.has(marker.options.startPinId)) {
        marker.options.addressLabel = address;
        populateStartPinSelect();
      }
    } catch (error) {
      console.warn("Could not find address for pinned location:", error);

      if (startMarkers.has(marker.options.startPinId)) {
        marker.options.addressLabel = fallbackPinnedLocationAddress(latlng);
        populateStartPinSelect();
      }
    }
  }, 250);
}

function showSidebarView(view) {
  currentSidebarView = view;

  document.getElementById("sidebar-home").hidden = view !== "home";
  document.getElementById("site-detail-panel").hidden = view !== "detail";
  document.getElementById("directions-panel").hidden = view !== "directions";

  document.getElementById("sidebar").scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function removeRouteLayers() {
  if (routeLayer) {
    map.removeLayer(routeLayer);
    routeLayer = null;
  }

  if (transitStepLayerGroup) {
    map.removeLayer(transitStepLayerGroup);
    transitStepLayerGroup = null;
  }

  if (transitBadgeLayerGroup) {
    map.removeLayer(transitBadgeLayerGroup);
    transitBadgeLayerGroup = null;
  }
}

function clearRoute() {
  if (routeAbortController) {
    routeAbortController.abort();
    routeAbortController = null;
  }

  removeRouteLayers();

  lastRouteKey = "";
  lastRouteData = null;
  activeRouteGeometry = null;
  activeRouteSummary = null;
  routeRequestStarted = false;

  const instructions = document.getElementById("route-instructions");

  if (instructions) {
    instructions.innerHTML = "";
  }
}

function setSelectedStartMarker(marker) {
  if (!marker || !startMarkers.has(marker.options.startPinId)) {
    return;
  }

  if (selectedStartMarker && selectedStartMarker !== marker) {
    selectedStartMarker.setIcon(createStartPointMarker(false));
  }

  selectedStartMarker = marker;

  const latlng = marker.getLatLng();

  selectedStartPoint = {
    lat: latlng.lat,
    lng: latlng.lng
  };

  marker.setIcon(createStartPointMarker(true));
  marker.setPopupContent(startPointPopupHtml(marker));
  marker.openPopup();

  populateStartPinSelect();

  if (directionsHasOpened) {
    updateRouteStatus();
  }
}

function startPointPopupHtml(marker) {
  const isSelected = marker === selectedStartMarker;

  return `
    <div class="start-pin-popup">
      <strong>
        ${escapeHtml(isSelected ? text("selectedPin") : text("selectPin"))}
      </strong>

      <p>${escapeHtml(text("pinInstructions"))}</p>

      ${
        isSelected
          ? ""
          : `
            <button
              type="button"
              class="select-start-pin"
              data-action="select-start-pin"
              data-pin-id="${marker.options.startPinId}"
            >
              ${escapeHtml(text("selectPin"))}
            </button>
          `
      }

      <button
        type="button"
        class="delete-start-pin"
        data-action="confirm-delete-start-pin"
        data-pin-id="${marker.options.startPinId}"
      >
        ${escapeHtml(text("removePin"))}
      </button>
    </div>
  `;
}

function showDeletePinConfirmation(marker) {
  if (!marker || !startMarkers.has(marker.options.startPinId)) {
    return;
  }

  marker.setPopupContent(`
    <div class="start-pin-popup">
      <strong>${escapeHtml(text("deletePinTitle"))}</strong>

      <div class="popup-action-row">
        <button
          type="button"
          class="cancel-pin-delete"
          data-action="cancel-delete-start-pin"
          data-pin-id="${marker.options.startPinId}"
        >
          ${escapeHtml(text("no"))}
        </button>

        <button
          type="button"
          class="delete-start-pin"
          data-action="delete-start-pin"
          data-pin-id="${marker.options.startPinId}"
        >
          ${escapeHtml(text("yes"))}
        </button>
      </div>
    </div>
  `);

  marker.openPopup();
}

function deleteStartMarker(marker) {
  if (!marker || !startMarkers.has(marker.options.startPinId)) {
    return;
  }

  const wasSelected = marker === selectedStartMarker;

  map.closePopup();
  map.removeLayer(marker);
  startMarkers.delete(marker.options.startPinId);

  if (wasSelected) {
    selectedStartMarker = null;
    selectedStartPoint = null;
    clearRoute();

    const nextMarker = startMarkers.values().next().value;

    if (nextMarker) {
      setSelectedStartMarker(nextMarker);
    }
  }

  populateStartPinSelect();

  if (directionsHasOpened) {
    updateRouteStatus();
  }
}

function handlePopupActions(event) {
  const popupElement = event.popup.getElement();

  if (!popupElement) {
    return;
  }

  popupElement.addEventListener("click", (clickEvent) => {
    const actionButton = clickEvent.target.closest("[data-action]");

    if (!actionButton) {
      return;
    }

    clickEvent.preventDefault();
    clickEvent.stopPropagation();

    const marker = startMarkers.get(actionButton.dataset.pinId);

    if (!marker) {
      return;
    }

    switch (actionButton.dataset.action) {
      case "select-start-pin":
        setSelectedStartMarker(marker);
        break;

      case "confirm-delete-start-pin":
        showDeletePinConfirmation(marker);
        break;

      case "cancel-delete-start-pin":
        marker.setPopupContent(startPointPopupHtml(marker));
        marker.openPopup();
        break;

      case "delete-start-pin":
        deleteStartMarker(marker);
        break;

      default:
        break;
    }
  });
}

function addStartPoint(latlng, label = "") {
  const L = window.L;
  const pinNumber = ++startPinCounter;
  const pinId = `start-pin-${pinNumber}`;

  const marker = L.marker(latlng, {
    icon: createStartPointMarker(false),
    draggable: true,
    keyboard: true,
    title: label || text("pinnedLocation"),
    zIndexOffset: 1000,
    startPinId: pinId,
    pinNumber,
    addressLabel: label || ""
  }).addTo(map);

  startMarkers.set(pinId, marker);
  marker.bindPopup(startPointPopupHtml(marker));

  marker.on("click", () => {
    setSelectedStartMarker(marker);
  });

  marker.on("dragend", () => {
    const updatedPoint = marker.getLatLng();

    marker.options.addressLabel = "";
    queueReverseGeocode(marker);

    if (marker === selectedStartMarker) {
      selectedStartPoint = {
        lat: updatedPoint.lat,
        lng: updatedPoint.lng
      };

      populateStartPinSelect();

      clearTimeout(dragRouteTimer);

      if (
        routeRequestStarted &&
        selectedDestination &&
        currentSidebarView === "directions"
      ) {
        dragRouteTimer = setTimeout(() => {
          requestRoute();
        }, 180);
      } else if (directionsHasOpened) {
        updateRouteStatus();
      }
    }
  });

  if (!label) {
    queueReverseGeocode(marker);
  }

  setSelectedStartMarker(marker);

  return marker;
}

function selectRouteDestination(site) {
  selectedDestination = site;
  renderSiteDetail(site);
  populateDirectionsDestination();

  if (directionsHasOpened) {
    updateRouteStatus();
  }
}

function openSiteDetail(site, centerMap = true) {
  selectRouteDestination(site);
  showSidebarView("detail");

  if (centerMap) {
    map.flyTo([Number(site.lat), Number(site.lng)], 15, {
      duration: 0.75
    });
  }
}

function openDirectionsPanel() {
  if (!selectedDestination) {
    return;
  }

  directionsHasOpened = true;
  routeRequestStarted = false;

  populateStartPinSelect();
  populateDirectionsDestination();
  showSidebarView("directions");

  document.getElementById("route-mode").value = "";
  document.getElementById("route-instructions").innerHTML = "";
  updateRouteStatus();
}

function renderSiteDetail(site) {
  const container = document.getElementById("site-detail-content");

  if (!container || !site) {
    return;
  }

  const name = safeText(site.name, "Unnamed donation site");
  const address = formatSiteAddress(site);
  const borough = safeText(site.borough, "NYC area");
  const phone = safeText(site.phone);
  const phoneAvailable = phone && phone.toLowerCase() !== "phone unavailable";

  container.innerHTML = `
    <span class="detail-kicker">${escapeHtml(text("selectedForDirections"))}</span>

    <h2>${escapeHtml(name)}</h2>

    <p class="detail-borough">${escapeHtml(borough)}</p>

    <div class="detail-info-row">
      <span class="detail-info-label">${escapeHtml(text("address"))}</span>
      <p>${escapeHtml(address)}</p>
    </div>

    <div class="detail-info-row">
      <span class="detail-info-label">${escapeHtml(text("phone"))}</span>
      <p>${
        phoneAvailable
          ? escapeHtml(phone)
          : escapeHtml(text("callUnavailable"))
      }</p>
    </div>

    <div class="detail-action-grid">
      <button id="open-directions-btn" class="primary-detail-action" type="button">
        🧭 ${escapeHtml(text("routeButton"))}
      </button>

      ${
        phoneAvailable
          ? `
            <a
              class="detail-action-button call-button"
              href="tel:${encodeURIComponent(phone)}"
            >
              ☎ ${escapeHtml(text("call"))}
            </a>
          `
          : `
            <button class="detail-action-button" type="button" disabled>
              ☎ ${escapeHtml(text("callUnavailable"))}
            </button>
          `
      }

      <button id="send-to-phone-btn" class="detail-action-button" type="button">
        📱 ${escapeHtml(text("sendToPhone"))}
      </button>
    </div>
  `;

  document
    .getElementById("open-directions-btn")
    .addEventListener("click", openDirectionsPanel);

  document
    .getElementById("send-to-phone-btn")
    .addEventListener("click", sendDirectionsToPhone);
}

function getGoogleMapsDirectionsUrl() {
  if (!selectedDestination) {
    return "";
  }

  const params = new URLSearchParams({
    api: "1",
    destination: `${Number(selectedDestination.lat)},${Number(
      selectedDestination.lng
    )}`
  });

  if (selectedStartPoint) {
    params.set(
      "origin",
      `${selectedStartPoint.lat},${selectedStartPoint.lng}`
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

async function sendDirectionsToPhone() {
  if (!selectedDestination) {
    return;
  }

  const directionsUrl = getGoogleMapsDirectionsUrl();
  const destinationName = safeText(selectedDestination.name);

  try {
    if (navigator.share) {
      await navigator.share({
        title: `${text("directionsHeading")}: ${destinationName}`,
        text: `${text("directionsHeading")} — ${destinationName}`,
        url: directionsUrl
      });
      return;
    }

    await navigator.clipboard.writeText(directionsUrl);
    alert(text("phoneCopied"));
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    try {
      await navigator.clipboard.writeText(directionsUrl);
      alert(text("shareError"));
    } catch {
      window.prompt(text("phoneCopied"), directionsUrl);
    }
  }
}

function populateStartPinSelect() {
  const select = document.getElementById("start-pin-select");

  if (!select) {
    return;
  }

  const selectedId = selectedStartMarker?.options.startPinId || "";

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = text("selectPinnedLocation");
  select.appendChild(placeholder);

  startMarkers.forEach((marker, pinId) => {
    const option = document.createElement("option");

    option.value = pinId;
    option.textContent = getPinAddress(marker);

    select.appendChild(option);
  });

  select.value = selectedId;
}

function populateDirectionsDestination() {
  const name = document.getElementById("directions-destination-name");
  const address = document.getElementById("directions-destination-address");

  if (!selectedDestination || !name || !address) {
    return;
  }

  name.textContent = safeText(selectedDestination.name);
  address.textContent = formatSiteAddress(selectedDestination);
}

function reverseDirections() {
  if (!selectedDestination || !selectedStartMarker) {
    return;
  }

  const destinationPoint = window.L.latLng(
    Number(selectedDestination.lat),
    Number(selectedDestination.lng)
  );

  const startPoint = selectedStartMarker.getLatLng();
  const formerStartAddress = getPinAddress(selectedStartMarker);

  selectedStartMarker.setLatLng(destinationPoint);
  selectedStartMarker.options.addressLabel = formatSiteAddress(selectedDestination);

  selectedStartPoint = {
    lat: destinationPoint.lat,
    lng: destinationPoint.lng
  };

  selectedDestination = {
    ...selectedDestination,
    lat: startPoint.lat,
    lng: startPoint.lng,
    name: text("pinnedLocation"),
    address: formerStartAddress,
    phone: ""
  };

  renderSiteDetail(selectedDestination);
  populateDirectionsDestination();
  populateStartPinSelect();

  if (routeRequestStarted) {
    requestRoute();
  } else {
    updateRouteStatus();
  }
}

function updateRouteStatus() {
  const status = document.getElementById("route-status");
  const routeMode = document.getElementById("route-mode");

  if (!status || !directionsHasOpened) {
    return;
  }

  if (!selectedDestination || !selectedStartMarker) {
    status.textContent = text("chooseStartAndMode");
    return;
  }

  if (!routeMode?.value) {
    status.textContent = text("chooseTravelModeFirst");
    return;
  }

  if (!routeRequestStarted) {
    status.textContent = text("chooseTravelModeFirst");
  }
}

function buildRouteKey() {
  if (!selectedStartPoint || !selectedDestination) {
    return "";
  }

  const mode = document.getElementById("route-mode")?.value || "";

  return [
    selectedStartPoint.lat.toFixed(5),
    selectedStartPoint.lng.toFixed(5),
    Number(selectedDestination.lat).toFixed(5),
    Number(selectedDestination.lng).toFixed(5),
    mode,
    currentLanguage
  ].join("|");
}

function buildRouteBaseKey() {
  if (!selectedStartPoint || !selectedDestination) {
    return "";
  }

  const mode = document.getElementById("route-mode")?.value || "";

  return [
    selectedStartPoint.lat.toFixed(5),
    selectedStartPoint.lng.toFixed(5),
    Number(selectedDestination.lat).toFixed(5),
    Number(selectedDestination.lng).toFixed(5),
    mode
  ].join("|");
}

async function requestRoute(options = {}) {
  const {
    keepGeometry = false,
    shouldFitBounds = true,
    statusMessage = ""
  } = options;

  if (!selectedStartPoint || !selectedDestination) {
    updateRouteStatus();
    return;
  }

  const routeModeSelect = document.getElementById("route-mode");
  const status = document.getElementById("route-status");
  const instructions = document.getElementById("route-instructions");

  if (!routeModeSelect || !status || !instructions || !routeModeSelect.value) {
    updateRouteStatus();
    return;
  }

  routeRequestStarted = true;

  const routeKey = buildRouteKey();

  if (routeCache.has(routeKey)) {
    lastRouteKey = routeKey;
    lastRouteData = routeCache.get(routeKey);

    if (keepGeometry) {
      renderTranslatedInstructions(lastRouteData);
    } else {
      drawRoute(lastRouteData, shouldFitBounds);
    }

    return;
  }

  if (routeAbortController) {
    routeAbortController.abort();
  }

  routeAbortController = new AbortController();

  status.textContent = statusMessage || `${text("calculatingRoute")}…`;

  if (!keepGeometry) {
    instructions.innerHTML = "";
  }

  const parameters = new URLSearchParams({
    startLat: selectedStartPoint.lat,
    startLng: selectedStartPoint.lng,
    endLat: Number(selectedDestination.lat),
    endLng: Number(selectedDestination.lng),
    mode: routeModeSelect.value,
    language: currentLanguage
  });

  try {
    const response = await fetch(
      `${ROUTING_PROXY_URL}?${parameters.toString()}`,
      {
        signal: routeAbortController.signal,
        cache: "force-cache"
      }
    );

    const routeData = await response.json();

    if (!response.ok) {
      throw new Error(routeData.error || "Route request failed.");
    }

    routeCache.set(routeKey, routeData);
    lastRouteKey = routeKey;
    lastRouteData = routeData;

    if (keepGeometry) {
      renderTranslatedInstructions(routeData);
    } else {
      drawRoute(routeData, shouldFitBounds);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    console.error("Routing error:", error);

    if (!keepGeometry) {
      status.textContent = text("routeError");
    }
  }
}

function drawRoute(routeData, shouldFitBounds = true) {
  const L = window.L;
  const status = document.getElementById("route-status");
  const instructions = document.getElementById("route-instructions");
  const routeFeature = routeData.features?.[0];

  removeRouteLayers();

  if (!routeFeature) {
    status.textContent = text("noRoute");
    instructions.innerHTML = "";
    return;
  }

  activeRouteGeometry = routeFeature.geometry;
  activeRouteSummary = {
    distance: Number(routeFeature.properties?.distance || 0),
    time: Number(routeFeature.properties?.time || 0)
  };

  routeLayer = L.geoJSON(
    {
      type: "Feature",
      properties: {},
      geometry: activeRouteGeometry
    },
    {
      style: {
        color: "#6f7d89",
        weight: 5,
        opacity: 0.45,
        dashArray: "8 8"
      }
    }
  ).addTo(map);

  const properties = routeFeature.properties || {};
  const steps = (properties.legs || []).flatMap((leg) => leg.steps || []);

  transitStepLayerGroup = L.layerGroup().addTo(map);
  transitBadgeLayerGroup = L.layerGroup().addTo(map);

  drawTransitOverlays(steps);
  renderRouteSummary(properties);
  renderInstructions(steps);

  if (shouldFitBounds && routeLayer.getBounds().isValid()) {
    map.fitBounds(routeLayer.getBounds(), {
      padding: [40, 40],
      maxZoom: 14
    });
  }
}

function renderTranslatedInstructions(routeData) {
  const routeFeature = routeData.features?.[0];

  if (!routeFeature || !activeRouteGeometry || !routeLayer) {
    drawRoute(routeData, false);
    return;
  }

  const properties = routeFeature.properties || {};
  const steps = (properties.legs || []).flatMap((leg) => leg.steps || []);

  renderRouteSummary(activeRouteSummary || properties);
  renderInstructions(steps);
}

function renderRouteSummary(properties) {
  const status = document.getElementById("route-status");
  const distanceKm = Number(properties.distance || 0) / 1000;
  const minutes = Math.max(
    1,
    Math.round(Number(properties.time || 0) / 60)
  );

  status.textContent =
    `${safeText(selectedDestination.name)}: ${distanceKm.toFixed(1)} km · ${minutes} min`;
}

function renderInstructions(steps) {
  const instructions = document.getElementById("route-instructions");

  if (!steps.length) {
    instructions.innerHTML = `<li>${escapeHtml(text("routeShown"))}</li>`;
    return;
  }

  instructions.innerHTML = steps
    .slice(0, 20)
    .map((step) => createRouteInstructionHtml(step))
    .join("");
}

function drawTransitOverlays(steps) {
  const L = window.L;

  steps.forEach((step) => {
    if (step.travelMode !== "TRANSIT" || !step.polyline) {
      return;
    }

    const line = step.transitDetails?.transitLine || {};
    const color = normalizeTransitColor(line.color, "#0b5cab");
    const textColor = normalizeTransitColor(line.textColor, "#ffffff");
    const coordinates = decodeGooglePolylineForLeaflet(step.polyline);

    if (coordinates.length < 2) {
      return;
    }

    L.polyline(coordinates, {
      color,
      weight: 8,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(transitStepLayerGroup);

    const midpoint = coordinates[Math.floor(coordinates.length / 2)];
    const routeLabel = getTransitRouteLabel(line);

    if (midpoint && routeLabel) {
      L.marker(midpoint, {
        icon: createTransitBadge(routeLabel, color, textColor),
        interactive: false,
        keyboard: false,
        zIndexOffset: 600
      }).addTo(transitBadgeLayerGroup);
    }
  });
}

function normalizeTransitColor(color, fallback) {
  const value = safeText(color).trim();

  if (!value) {
    return fallback;
  }

  return value.startsWith("#") ? value : `#${value}`;
}

function getTransitRouteLabel(line) {
  const shortName = safeText(line.nameShort).trim();
  const fullName = safeText(line.name).trim();
  const vehicleType = safeText(line.vehicle?.type).toUpperCase();

  if (shortName) {
    return shortName
      .replace(/\s+line$/i, "")
      .replace(/\s+train$/i, "")
      .trim();
  }

  if (vehicleType === "SUBWAY") {
    const subwayMatch = fullName.match(/^([A-Z0-9]+)\s*(?:train|line)?/i);

    if (subwayMatch) {
      return subwayMatch[1].toUpperCase();
    }
  }

  return fullName
    .replace(/\s+line$/i, "")
    .replace(/\s+train$/i, "")
    .trim();
}

function getTransitVehicleEmoji(vehicleType) {
  switch (vehicleType) {
    case "SUBWAY":
      return "🚇";
    case "BUS":
      return "🚌";
    case "TRAIN":
    case "RAIL":
      return "🚆";
    case "LIGHT_RAIL":
      return "🚊";
    default:
      return "🚉";
  }
}

function createTransitBadge(label, backgroundColor, textColor) {
  const L = window.L;
  const safeLabel = escapeHtml(label).slice(0, 6);

  return L.divIcon({
    className: "transit-route-badge-wrapper",
    html: `
      <div
        class="transit-route-badge"
        style="background: ${backgroundColor}; color: ${textColor};"
        aria-label="Transit line ${safeLabel}"
      >
        ${safeLabel}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function decodeGooglePolylineForLeaflet(encoded) {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const latLngs = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    latLngs.push([latitude / 1e5, longitude / 1e5]);
  }

  return latLngs;
}

function createRouteInstructionHtml(step) {
  const transitDetails = step.transitDetails;
  const transitLine = transitDetails?.transitLine;

  if (!transitLine) {
    return `
      <li class="route-instruction route-instruction-walk">
        <span class="route-step-icon">🚶</span>
        <span>${escapeHtml(
          step.instruction?.text || text("continueRoute")
        )}</span>
      </li>
    `;
  }

  const label = getTransitRouteLabel(transitLine);
  const color = normalizeTransitColor(transitLine.color, "#0b5cab");
  const textColor = normalizeTransitColor(transitLine.textColor, "#ffffff");
  const vehicleType = transitLine.vehicle?.type || "";
  const vehicleEmoji = getTransitVehicleEmoji(vehicleType);
  const headsign = safeText(transitDetails.headsign);
  const departureStop = safeText(
    transitDetails.stopDetails?.departureStop?.name
  );
  const arrivalStop = safeText(transitDetails.stopDetails?.arrivalStop?.name);
  const stopCount = Number(transitDetails.stopCount || 0);

  const serviceDescription = [
    headsign ? `${text("toward")} ${headsign}` : "",
    departureStop ? `${text("from")} ${departureStop}` : "",
    arrivalStop ? `${text("to")} ${arrivalStop}` : "",
    stopCount ? `${stopCount} ${text("stops")}` : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <li class="route-instruction route-instruction-transit">
      <span
        class="route-line-icon"
        style="background: ${color}; color: ${textColor};"
      >
        ${escapeHtml(label)}
      </span>

      <span class="route-instruction-copy">
        <strong>
          ${vehicleEmoji} ${escapeHtml(text("takeLine"))}
          ${escapeHtml(label)}
        </strong>

        ${
          serviceDescription
            ? `<small>${escapeHtml(serviceDescription)}</small>`
            : ""
        }
      </span>
    </li>
  `;
}

function createSitePopupHtml(site) {
  const name = safeText(site.name, "Unnamed donation site");
  const address = formatSiteAddress(site);
  const borough = safeText(site.borough, "NYC area");
  const phone = safeText(site.phone, "Phone unavailable");

  return `
    <strong>${escapeHtml(name)}</strong><br>
    <span class="popup-borough">${escapeHtml(borough)}</span><br>
    ${escapeHtml(address)}<br>
    <a href="tel:${encodeURIComponent(phone)}">${escapeHtml(phone)}</a>
  `;
}

function displaySites(sites) {
  const L = window.L;
  const listContainer = document.getElementById("site-list");

  markerGroup.clearLayers();
  listContainer.innerHTML = "";

  if (!sites.length) {
    listContainer.innerHTML = `
      <p class="empty-message">${escapeHtml(text("noSites"))}</p>
    `;
    return;
  }

  sites.forEach((site) => {
    const name = safeText(site.name, "Unnamed donation site");
    const address = formatSiteAddress(site);
    const borough = safeText(site.borough, "NYC area");
    const phone = safeText(site.phone, "Phone unavailable");
    const latitude = Number(site.lat);
    const longitude = Number(site.lng);
    const pinColor = getBoroughColor(site.borough);

    const marker = L.marker([latitude, longitude], {
      icon: createCustomMarker(pinColor),
      title: name
    });

    marker.bindPopup(createSitePopupHtml(site));

    marker.on("click", () => {
      openSiteDetail(site, false);
    });

    markerGroup.addLayer(marker);

    const card = document.createElement("article");
    card.className = "site-card";
    card.style.borderLeft = `5px solid ${pinColor}`;
    card.tabIndex = 0;

    card.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <p class="site-address">${escapeHtml(address)}</p>
      <p class="site-borough">${escapeHtml(borough)}</p>
      <p class="site-phone">${escapeHtml(phone)}</p>
      <button type="button" class="route-btn">
        ${escapeHtml(text("routeButton"))}
      </button>
    `;

    const openDetail = () => {
      marker.openPopup();
      openSiteDetail(site);
    };

    card.addEventListener("click", openDetail);

    card.querySelector(".route-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      openDetail();
      openDirectionsPanel();
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail();
      }
    });

    listContainer.appendChild(card);
  });
}

function populateZipFilter(sites) {
  const zipFilter = document.getElementById("zipFilter");
  const selectedZip = zipFilter.value || "all";

  const zipCodes = [
    ...new Set(
      sites
        .map((site) => safeText(site.zip).trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  zipFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = text("allZipCodes");
  zipFilter.appendChild(allOption);

  zipCodes.forEach((zip) => {
    const option = document.createElement("option");
    option.value = zip;
    option.textContent = zip;
    zipFilter.appendChild(option);
  });

  zipFilter.value = zipCodes.includes(selectedZip) ? selectedZip : "all";
}

function filterMarkers() {
  const selectedZip = document.getElementById("zipFilter").value;

  if (selectedZip === "all") {
    displaySites(allSites);
    return;
  }

  displaySites(
    allSites.filter((site) => safeText(site.zip).trim() === selectedZip)
  );
}

function addBoroughLegend() {
  const legend = window.L.control({
    position: "bottomright"
  });

  legend.onAdd = function () {
    const container = window.L.DomUtil.create(
      "div",
      "borough-legend leaflet-control"
    );

    container.id = "borough-legend";
    renderBoroughLegend(container);

    window.L.DomEvent.disableClickPropagation(container);
    window.L.DomEvent.disableScrollPropagation(container);

    return container;
  };

  legend.addTo(map);
}

function renderBoroughLegend(container) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="borough-legend-title">${escapeHtml(text("boroughLegend"))}</div>

    <div class="borough-legend-item">
      <span class="borough-legend-dot" style="background: orange;"></span>
      Queens
    </div>

    <div class="borough-legend-item">
      <span class="borough-legend-dot" style="background: purple;"></span>
      Brooklyn
    </div>

    <div class="borough-legend-item">
      <span class="borough-legend-dot" style="background: red;"></span>
      Bronx
    </div>

    <div class="borough-legend-item">
      <span class="borough-legend-dot" style="background: blue;"></span>
      Manhattan
    </div>

    <div class="borough-legend-item">
      <span class="borough-legend-dot" style="background: green;"></span>
      Staten Island
    </div>

    <div class="borough-legend-item">
      <span class="borough-legend-pin">📍</span>
      ${escapeHtml(text("pinnedLocationLegend"))}
    </div>
  `;
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

function locateUser() {
  const L = window.L;
  const button = document.getElementById("locate-btn");

  if (!navigator.geolocation) {
    button.textContent = text("locationUnsupported");
    alert(text("locationNotSupported"));
    return;
  }

  button.textContent = text("findingLocation");
  button.disabled = true;

  map.once("locationfound", (event) => {
    if (userLocationMarker) {
      map.removeLayer(userLocationMarker);
    }

    userLocationMarker = L.marker(event.latlng, {
      icon: createUserLocationMarker(),
      title: text("yourLocation")
    })
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(text("youAreHere"))}</strong>`);

    const startMarker = addStartPoint(event.latlng, text("yourLocation"));

    map.flyTo(event.latlng, 14, {
      duration: 0.75
    });

    startMarker.openPopup();
    button.textContent = text("locationFound");
    button.disabled = false;
  });

  map.once("locationerror", (event) => {
    console.error("Location error:", event.message);

    button.textContent = text("locationUnsupported");
    button.disabled = false;

    alert(text("locationDeniedAlert"));
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

  timestamp.textContent = `${text("lastChecked")}: ${new Date().toLocaleString(
    currentLanguage === "es" ? "es-US" : "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  )}`;
}

function refreshStartPinPopups() {
  startMarkers.forEach((marker) => {
    marker.setIcon(createStartPointMarker(marker === selectedStartMarker));
    marker.setPopupContent(startPointPopupHtml(marker));
  });
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = text("documentTitle");

  document.getElementById("site-title").textContent = text("title");
  document.getElementById("site-subtitle").textContent = text("subtitle");
  document.getElementById("zip-filter-label").textContent = text("zipLabel");
  document.getElementById("instructions-heading").textContent =
    text("instructionsHeading");
  document.getElementById("instructions-text").textContent =
    text("instructions");
  document.getElementById("back-to-list-btn").textContent =
    text("detailsBack");
  document.getElementById("back-from-directions-btn").textContent =
    text("directionsBack");
  document.getElementById("directions-heading").textContent =
    text("directionsHeading");
  document.getElementById("start-point-label").textContent =
    text("startPoint");
  document.getElementById("destination-label").textContent =
    text("destination");
  document.getElementById("travel-mode-label").textContent =
    text("travelMode");

  const languageToggle = document.getElementById("cyber-toggle");

  languageToggle.checked = currentLanguage === "es";
  languageToggle.setAttribute(
    "aria-label",
    currentLanguage === "en"
      ? "Switch website language to Spanish"
      : "Cambiar el idioma del sitio web a inglés"
  );

  document.getElementById("swap-directions-btn").setAttribute(
    "aria-label",
    text("reverseDirections")
  );

  document.getElementById("swap-directions-btn").title =
    text("reverseDirections");

  const routeModeSelect = document.getElementById("route-mode");

  routeModeSelect.options[0].textContent = text("chooseTravelMode");
  routeModeSelect.options[1].textContent = text("transit");
  routeModeSelect.options[2].textContent = text("drive");
  routeModeSelect.options[3].textContent = text("walk");
  routeModeSelect.options[4].textContent = text("bicycle");

  document.getElementById("site-list").setAttribute(
    "aria-label",
    text("siteListLabel")
  );

  document.querySelector(".filter-group").setAttribute(
    "aria-label",
    text("filterLabel")
  );

  document.getElementById("map").setAttribute("aria-label", text("mapLabel"));

  const locateButton = document.getElementById("locate-btn");

  if (!locateButton.disabled) {
    locateButton.textContent = text("locate");
  }

  populateZipFilter(allSites);

  const selectedZip = document.getElementById("zipFilter").value || "all";

  if (allSites.length) {
    displaySites(
      selectedZip === "all"
        ? allSites
        : allSites.filter(
            (site) => safeText(site.zip).trim() === selectedZip
          )
    );
  }

  if (selectedDestination) {
    renderSiteDetail(selectedDestination);
    populateDirectionsDestination();
  }

  populateStartPinSelect();
  refreshStartPinPopups();
  renderBoroughLegend(document.getElementById("borough-legend"));

  if (directionsHasOpened) {
    updateRouteStatus();
  }

  updateTimestamp();
}

function toggleLanguage() {
  currentLanguage = document.getElementById("cyber-toggle").checked
    ? "es"
    : "en";

  const hasActiveRoute =
    routeLayer &&
    activeRouteGeometry &&
    selectedStartPoint &&
    selectedDestination &&
    document.getElementById("route-mode")?.value;

  applyLanguage();

  if (hasActiveRoute) {
    document.getElementById("route-status").textContent =
      text("translatingRoute");

    requestRoute({
      keepGeometry: true,
      shouldFitBounds: false,
      statusMessage: text("translatingRoute")
    });
  }
}

function initMap() {
  const L = window.L;
  const mapElement = document.getElementById("map");

  if (!mapElement) {
    console.error('The HTML element with id="map" is missing.');
    return;
  }

  if (!L) {
    mapElement.innerHTML = `
      <div class="map-error">
        The map library failed to load. Please refresh or check the Leaflet script tag.
      </div>
    `;
    return;
  }

  map = L.map("map").setView([40.7128, -74.006], 11);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }
  ).addTo(map);

  markerGroup = L.layerGroup().addTo(map);

  addBoroughLegend();

  map.on("click", (event) => {
    addStartPoint(event.latlng);
  });

  map.on("popupopen", handlePopupActions);

  document.getElementById("locate-btn").addEventListener("click", locateUser);
  document.getElementById("zipFilter").addEventListener("change", filterMarkers);

  document
    .getElementById("cyber-toggle")
    .addEventListener("change", toggleLanguage);

  document.getElementById("back-to-list-btn").addEventListener("click", () => {
    showSidebarView("home");
  });

  document
    .getElementById("back-from-directions-btn")
    .addEventListener("click", () => {
      showSidebarView("detail");
    });

  document
    .getElementById("start-pin-select")
    .addEventListener("change", (event) => {
      const marker = startMarkers.get(event.target.value);

      if (marker) {
        setSelectedStartMarker(marker);
      }

      updateRouteStatus();
    });

  document
    .getElementById("route-mode")
    .addEventListener("change", () => requestRoute());

  document
    .getElementById("swap-directions-btn")
    .addEventListener("click", reverseDirections);

  applyLanguage();
  loadSites();
}

document.addEventListener("DOMContentLoaded", initMap);
