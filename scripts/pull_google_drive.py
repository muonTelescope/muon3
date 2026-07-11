#!/usr/bin/env python3
"""
Pull files from Google Drive for simulations and additional information.

Supports multiple accounts by using different --token-file or client secrets.

Usage examples:
  python pull_google_drive.py --folder "Muon3/Simulations" --dest ../sim/data/drive
  python pull_google_drive.py --query "name contains 'test' or name contains 'data'" --dest ../additional
  python pull_google_drive.py --list-folders   # to explore

For all accounts: run multiple times with different --token-file / --client-secret per Google account.
Or use rclone for easier multi-account setup (recommended).

Requirements:
  pip install google-auth-oauthlib google-api-python-client

Setup per account:
  1. Google Cloud Console: Enable Google Drive API.
  2. OAuth client ID (Desktop).
  3. Save client_secret_xxx.json .
  4. Run script - it will authorize.

Never commit secrets/tokens.
"""

import argparse
import os
import io
from pathlib import Path

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    print("Missing packages. Run: pip install google-auth-oauthlib google-api-python-client")
    exit(1)

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
DEFAULT_TOKEN = 'drive_token.json'
DEFAULT_SECRET = 'client_secret.json'  # or client_secret_drive.json

def get_drive_service(token_file=DEFAULT_TOKEN, secret_file=DEFAULT_SECRET):
    creds = None
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(secret_file):
                print(f"Error: {secret_file} not found for this account.")
                print("Download OAuth client secret from Google Cloud (enable Drive API).")
                exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(secret_file, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_file, 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)

def list_folders(service, parent_id='root'):
    """List folders to explore for simulations/additional info."""
    print(f"Folders under parent {parent_id}:")
    results = service.files().list(
        q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder'",
        pageSize=100, fields="files(id, name)"
    ).execute()
    for f in results.get('files', []):
        print(f"  - {f['name']} (id: {f['id']})")
    return results.get('files', [])

def download_files(service, folder_name_or_id, dest_dir: Path, query=None, limit=None):
    """Download files from a folder or matching query. For sim data and additional info."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    print(f"Pulling from Drive to {dest_dir}...")

    if folder_name_or_id and not folder_name_or_id.startswith('query:'):
        # Find folder id
        results = service.files().list(
            q=f"name = '{folder_name_or_id}' and mimeType = 'application/vnd.google-apps.folder'",
            pageSize=1, fields="files(id, name)"
        ).execute()
        folders = results.get('files', [])
        if not folders:
            print(f"Folder '{folder_name_or_id}' not found. Use --list-folders to explore.")
            return 0
        folder_id = folders[0]['id']
        q = f"'{folder_id}' in parents"
    else:
        q = query or "name contains 'simulation' or name contains 'data' or name contains 'test'"

    if query:
        q = query

    print(f"Query: {q}")

    results = service.files().list(
        q=q,
        pageSize=100,
        fields="nextPageToken, files(id, name, mimeType, size)"
    ).execute()

    items = results.get('files', [])
    downloaded = 0
    for item in items:
        if limit and downloaded >= limit:
            break
        name = item['name']
        file_id = item['id']
        dest = dest_dir / name
        if dest.exists():
            print(f"  Skip exists: {name}")
            continue
        print(f"  Downloading: {name}")
        try:
            request = service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            with open(dest, 'wb') as f:
                f.write(fh.getvalue())
            downloaded += 1
        except Exception as e:
            print(f"  Failed {name}: {e}")
    return downloaded

def main():
    parser = argparse.ArgumentParser(description="Google Drive pull for Muon3 simulations and additional information")
    parser.add_argument('--folder', help='Folder name in Drive (e.g. "Muon3/Simulations" or "Additional Information")')
    parser.add_argument('--query', help='Custom Drive query e.g. "name contains \'data\' or name contains \'test\'"')
    parser.add_argument('--dest', default='../sim/additional/drive', help='Destination dir')
    parser.add_argument('--limit', type=int, help='Max files')
    parser.add_argument('--list-folders', action='store_true', help='List folders to explore accounts/folders')
    parser.add_argument('--token-file', default=DEFAULT_TOKEN, help='Token file (for different accounts)')
    parser.add_argument('--client-secret', default=DEFAULT_SECRET, help='client_secret json (per account)')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    service = get_drive_service(args.token_file, args.client_secret)

    if args.list_folders:
        list_folders(service)
        # Also check 'root' children etc.
        return

    if not args.folder and not args.query:
        print("Specify --folder or --query. Use --list-folders first.")
        print("Examples for simulations/additional: --folder 'Muon3 Simulations' or --query \"name contains 'sim'\"")
        return

    count = download_files(service, args.folder, Path(args.dest), args.query, args.limit)
    print(f"\nDone. Downloaded {count} files.")

if __name__ == "__main__":
    main()
