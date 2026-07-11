#!/usr/bin/env python3
"""
Pull images from a Google Photos album for project documentation.

Usage:
    python pull_google_photos.py --album "Muon3 Documentation" --dest ../figures/google

    # Using external secret (recommended for multiple projects/accounts):
    python pull_google_photos.py \
        --client-secret ~/.config/google-photos/openkolibri_photos_client_secret.json \
        --list-albums

Requirements:
    pip install google-auth-oauthlib google-api-python-client requests

Setup:
    1. Create a Google Cloud project and enable "Photos Library API".
    2. Create OAuth client ID (Desktop app).
    3. Save the client_secret.json (can be anywhere, e.g. ~/.config/google-photos/).
    4. Run once — it will open a browser for authorization. Token is saved next to secret or in scripts/.

Never commit client_secret.json or token files.
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    import requests
except ImportError:
    print("Missing packages. Please run:")
    print("  pip install google-auth-oauthlib google-api-python-client requests")
    sys.exit(1)

SCOPES = ['https://www.googleapis.com/auth/photoslibrary.readonly']
TOKEN_FILE = 'token.json'
CLIENT_SECRET_FILE = 'client_secret.json'


def get_photos_service(client_secret_file=None, token_file=None):
    """Authenticate and return a Google Photos service client."""
    if client_secret_file is None:
        client_secret_file = CLIENT_SECRET_FILE
    if token_file is None:
        token_file = TOKEN_FILE

    creds = None

    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(client_secret_file):
                print(f"Error: {client_secret_file} not found.")
                print("Download your OAuth client secret from Google Cloud Console and save it here.")
                sys.exit(1)

            flow = InstalledAppFlow.from_client_secrets_file(client_secret_file, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_file, 'w') as token:
            token.write(creds.to_json())

    return build('photoslibrary', 'v1', credentials=creds, static_discovery=False)


def list_albums(service):
    """List all albums to explore the photo library."""
    results = service.albums().list(pageSize=50).execute()
    albums = results.get('albums', [])
    print("Available albums in your Google Photos library:")
    for album in albums:
        title = album.get('title', '(untitled)')
        count = album.get('mediaItemsCount', '?')
        print(f"  - {title} (id: {album['id']}, items: {count})")
    return albums

def find_albums(service, album_names):
    """Find albums by name (supports comma separated)."""
    if not album_names:
        return []
    names = [n.strip() for n in album_names.split(',')]
    results = service.albums().list(pageSize=50).execute()
    albums = results.get('albums', [])
    found = []
    for name in names:
        for album in albums:
            if album.get('title', '').lower() == name.lower():
                found.append((album['id'], album['title']))
                break
        else:
            print(f"Warning: Album '{name}' not found.")
    if not found:
        print("Available albums:")
        for album in albums:
            print(f"  - {album.get('title')}")
    return found

def parse_date(date_str):
    """Parse YYYY-MM-DD to dict for API."""
    if not date_str:
        return None
    y, m, d = map(int, date_str.split('-'))
    return {'year': y, 'month': m, 'day': d}


def matches_keywords(item, keywords):
    """Check if filename or description matches any keyword (for data/tests filtering)."""
    if not keywords:
        return True
    text = (item.get('filename', '') + ' ' + item.get('description', '')).lower()
    kws = [k.strip().lower() for k in keywords.split(',') if k.strip()]
    return any(kw in text for kw in kws)

def download_album_images(service, album_ids, dest_dir: Path, limit=None, since=None, until=None, keywords='', list_only=False):
    """Download (or list) images, with optional date and keyword filters for data/tests."""
    dest_dir.mkdir(parents=True, exist_ok=True)

    action = "Listing" if list_only else "Downloading"
    print(f"{action} images to {dest_dir}... (filters: since={since}, until={until}, keywords={keywords})")

    next_page_token = None
    processed = 0
    date_filter = None
    if since or until:
        date_filter = {}
        if since:
            date_filter['startDate'] = parse_date(since)
        if until:
            date_filter['endDate'] = parse_date(until)

    for album_id, album_title in album_ids:
        print(f"  Processing album: {album_title}")
        next_page_token = None
        while True:
            body = {
                'albumId': album_id,
                'pageSize': 50,
            }
            if date_filter:
                body['filters'] = {'dateFilter': {'ranges': [date_filter]}}
            if next_page_token:
                body['pageToken'] = next_page_token

            try:
                results = service.mediaItems().search(body=body).execute()
            except Exception as e:
                print(f"    Search error: {e}")
                break
            items = results.get('mediaItems', [])

            for item in items:
                if limit and processed >= limit:
                    return processed

                filename = item.get('filename', 'unknown')
                if not matches_keywords(item, keywords):
                    continue

                if list_only:
                    print(f"    MATCH: {filename} (id: {item.get('id')})")
                    processed += 1
                    continue

                base_url = item['baseUrl']
                download_url = f"{base_url}=w2048" if 'image' in item.get('mimeType', '') else base_url

                dest_path = dest_dir / filename

                if dest_path.exists():
                    print(f"    Skipping (exists): {filename}")
                    processed += 1
                    continue

                try:
                    print(f"    {action}: {filename}")
                    resp = requests.get(download_url, stream=True, timeout=60)
                    resp.raise_for_status()

                    with open(dest_path, 'wb') as f:
                        for chunk in resp.iter_content(chunk_size=8192):
                            f.write(chunk)

                    processed += 1
                except Exception as e:
                    print(f"    Failed {filename}: {e}")

            next_page_token = results.get('nextPageToken')
            if not next_page_token:
                break

    return processed


def main():
    parser = argparse.ArgumentParser(description="Download images from Google Photos album for docs/data/tests")
    parser.add_argument('--album', default="Muon3 Documentation",
                        help="Name of the Google Photos album (or comma-separated for multiple)")
    parser.add_argument('--dest', default="../figures/google",
                        help="Destination directory")
    parser.add_argument('--limit', type=int, default=None,
                        help="Maximum number of images to download (for testing)")
    parser.add_argument('--since', help='Filter start date YYYY-MM-DD (for data/tests from certain time)')
    parser.add_argument('--until', help='Filter end date YYYY-MM-DD')
    parser.add_argument('--keywords', default='',
                        help='Comma-separated keywords to match in filename (e.g. data,test,panel,oscilloscope,hit,simulation)')
    parser.add_argument('--list-albums', action='store_true', help='List all available albums and exit (to explore the photo library)')
    parser.add_argument('--list-only', action='store_true', help='List matching items without downloading (look through for data and tests)')
    parser.add_argument('--client-secret', default=None,
                        help='Path to client_secret.json (can be outside the repo, e.g. ~/.config/google-photos/...)')
    parser.add_argument('--token-file', default=None,
                        help='Path to store/read token.json (defaults to client_secret dir or scripts/)')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    client_secret = args.client_secret or CLIENT_SECRET_FILE
    token_file = args.token_file or TOKEN_FILE

    # If client_secret is an absolute path, use its directory for default token (keeps token next to secret)
    if args.client_secret and os.path.isabs(args.client_secret):
        if args.token_file is None:
            token_dir = Path(args.client_secret).parent
            token_file = str(token_dir / 'token.json')

    print("Connecting to Google Photos...")

    try:
        service = get_photos_service(client_secret, token_file)
    except Exception as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)

    if args.list_albums:
        list_albums(service)
        sys.exit(0)

    album_list = find_albums(service, args.album)
    if not album_list:
        sys.exit(1)

    print(f"Found {len(album_list)} album(s)")

    dest = Path(args.dest)
    count = download_album_images(service, album_list, dest, args.limit, args.since, args.until, args.keywords, args.list_only)

    mode = "Listed" if args.list_only else "Processed"
    print(f"\nDone. {mode} {count} images in {dest}")
    print("\nNext steps:")
    print("  • Review images and copy the ones you need into figures/ (for paper)")
    print("  • Or Muon3Vision/Resources/ for the Vision Pro app")
    print("  • Or run from project root: ./build_paper.sh --pull-images")
    print("  • To explore data/tests: --list-albums or --list-only --keywords data,test --since 2025-01-01")


if __name__ == "__main__":
    main()
