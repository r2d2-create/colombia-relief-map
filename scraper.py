import ast
import html
import json
import re
import time
from pathlib import Path

import requests


SOURCE_URL = "https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/"

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = PROJECT_ROOT / "sites.json"
GEOCODE_CACHE_FILE = PROJECT_ROOT / "geocode_cache.json"

PROJECT_URL = "https://github.com/YOUR-USERNAME/YOUR-REPOSITORY"
CONTACT_EMAIL = "YOUR-EMAIL@example.com"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
GEOCODE_DELAY_SECONDS = 15
NYC_VIEWBOX = "-74.2591,40.4774,-73.7004,40.9176"

SOURCE_HEADERS = {
    "User-Agent": (
        f"ColombiaReliefDonationMap/1.0 "
        f"({PROJECT_URL}; contact: {CONTACT_EMAIL})"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

GEOCODE_HEADERS = {
    "User-Agent": (
        f"ColombiaReliefDonationMap/1.0 "
        f"({PROJECT_URL}; contact: {CONTACT_EMAIL})"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9"
}


def write_json(file_path, data):
    """Write JSON atomically so Actions never leaves a partially written file."""
    temporary_file = file_path.with_suffix(f"{file_path.suffix}.tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2, sort_keys=True)
        file.write("\n")

    temporary_file.replace(file_path)


def load_json(file_path, fallback):
    """Load JSON data, returning a safe fallback when the file is absent or invalid."""
    if not file_path.exists():
        return fallback

    try:
        with file_path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, OSError) as error:
        print(f"Could not read {file_path.name}: {error}")
        return fallback


def clean_text(value):
    """Convert scraped values into normalized, single-line text."""
    if value is None:
        return ""

    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_text(value):
    """Normalize text for comparisons and cache keys."""
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def extract_zip(address_text):
    """Extract a US five-digit ZIP code, if the source includes one."""
    match = re.search(r"\b(\d{5})(?:-\d{4})?\b", address_text)
    return match.group(1) if match else ""


def extract_house_number(address_text):
    """Extract a leading-style street number for basic geocoding verification."""
    match = re.search(r"\b(\d{1,6}[a-zA-Z]?)\b", address_text)
    return match.group(1).lower() if match else ""


def normalize_borough(value):
    """Convert source borough labels into a consistent set of map values."""
    text = normalize_text(value)

    borough_names = {
        "queens": "Queens",
        "brooklyn": "Brooklyn",
        "bronx": "Bronx",
        "manhattan": "Manhattan",
        "staten island": "Staten Island"
    }

    for keyword, borough in borough_names.items():
        if keyword in text:
            return borough

    return "Other"


def borough_from_geocode(result):
    """Read a borough from Nominatim structured address fields when possible."""
    address = result.get("address", {})
    display_name = normalize_text(result.get("display_name", ""))

    candidates = [
        address.get("borough", ""),
        address.get("city_district", ""),
        address.get("suburb", ""),
        address.get("city", ""),
        display_name
    ]

    for candidate in candidates:
        borough = normalize_borough(candidate)

        if borough != "Other":
            return borough

    return "Other"


def extract_balanced_object(text, start_index):
    """Return a complete balanced object or array starting at start_index."""
    opening_character = text[start_index]

    if opening_character == "{":
        closing_character = "}"
    elif opening_character == "[":
        closing_character = "]"
    else:
        return None

    depth = 0
    in_string = False
    quote_character = None
    escaped = False

    for index in range(start_index, len(text)):
        character = text[index]

        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote_character:
                in_string = False
                quote_character = None
            continue

        if character in ('"', "'"):
            in_string = True
            quote_character = character
        elif character == opening_character:
            depth += 1
        elif character == closing_character:
            depth -= 1

            if depth == 0:
                return text[start_index:index + 1]

    return None


def parse_json_like(raw_text):
    """Parse strict JSON, then a limited Python-like embedded-data fallback."""
    raw_text = raw_text.strip().rstrip(";")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    python_like_text = re.sub(
        r"\btrue\b",
        "True",
        raw_text,
        flags=re.IGNORECASE
    )
    python_like_text = re.sub(
        r"\bfalse\b",
        "False",
        python_like_text,
        flags=re.IGNORECASE
    )
    python_like_text = re.sub(
        r"\bnull\b",
        "None",
        python_like_text,
        flags=re.IGNORECASE
    )

    try:
        return ast.literal_eval(python_like_text)
    except (ValueError, SyntaxError) as error:
        print(f"Could not parse embedded data block: {error}")
        return None


def find_embedded_flourish_data(page_html):
    """Find and parse common Flourish data-variable patterns in the source HTML."""
    variable_patterns = [
        r"\b_Flourish_data\s*=",
        r"\bFlourish_data\s*=",
        r"\bflourishData\s*=",
        r"\bflourish_data\s*="
    ]

    for pattern in variable_patterns:
        match = re.search(pattern, page_html, flags=re.IGNORECASE)

        if not match:
            continue

        remainder = page_html[match.end():]
        opening_match = re.search(r"[\{\[]", remainder)

        if not opening_match:
            continue

        start_index = match.end() + opening_match.start()
        raw_block = extract_balanced_object(page_html, start_index)

        if not raw_block:
            print("Found a Flourish variable but could not isolate its data block.")
            continue

        parsed_data = parse_json_like(raw_block)

        if parsed_data is not None:
            print("Found and parsed an embedded Flourish data block.")
            return parsed_data

    return None


def get_rows(data):
    """Return tabular rows from several likely embedded-data layouts."""
    if isinstance(data, dict):
        if isinstance(data.get("rows"), list):
            return data["rows"]

        if isinstance(data.get("data"), list):
            return data["data"]

        for value in data.values():
            if isinstance(value, dict) and isinstance(value.get("rows"), list):
                return value["rows"]

    if isinstance(data, list):
        return data

    return []


def row_to_columns(row):
    """Support Flourish {'columns': [...]} rows and raw row arrays."""
    if isinstance(row, dict) and isinstance(row.get("columns"), list):
        return [clean_text(item) for item in row["columns"]]

    if isinstance(row, (list, tuple)):
        return [clean_text(item) for item in row]

    return []


def geocode_query(address, borough):
    """Build a focused NYC geocoding query from a scraped location."""
    parts = [address]

    if borough != "Other" and borough.lower() not in address.lower():
        parts.append(borough)

    if "new york" not in address.lower() and "ny" not in address.lower():
        parts.append("New York, NY")

    parts.append("USA")

    return ", ".join(parts)


def geocode_result_matches_source(source_address, result):
    """
    Reject a result when available ZIP or house-number evidence conflicts.

    If the source has no ZIP code, require both a matching house number and
    recognizable street words before publishing a precise marker.
    """
    returned_address = result.get("address", {})
    display_name = normalize_text(result.get("display_name", ""))

    source_zip = extract_zip(source_address)
    result_zip = str(returned_address.get("postcode", ""))[:5]

    if source_zip and result_zip and source_zip != result_zip:
        return False

    source_house_number = extract_house_number(source_address)
    result_house_number = normalize_text(returned_address.get("house_number", ""))

    if source_house_number and result_house_number:
        if source_house_number != result_house_number:
            return False

    ignored_words = {
        "street",
        "avenue",
        "boulevard",
        "road",
        "drive",
        "place",
        "court",
        "suite",
        "floor",
        "north",
        "south",
        "east",
        "west",
        "york",
        "new"
    }

    source_words = [
        word
        for word in normalize_text(source_address).split()
        if len(word) >= 4 and word not in ignored_words
    ]

    street_match = any(word in display_name for word in source_words)

    if source_zip:
        return street_match or source_house_number == result_house_number

    return bool(
        source_house_number
        and source_house_number == result_house_number
        and street_match
    )


def geocode_address(address, borough, cache):
    """
    Return verified coordinates for an address.

    The cache stores:
    - successful geocodes as a dictionary with lat/lng
    - durable no-match/ambiguous results as None

    Transient HTTP or network errors are NOT cached, so a later workflow run
    can retry without losing a previously valid cached coordinate.
    """
    query = geocode_query(address, borough)
    cache_key = normalize_text(query)

    if cache_key in cache:
        cached_result = cache[cache_key]

        if cached_result is None:
            print(f"Using cached no-match result: {address}")
            return None

        if (
            isinstance(cached_result, dict)
            and isinstance(cached_result.get("lat"), (int, float))
            and isinstance(cached_result.get("lng"), (int, float))
        ):
            print(f"Using cached coordinates: {address}")
            return cached_result

        print(f"Ignoring invalid cached entry and retrying: {address}")
        del cache[cache_key]
        write_json(GEOCODE_CACHE_FILE, cache)

    print(f"Geocoding: {query}")

    parameters = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 1,
        "countrycodes": "us",
        "viewbox": NYC_VIEWBOX,
        "bounded": 1
    }

    try:
        response = requests.get(
            NOMINATIM_URL,
            params=parameters,
            headers=GEOCODE_HEADERS,
            timeout=30
        )
        response.raise_for_status()
        results = response.json()
    except (requests.RequestException, ValueError) as error:
        print(f"Temporary geocoding failure for '{address}': {error}")
        print("This failure was not cached; a future scheduled run can retry it.")
        time.sleep(GEOCODE_DELAY_SECONDS)
        return None

    time.sleep(GEOCODE_DELAY_SECONDS)

    if not results:
        print(f"No geocoding result for: {address}")
        cache[cache_key] = None
        write_json(GEOCODE_CACHE_FILE, cache)
        return None

    result = results[0]

    if not geocode_result_matches_source(address, result):
        print(f"Rejected ambiguous geocoding result for: {address}")
        print(f"Returned: {result.get('display_name', '')}")

        cache[cache_key] = None
        write_json(GEOCODE_CACHE_FILE, cache)
        return None

    try:
        verified_location = {
            "lat": float(result["lat"]),
            "lng": float(result["lon"]),
            "display_name": clean_text(result.get("display_name", "")),
            "borough": borough_from_geocode(result)
        }
    except (KeyError, TypeError, ValueError):
        print(f"Geocoding result lacked usable coordinates for: {address}")

        cache[cache_key] = None
        write_json(GEOCODE_CACHE_FILE, cache)
        return None

    cache[cache_key] = verified_location
    write_json(GEOCODE_CACHE_FILE, cache)

    return verified_location


def parse_source_rows(data):
    """Extract raw location records from the scraped source table."""
    raw_sites = []

    for row in get_rows(data):
        columns = row_to_columns(row)

        if len(columns) < 2:
            continue

        name = clean_text(columns[0])
        address = clean_text(columns[1])
        borough = normalize_borough(columns[2] if len(columns) > 2 else "")
        phone = clean_text(columns[3] if len(columns) > 3 else "") or "N/A"

        if not name or not address:
            continue

        raw_sites.append({
            "name": name,
            "address": address,
            "borough": borough,
            "phone": phone
        })

    return raw_sites


def build_map_sites(raw_sites):
    """Geocode, validate, and deduplicate source records for the web map."""
    cache = load_json(GEOCODE_CACHE_FILE, {})
    map_sites = []
    seen = set()

    for site in raw_sites:
        dedupe_key = (
            normalize_text(site["name"]),
            normalize_text(site["address"])
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        location = geocode_address(
            site["address"],
            site["borough"],
            cache
        )

        if location is None:
            print(f"Skipped site without verified coordinates: {site['name']}")
            continue

        final_borough = location["borough"]

        if final_borough == "Other":
            final_borough = site["borough"]

        map_sites.append({
            "name": site["name"],
            "address": site["address"],
            "borough": final_borough,
            "zip": extract_zip(site["address"]),
            "phone": site["phone"],
            "lat": location["lat"],
            "lng": location["lng"],
            "source_url": SOURCE_URL,
            "geocoded_address": location["display_name"]
        })

    write_json(GEOCODE_CACHE_FILE, cache)
    return map_sites


def auto_scrape():
    """
    Fetch source locations, geocode verified addresses, and update:
    - sites.json: data used by the website
    - geocode_cache.json: reusable address-lookup cache for future workflow runs
    """
    try:
        response = requests.get(
            SOURCE_URL,
            headers=SOURCE_HEADERS,
            timeout=30
        )
        print(f"Source HTTP status: {response.status_code}")
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"Could not retrieve source page: {error}")
        write_json(OUTPUT_FILE, [])
        return

    print(f"Downloaded {len(response.text):,} characters from source page.")

    source_data = find_embedded_flourish_data(response.text)

    if source_data is None:
        print("No parseable embedded Flourish dataset was found.")
        write_json(OUTPUT_FILE, [])
        return

    raw_sites = parse_source_rows(source_data)
    print(f"Extracted {len(raw_sites)} possible donation-site record(s).")

    map_sites = build_map_sites(raw_sites)
    write_json(OUTPUT_FILE, map_sites)

    print(f"Saved {len(map_sites)} verified, map-ready site record(s).")
    print(f"Updated cache file: {GEOCODE_CACHE_FILE.name}")

    if raw_sites and not map_sites:
        print(
            "Source rows were found, but no records passed address verification. "
            "Review the workflow logs before loosening match requirements."
        )


if __name__ == "__main__":
    auto_scrape()
