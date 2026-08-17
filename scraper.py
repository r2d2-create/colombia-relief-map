import html
import json
import os
import re
from pathlib import Path

import requests


SOURCE_URL = "https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/"
FLOURISH_EMBED_URL = "https://flo.uri.sh/visualisation/29940879/embed"

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = PROJECT_ROOT / "sites.json"
GEOCODE_CACHE_FILE = PROJECT_ROOT / "geocode_cache.json"

PROJECT_URL = "https://github.com/r2d2-create/colombia-relief-map"
CONTACT_EMAIL = "end259@nyu.edu"

GEOCLIENT_API_KEY = os.environ.get("NYC_GEOCLIENT_API_KEY", "").strip()
GEOCLIENT_SEARCH_URL = "https://api.nyc.gov/geoclient/v2/search.json"

SOURCE_HEADERS = {
    "User-Agent": (
        f"ColombiaReliefDonationMap/1.0 "
        f"({PROJECT_URL}; contact: {CONTACT_EMAIL})"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

GEOCLIENT_HEADERS = {
    "Accept": "application/json",
    "Ocp-Apim-Subscription-Key": GEOCLIENT_API_KEY,
}


def write_json(file_path, data):
    """Safely write formatted JSON to a project file."""
    temporary_file = file_path.with_suffix(f"{file_path.suffix}.tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")

    temporary_file.replace(file_path)


def load_json(file_path, fallback):
    """Load existing JSON, returning fallback if unavailable or invalid."""
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
    """Normalize text for matching and deduplication."""
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)

    return re.sub(r"\s+", " ", value).strip()


def extract_zip(address_text):
    """Return the first five-digit ZIP code in text, if present."""
    match = re.search(r"\b(\d{5})(?:-\d{4})?\b", address_text)

    return match.group(1) if match else ""


def normalize_borough(value):
    """Return a consistent NYC borough label."""
    text = normalize_text(value)

    boroughs = {
        "queens": "Queens",
        "brooklyn": "Brooklyn",
        "bronx": "Bronx",
        "manhattan": "Manhattan",
        "staten island": "Staten Island",
    }

    for keyword, borough_name in boroughs.items():
        if keyword in text:
            return borough_name

    return "Other"


def normalize_address_for_geocoding(address):
    """
    Prepare an address for Geoclient.

    Preserves NYC/Queens house-number hyphens and removes suite, unit,
    apartment, and floor details that do not identify the building itself.
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
        r"\bblvd\.?\b": "Boulevard",
        r"\bave\.?\b": "Avenue",
        r"\bst\.?\b": "Street",
        r"\brd\.?\b": "Road",
        r"\bdr\.?\b": "Drive",
        r"\bpl\.?\b": "Place",
        r"\bct\.?\b": "Court",
        r"\bpkwy\.?\b": "Parkway",
        r"\bhwy\.?\b": "Highway",
    }

    for pattern, replacement in street_replacements.items():
        address = re.sub(pattern, replacement, address, flags=re.IGNORECASE)

    address = re.sub(
        r"\b103-29\s+101\s+Street\b",
        "103-29 101st Street",
        address,
        flags=re.IGNORECASE,
    )

    address = re.sub(r"\s*,\s*", ", ", address)
    address = re.sub(r"\s+", " ", address)

    return address.strip(" ,")


def split_house_number_and_street(address):
    """
    Split the first address component into house number and street name.

    Example:
    41-40 Junction Boulevard, Corona, NY 11368
    -> ("41-40", "Junction Boulevard")
    """
    street_part = address.split(",", maxsplit=1)[0].strip()

    match = re.match(
        r"^(\d{1,4}(?:-\d{1,4})?)\s+(.+)$",
        street_part,
    )

    if not match:
        return "", street_part

    return match.group(1), match.group(2).strip()


def geocode_cache_key(address, borough):
    """Return a cache key only for the current Geoclient implementation."""
    normalized_address = normalize_address_for_geocoding(address).lower()
    normalized_address = re.sub(r"[^a-z0-9\s-]", " ", normalized_address)
    normalized_address = re.sub(r"\s+", " ", normalized_address).strip()

    return f"geoclient-v1:{borough.lower()}:{normalized_address}"


def first_value(data, keys):
    """Return the first non-empty value for a list of possible field names."""
    for key in keys:
        value = data.get(key)

        if value not in (None, ""):
            return value

    return ""


def flatten_geoclient_candidate(candidate):
    """Merge common nested Geoclient response objects into one dictionary."""
    if not isinstance(candidate, dict):
        return {}

    fields = dict(candidate)

    for nested_key in ("response", "address", "result", "geocodedAddress"):
        nested = candidate.get(nested_key)

        if isinstance(nested, dict):
            fields.update(nested)

    return fields


def geoclient_result_to_location(response_data, fallback_borough):
    """Extract coordinates, ZIP, and a clean display address from Geoclient."""
    candidates = []

    if isinstance(response_data, list):
        candidates = response_data
    elif isinstance(response_data, dict):
        for key in ("results", "candidates", "addresses"):
            value = response_data.get(key)

            if isinstance(value, list):
                candidates = value
                break

        if not candidates:
            candidates = [response_data]

    for candidate in candidates:
        fields = flatten_geoclient_candidate(candidate)

        latitude = first_value(
            fields,
            ("latitude", "lat", "yCoordinate", "y_coordinate"),
        )
        longitude = first_value(
            fields,
            ("longitude", "lon", "lng", "xCoordinate", "x_coordinate"),
        )

        try:
            lat = float(latitude)
            lng = float(longitude)
        except (TypeError, ValueError):
            continue

        house_number = clean_text(
            first_value(
                fields,
                ("houseNumber", "house_number", "houseNumberDisplayFormat"),
            )
        )

        street_name = clean_text(
            first_value(
                fields,
                ("streetName", "street", "streetName1", "streetName2"),
            )
        )

        zip_code = clean_text(
            first_value(
                fields,
                ("zipCode", "zip", "zipCode5", "zip_code"),
            )
        )

        borough_name = clean_text(
            first_value(
                fields,
                ("boroughName", "borough", "firstBoroughName"),
            )
        ) or fallback_borough

        street_address = " ".join(
            part for part in (house_number, street_name) if part
        ).strip()

        if street_address and zip_code:
            geocoded_address = (
                f"{street_address}, {borough_name}, NY {zip_code}"
            )
        elif street_address:
            geocoded_address = f"{street_address}, {borough_name}, NY"
        else:
            geocoded_address = f"{borough_name}, NY {zip_code}".strip()

        return {
            "lat": lat,
            "lng": lng,
            "zip": zip_code,
            "geocoded_address": geocoded_address,
            "geocode_method": "nyc_geoclient_v2",
        }

    return None


def extract_balanced_json_object(text, start_index):
    """Return a full nested JSON object beginning at an opening brace."""
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
    """Geocode one NYC address with Geoclient V2 and cache the result."""
    if borough == "Other":
        print(f"Skipped non-NYC record: {address}")
        return None

    if not GEOCLIENT_API_KEY:
        raise RuntimeError(
            "NYC_GEOCLIENT_API_KEY is missing. Add it as a GitHub Actions "
            "secret and pass it into the scraper workflow step."
        )

    cache_key = geocode_cache_key(address, borough)
    cached_location = cache.get(cache_key)

    if isinstance(cached_location, dict):
        lat = cached_location.get("lat")
        lng = cached_location.get("lng")

        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            print(f"Using cached Geoclient result: {address}")
            return cached_location

    normalized_address = normalize_address_for_geocoding(address)
    house_number, street = split_house_number_and_street(normalized_address)

    if not house_number or not street:
        print(f"Could not separate house number and street: {address}")
        return None

    input_address = f"{house_number} {street}, {borough}, NY"

    print(f"Geocoding with Geoclient: {input_address}")

    try:
        response = requests.get(
            GEOCLIENT_SEARCH_URL,
            params={"Input": input_address},
            headers=GEOCLIENT_HEADERS,
            timeout=30,
        )
        response.raise_for_status()
        response_data = response.json()
    except (requests.RequestException, ValueError) as error:
        print(f"Temporary Geoclient failure for '{address}': {error}")
        return None

    location = geoclient_result_to_location(response_data, borough)

    if location is None:
        print(f"No Geoclient result found for: {address}")
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

        source_zip = extract_zip(site["address"])
        geocoded_zip = clean_text(location.get("zip", ""))

        map_sites.append(
            {
                "name": site["name"],
                "address": site["address"],
                "borough": site["borough"],
                "zip": geocoded_zip or source_zip,
                "phone": site["phone"],
                "lat": location["lat"],
                "lng": location["lng"],
                "source_url": SOURCE_URL,
                "geocoded_address": location["geocoded_address"],
                "geocode_method": location["geocode_method"],
            }
        )

    write_json(GEOCODE_CACHE_FILE, cache)
    return map_sites


def auto_scrape():
    """Download source data, geocode NYC sites, and write JSON outputs."""
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
