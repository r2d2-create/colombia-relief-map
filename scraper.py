import html
import json
import re
import time
from pathlib import Path

import requests


SOURCE_URL = "https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/"
FLOURISH_EMBED_URL = "https://flo.uri.sh/visualisation/29940879/embed"

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = PROJECT_ROOT / "sites.json"
GEOCODE_CACHE_FILE = PROJECT_ROOT / "geocode_cache.json"

PROJECT_URL = "https://github.com/r2d2-create/colombia-relief-map"
CONTACT_EMAIL = "end259@nyu.edu"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
GEOCODE_DELAY_SECONDS = 15
NYC_VIEWBOX = "-74.30,40.45,-73.65,40.95"

SOURCE_HEADERS = {
    "User-Agent": (
        f"ColombiaReliefDonationMap/1.0 "
        f"({PROJECT_URL}; contact: {CONTACT_EMAIL})"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

GEOCODE_HEADERS = {
    "User-Agent": (
        f"ColombiaReliefDonationMap/1.0 "
        f"({PROJECT_URL}; contact: {CONTACT_EMAIL})"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}


def write_json(file_path, data):
    """Safely write formatted JSON to a project file."""
    temporary_file = file_path.with_suffix(f"{file_path.suffix}.tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    temporary_file.replace(file_path)


def load_json(file_path, fallback):
    """Load an existing JSON file, returning fallback if unavailable."""
    if not file_path.exists():
        return fallback

    try:
        with file_path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        print(f"Could not read {file_path.name}: {error}")
        return fallback


def clean_text(value):
    """Normalize text scraped from HTML and Flourish table cells."""
    if value is None:
        return ""

    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def normalize_text(value):
    """Normalize text for deduplication and general comparisons."""
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)

    return re.sub(r"\s+", " ", value).strip()


def extract_zip(address_text):
    """Return the first five-digit ZIP code in an address, if present."""
    match = re.search(r"\b(\d{5})(?:-\d{4})?\b", address_text)

    return match.group(1) if match else ""


def normalize_borough(value):
    """Return a consistent borough/county label."""
    text = normalize_text(value)

    names = {
        "queens": "Queens",
        "brooklyn": "Brooklyn",
        "bronx": "Bronx",
        "manhattan": "Manhattan",
        "staten island": "Staten Island",
        "nassau": "Nassau County",
    }

    for keyword, standardized_name in names.items():
        if keyword in text:
            return standardized_name

    return "Other"


def normalize_address_for_geocoding(address):
    """
    Prepare a street address for geocoding.

    Preserve/restore NYC Queens-style numeric house-number hyphens such as:
    91 31 Queens Blvd -> 91-31 Queens Blvd

    Remove suite, apartment, floor, and similar interior-location details.
    """
    address = clean_text(address)

    address = re.sub(
        r"^\s*(\d{1,3})\s*(?:-|\s)\s*(\d{1,3})\b",
        r"\1-\2",
        address,
    )

    address = re.sub(
        r"\b(?:suite|ste\.?|unit|apt\.?|apartment|floor|fl\.?|"
        r"ground\s+floor)\s*[#A-Za-z0-9-]*\b",
        "",
        address,
        flags=re.IGNORECASE,
    )

    street_replacements = {
        r"\bblvd\b\.?": "Boulevard",
        r"\bave\b\.?": "Avenue",
        r"\bst\b\.?": "Street",
        r"\brd\b\.?": "Road",
        r"\bdr\b\.?": "Drive",
        r"\bpl\b\.?": "Place",
        r"\bct\b\.?": "Court",
        r"\bpkwy\b\.?": "Parkway",
        r"\bhwy\b\.?": "Highway",
    }

    for pattern, replacement in street_replacements.items():
        address = re.sub(
            pattern,
            replacement,
            address,
            flags=re.IGNORECASE,
        )

    address = re.sub(r"\s*,\s*", ", ", address)
    address = re.sub(r"\s+", " ", address)

    return address.strip(" ,")


def geocode_cache_key(query):
    """
    Return a geocoding cache key that preserves numeric hyphens.

    The v2 prefix intentionally prevents prior v1 cached null results from
    blocking re-geocoding after address normalization improvements.
    """
    query = clean_text(query).lower()

    query = re.sub(r"(?<!\d)-(?!\d)", " ", query)
    query = re.sub(r"[^a-z0-9\s-]", " ", query)
    query = re.sub(r"\s+", " ", query).strip()

    return f"v2:{query}"


def address_for_geocoding(address, borough):
    """Build a clean, location-specific query for Nominatim."""
    address = normalize_address_for_geocoding(address)
    address_lower = address.lower()

    has_state = bool(re.search(r"\bny\b", address_lower))
    has_new_york = "new york" in address_lower
    has_zip = bool(extract_zip(address))

    if borough == "Nassau County":
        location_context = "Freeport, Nassau County, NY, USA"
    elif borough == "Bronx":
        location_context = "Bronx, NY, USA"
    elif borough == "Brooklyn":
        location_context = "Brooklyn, NY, USA"
    elif borough == "Manhattan":
        location_context = "Manhattan, NY, USA"
    elif borough == "Staten Island":
        location_context = "Staten Island, NY, USA"
    else:
        location_context = "Queens, NY, USA"

    if has_state or has_new_york or has_zip:
        return f"{address}, USA"

    return f"{address}, {location_context}"


def extract_balanced_json_object(text, start_index):
    """
    Starting at an opening `{`, return the full nested JSON object.
    Handles braces contained within quoted strings.
    """
    if start_index >= len(text) or text[start_index] != "{":
        return None

    depth = 0
    in_string = False
    escape_next = False

    for index in range(start_index, len(text)):
        character = text[index]

        if in_string:
            if escape_next:
                escape_next = False
            elif character == "\\":
                escape_next = True
            elif character == '"':
                in_string = False

            continue

        if character == '"':
            in_string = True
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1

            if depth == 0:
                return text[start_index:index + 1]

    return None


def extract_flourish_rows(page_html):
    """Extract the Flourish `_Flourish_data` rows from the embed HTML."""
    assignment_match = re.search(r"\b_Flourish_data\s*=\s*", page_html)

    if not assignment_match:
        print("Could not find the '_Flourish_data =' assignment in the source page.")
        return []

    after_assignment = page_html[assignment_match.end():]
    object_start_relative = after_assignment.find("{")

    if object_start_relative == -1:
        print("Found '_Flourish_data' but could not find its opening JSON object.")
        return []

    object_start = assignment_match.end() + object_start_relative
    raw_json = extract_balanced_json_object(page_html, object_start)

    if not raw_json:
        print("Could not isolate the complete Flourish JSON object.")
        return []

    try:
        flourish_data = json.loads(raw_json)
    except json.JSONDecodeError as error:
        print(f"Could not parse Flourish JSON: {error}")
        return []

    rows = flourish_data.get("rows", [])

    if not isinstance(rows, list):
        print("Flourish data was found, but its 'rows' value was not a list.")
        return []

    print(f"Found {len(rows)} row(s) in the Flourish donation-site table.")
    return rows


def source_rows_to_sites(rows):
    """Convert Flourish rows into normalized donation-site records."""
    sites = []
    seen = set()

    for row in rows:
        columns = row.get("columns", [])

        if not isinstance(columns, list) or len(columns) < 4:
            continue

        name = clean_text(columns[0])
        address = clean_text(columns[1])
        borough = normalize_borough(columns[2])
        phone = clean_text(columns[3]) or "N/A"

        if not name or not address:
            continue

        dedupe_key = (normalize_text(name), normalize_text(address))

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        sites.append(
            {
                "name": name,
                "address": address,
                "borough": borough,
                "phone": phone,
            }
        )

    print(f"Prepared {len(sites)} unique site record(s) for geocoding.")
    return sites


def geocode_address(address, borough, cache):
    """
    Return latitude/longitude for an address and cache results.

    Failed results are cached using a v2 address key. This prevents repeated
    requests for the same normalized query, while allowing old cache entries
    from the previous normalization method to remain unused.
    """
    query = address_for_geocoding(address, borough)
    cache_key = geocode_cache_key(query)
    cached_location = cache.get(cache_key)

    if isinstance(cached_location, dict):
        lat = cached_location.get("lat")
        lng = cached_location.get("lng")

        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            print(f"Using cached geocode: {address}")
            return cached_location

    if cache_key in cache and cached_location is None:
        print(f"Using cached no-match result: {address}")
        return None

    print(f"Geocoding: {query}")

    parameters = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 1,
        "countrycodes": "us",
        "viewbox": NYC_VIEWBOX,
        "bounded": 1,
    }

    try:
        response = requests.get(
            NOMINATIM_URL,
            params=parameters,
            headers=GEOCODE_HEADERS,
            timeout=30,
        )
        response.raise_for_status()
        results = response.json()
    except (requests.RequestException, ValueError) as error:
        print(f"Temporary geocoding failure for '{address}': {error}")
        print("This error was not cached, so a later run can retry it.")
        time.sleep(GEOCODE_DELAY_SECONDS)
        return None

    time.sleep(GEOCODE_DELAY_SECONDS)

    if not results:
        print(f"No geocode result found for: {address}")
        cache[cache_key] = None
        write_json(GEOCODE_CACHE_FILE, cache)
        return None

    result = results[0]

    try:
        location = {
            "lat": float(result["lat"]),
            "lng": float(result["lon"]),
            "geocoded_address": clean_text(result.get("display_name", "")),
        }
    except (KeyError, TypeError, ValueError):
        print(f"Geocoding returned unusable coordinates for: {address}")
        cache[cache_key] = None
        write_json(GEOCODE_CACHE_FILE, cache)
        return None

    cache[cache_key] = location
    write_json(GEOCODE_CACHE_FILE, cache)

    return location


def build_map_sites(source_sites):
    """Geocode source records and create the map-ready output dataset."""
    cache = load_json(GEOCODE_CACHE_FILE, {})
    map_sites = []

    for site in source_sites:
        location = geocode_address(
            site["address"],
            site["borough"],
            cache,
        )

        if location is None:
            print(f"Skipped site without coordinates: {site['name']}")
            continue

        map_sites.append(
            {
                "name": site["name"],
                "address": site["address"],
                "borough": site["borough"],
                "zip": extract_zip(site["address"]),
                "phone": site["phone"],
                "lat": location["lat"],
                "lng": location["lng"],
                "source_url": SOURCE_URL,
                "geocoded_address": location["geocoded_address"],
            }
        )

    write_json(GEOCODE_CACHE_FILE, cache)
    return map_sites


def auto_scrape():
    """Download source data, geocode valid locations, and write sites.json."""
    try:
        response = requests.get(
            FLOURISH_EMBED_URL,
            headers=SOURCE_HEADERS,
            timeout=30,
        )
        print(f"Flourish embed HTTP status: {response.status_code}")
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"Could not retrieve Flourish embed: {error}")
        write_json(OUTPUT_FILE, [])
        return

    print(f"Downloaded {len(response.text):,} characters from Flourish embed.")

    flourish_rows = extract_flourish_rows(response.text)

    if not flourish_rows:
        print("No donation-site rows were extracted from Flourish.")
        write_json(OUTPUT_FILE, [])
        return

    source_sites = source_rows_to_sites(flourish_rows)
    map_sites = build_map_sites(source_sites)

    write_json(OUTPUT_FILE, map_sites)

    print(f"Saved {len(map_sites)} map-ready donation site(s).")
    print(f"Updated geocoding cache: {GEOCODE_CACHE_FILE.name}")


if __name__ == "__main__":
    auto_scrape()
