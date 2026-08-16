import ast
import html
import json
import re
from pathlib import Path

import requests


URL = "https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/"
OUTPUT_FILE = Path(__file__).with_name("sites.json")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ColombiaReliefMapBot/1.0; "
        "+https://github.com/your-github-username/your-repository)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

BOROUGH_COORDINATES = {
    "Queens": {"lat": 40.7282, "lng": -73.7949},
    "Brooklyn": {"lat": 40.6782, "lng": -73.9442},
    "Bronx": {"lat": 40.8448, "lng": -73.8648},
    "Manhattan": {"lat": 40.7831, "lng": -73.9712},
    "Staten Island": {"lat": 40.5795, "lng": -74.1502}
}


def write_sites(sites):
    """Write a valid JSON array even when the scraper finds no sites."""
    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(sites, file, ensure_ascii=False, indent=2)
        file.write("\n")


def clean_text(value):
    """Normalize scraped HTML/text into readable one-line strings."""
    if value is None:
        return ""

    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_zip(address_text):
    """Extract a five-digit NYC ZIP code, or leave it blank."""
    match = re.search(r"\b(1[0-1]\d{3})\b", address_text)
    return match.group(1) if match else ""


def normalize_borough(value):
    """Standardize borough labels before assigning fallback coordinates."""
    text = clean_text(value).lower()

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


def extract_balanced_object(text, start_index):
    """
    Starting at an opening { or [, return one complete balanced JSON-like block.
    This is safer than a non-greedy regex when nested objects are present.
    """
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
    """
    Parse strict JSON first. If the page embeds a Python/JavaScript-like
    literal, make a limited fallback attempt with ast.literal_eval.
    """
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
    """
    Search common variable names used for embedded Flourish datasets.
    Returns parsed data or None.
    """
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
            print("Found a Flourish variable name but could not isolate its data block.")
            continue

        parsed_data = parse_json_like(raw_block)

        if parsed_data is not None:
            print("Found and parsed an embedded Flourish data block.")
            return parsed_data

    return None


def get_rows(data):
    """Support a few likely tabular structures without assuming one exact schema."""
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


def get_value(row, keys, fallback_index=None):
    """Read a field from either a dictionary row or a list of columns."""
    if isinstance(row, dict):
        normalized_row = {
            re.sub(r"[^a-z0-9]", "", str(key).lower()): value
            for key, value in row.items()
        }

        for key in keys:
            normalized_key = re.sub(r"[^a-z0-9]", "", key.lower())

            if normalized_key in normalized_row:
                return clean_text(normalized_row[normalized_key])

    if isinstance(row, (list, tuple)):
        if fallback_index is not None and len(row) > fallback_index:
            return clean_text(row[fallback_index])

    return ""


def row_to_columns(row):
    """
    Convert a row into a practical list of values.
    Handles Flourish-style {'columns': [...]} rows and raw list rows.
    """
    if isinstance(row, dict) and isinstance(row.get("columns"), list):
        return [clean_text(item) for item in row["columns"]]

    if isinstance(row, (list, tuple)):
        return [clean_text(item) for item in row]

    return []


def parse_sites(data):
    """Convert source rows into map-ready, deduplicated site records."""
    parsed_sites = []
    seen = set()

    for row in get_rows(data):
        columns = row_to_columns(row)

        if columns:
            name = columns[0] if len(columns) > 0 else ""
            address = columns[1] if len(columns) > 1 else ""
            borough = columns[2] if len(columns) > 2 else ""
            phone = columns[3] if len(columns) > 3 else ""
        else:
            name = get_value(
                row,
                ["name", "organization", "organization name", "site name"],
                0
            )
            address = get_value(
                row,
                ["address", "street address", "location"],
                1
            )
            borough = get_value(
                row,
                ["borough", "area", "neighborhood"],
                2
            )
            phone = get_value(
                row,
                ["phone", "phone number", "telephone", "contact"],
                3
            )

        name = clean_text(name)
        address = clean_text(address)
        borough = normalize_borough(borough)
        phone = clean_text(phone) or "N/A"

        if not name or not address:
            continue

        dedupe_key = (
            re.sub(r"\s+", " ", name.lower()),
            re.sub(r"\s+", " ", address.lower())
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        coordinates = BOROUGH_COORDINATES.get(
            borough,
            {"lat": 40.7128, "lng": -74.0060}
        )

        parsed_sites.append({
            "name": name,
            "address": address,
            "borough": borough,
            "zip": clean_zip(address),
            "phone": phone,
            "lat": coordinates["lat"],
            "lng": coordinates["lng"],
            "source_url": URL
        })

    return parsed_sites


def auto_scrape():
    try:
        response = requests.get(
            URL,
            headers=HEADERS,
            timeout=30
        )
        print(f"Source HTTP status: {response.status_code}")
        response.raise_for_status()
    except requests.RequestException as error:
        print(f"Could not retrieve source page: {error}")
        write_sites([])
        return

    print(f"Downloaded {len(response.text):,} characters from source page.")

    data = find_embedded_flourish_data(response.text)

    if data is None:
        print("No parseable embedded Flourish dataset was found.")
        write_sites([])
        return

    sites = parse_sites(data)
    write_sites(sites)

    print(f"Refreshed dashboard: saved {len(sites)} verified site record(s).")

    if not sites:
        print(
            "No usable rows were extracted. Inspect the workflow logs and "
            "the source page structure before changing extraction rules."
        )


if __name__ == "__main__":
    auto_scrape()
