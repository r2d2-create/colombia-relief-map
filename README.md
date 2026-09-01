# colombia-relief-map
This interactive web map tool helps New Yorkers find, relative to where they're physically located, local donation spots accepting supplies and aid for the Colombian earthquake recovery efforts.

**Key Features:**

🗺️ Interactive Relief Map: View verified collection points across the five boroughs.

🔍 ZIP Code Filter: Quick-drop filters to pinpoint active collection sites right in your ZIP Code.

🚇 Direct Multi-Modal Transit Routing: Single-click routing links that open directly in Google Maps to guide your trip via walking, driving, subways, buses, or biking.

🗣 Bilingual English/Spanish Versions: Toggle between English and Spanish versions of the map for better accessibility.

**Data Sources:**

- **Donation Sites:** I web scraped the list of **verified** donation sites from the Flourish widget table in Documented NY's article here: https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/ . In the `scraper.py` file, I converted donation-site addresses into latitude/longitude coordinates using the NYC Geoclient API. The scraper stores successful lookup results in `geocode_cache.json` and generates the map-ready `sites.json` dataset.

- **Basemap:** I used CARTO Voyager raster tiles for the basemap and displayed OpenStreetMap and CARTO attribution in the application.

- **Directions:** I obtained route geometry and turn-by-turn directions from the Google Routes API using a Cloudflare Worker proxy.

- **Interactive map:** I ultimately built the web map with Leaflet, an open-source JavaScript library for interactive maps. I used Leaflet to render the donation-site markers, user pins, map popups, route lines, transit overlays, and interactive controls.
