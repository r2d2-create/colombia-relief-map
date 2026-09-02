# colombia-relief-map
This interactive web map tool helps New Yorkers find, relative to where they're physically located, local donation spots accepting supplies and aid for the Colombian earthquake recovery efforts.

Check out the web map here: https://r2d2-create.github.io/colombia-relief-map/  

# Key Features:

- 🗺️ **Interactive Relief Map:** View verified collection points across the five boroughs.

- 🔍 **ZIP Code Filter:** Quick-drop filters to pinpoint active collection sites right in your ZIP Code.

- 🚇 **Direct Multi-Modal Transit Routing:** Single-click routing links that open directly in Google Maps to guide your trip via walking, driving, subways, buses, or biking.

- 🗣 **Bilingual English/Spanish Versions:** Toggle between English and Spanish versions of the map for better accessibility.

# Data Sources:

- **Verified Donation Sites:** Sourced from from the Flourish widget table embedded in Documented NY's article here: https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/ .
    -   In the `scraper.py` file, I web scraped the list of **verified** donation sites from the table. I   then converted donation-site addresses into latitude/longitude coordinates using the NYC Geoclient API.    The scraper stores successful geocoding results in `geocode_cache.json` and generates the map-ready       `sites.json` dataset.

- **Basemap:** Sourced from CARTO Voyager raster tiles.

- **Directions:** Sourced route geometry and turn-by-turn directions from the Google Routes API through a Cloudflare Worker proxy.

- **Interactive map:** I built the web map with Leaflet. I used Leaflet to render the donation-site markers, user pins, popups, route lines, transit overlays, and interactive controls.
