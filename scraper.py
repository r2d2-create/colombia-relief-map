import os
import re
import json
import requests

URL = "https://documentedny.com/2026/08/11/colombia-earthquake-relief-nyc/"

# Fallback coordinates for boroughs if exact address lookup is offline
BOROUGH_COORDINATES = {
    "Queens": {"lat": 40.7282, "lng": -73.7949},
    "Brooklyn": {"lat": 40.6782, "lng": -73.9442},
    "Bronx": {"lat": 40.8448, "lng": -73.8648},
    "Manhattan": {"lat": 40.7831, "lng": -73.9712},
    "Staten Island": {"lat": 40.5795, "lng": -74.1502}
}

def clean_zip(address_text):
    # Regex formula to extract a 5-digit NYC zip code from text strings
    match = re.search(r'\b(1[0-1]\d{3})\b', address_text)
    return match.group(1) if match else "all"

def auto_scrape():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    response = requests.get(URL, headers=headers)
    if response.status_code != 200:
        return

    # Look for the internal '_Flourish_data = { ... }' text variable block inside the code layout
    match = re.search(r'_Flourish_data\s*=\s*(\{.*?\}\s*),', response.text, re.DOTALL)
    if not match:
        print("Could not locate raw Flourish data table container.")
        return

    raw_json_text = match.group(1)
    
    # Standardize string formatting so Python's json reader accepts it cleanly
    raw_json_text = re.sub(r'(\s*[\w_]+)\s*:', r'"\1":', raw_json_text)
    data_clean = json.loads(raw_json_text)
    
    parsed_sites = []
    
    # Step through every row listed inside the news agency widget table layout
    for row in data_clean.get("rows", []):
        columns = row.get("columns", [])
        if len(columns) < 3:
            continue
            
        name = columns[0].strip()
        address = columns[1].strip()
        borough = columns[2].strip()
        phone = columns[3].strip() if len(columns) > 3 else "N/A"
        zip_code = clean_zip(address)
        
        # Pull approximate coordinates based on target borough location
        coords = BOROUGH_COORDINATES.get(borough, {"lat": 40.7128, "lng": -74.0060})
        
        parsed_sites.append({
            "name": name,
            "address": address,
            "borough": borough,
            "zip": zip_code,
            "phone": phone,
            "lat": coords["lat"],
            "lng": coords["lng"]
        })

    # Save data to sites.json in the repository directory
    with open("sites.json", "w", encoding="utf-8") as f:
        json.dump(parsed_sites, f, indent=4, ensure_ascii=False)
    print(f"Refreshed tracking dashboard. Saved {len(parsed_sites)} centers.")

if __name__ == "__main__":
    auto_scrape()
