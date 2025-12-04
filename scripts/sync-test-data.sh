#!/bin/bash
# =============================================================================
# SUPERBEAM Test Data Sync Script
# Syncs test patient data with Backblaze B2 cloud storage
# =============================================================================

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -E '^B2_' .env | xargs)
fi

# Configuration
B2_BUCKET="${B2_BUCKET:-superbeam-test-data}"
LOCAL_DATA_DIR="${LOCAL_DATA_DIR:-./storage/patients}"
REMOTE_PATH="${B2_REMOTE_PATH:-patients}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  download    Download test data from B2 to local"
    echo "  upload      Upload local test data to B2"
    echo "  list        List files in B2 bucket"
    echo "  setup       Initial setup and authorization"
    echo ""
    echo "Environment variables (set in .env):"
    echo "  B2_APPLICATION_KEY_ID  - Your B2 application key ID"
    echo "  B2_APPLICATION_KEY     - Your B2 application key"
    echo "  B2_BUCKET              - Bucket name (default: superbeam-test-data)"
    echo ""
}

check_b2_installed() {
    if ! command -v b2 &> /dev/null; then
        echo -e "${RED}Error: b2 CLI not installed${NC}"
        echo ""
        echo "Install with:"
        echo "  brew install b2-tools    # macOS"
        echo "  pip install b2           # or via pip"
        exit 1
    fi
}

check_credentials() {
    if [ -z "$B2_APPLICATION_KEY_ID" ] || [ -z "$B2_APPLICATION_KEY" ]; then
        echo -e "${RED}Error: B2 credentials not set${NC}"
        echo ""
        echo "Add to your .env file:"
        echo "  B2_APPLICATION_KEY_ID=your_key_id"
        echo "  B2_APPLICATION_KEY=your_key"
        echo ""
        echo "Get credentials from: https://secure.backblaze.com/app_keys.htm"
        exit 1
    fi
}

authorize() {
    echo -e "${YELLOW}Authorizing with Backblaze B2...${NC}"
    b2 authorize-account "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"
    echo -e "${GREEN}✓ Authorized${NC}"
}

do_download() {
    check_b2_installed
    check_credentials
    authorize
    
    echo -e "${YELLOW}Downloading test data from B2...${NC}"
    echo "  From: b2://$B2_BUCKET/$REMOTE_PATH"
    echo "  To:   $LOCAL_DATA_DIR"
    echo ""
    
    mkdir -p "$LOCAL_DATA_DIR"
    b2 sync "b2://$B2_BUCKET/$REMOTE_PATH" "$LOCAL_DATA_DIR" --skip-newer
    
    echo ""
    echo -e "${GREEN}✓ Download complete${NC}"
}

do_upload() {
    check_b2_installed
    check_credentials
    authorize
    
    if [ ! -d "$LOCAL_DATA_DIR" ]; then
        echo -e "${RED}Error: Local data directory not found: $LOCAL_DATA_DIR${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Uploading test data to B2...${NC}"
    echo "  From: $LOCAL_DATA_DIR"
    echo "  To:   b2://$B2_BUCKET/$REMOTE_PATH"
    echo ""
    
    b2 sync "$LOCAL_DATA_DIR" "b2://$B2_BUCKET/$REMOTE_PATH" --skip-newer
    
    echo ""
    echo -e "${GREEN}✓ Upload complete${NC}"
}

do_list() {
    check_b2_installed
    check_credentials
    authorize
    
    echo -e "${YELLOW}Files in b2://$B2_BUCKET/$REMOTE_PATH:${NC}"
    echo ""
    b2 ls "$B2_BUCKET" "$REMOTE_PATH" --recursive --long
}

do_setup() {
    check_b2_installed
    
    echo -e "${YELLOW}=== Backblaze B2 Setup ===${NC}"
    echo ""
    echo "1. Create a Backblaze B2 account: https://www.backblaze.com/b2/sign-up.html"
    echo "2. Create a bucket named: $B2_BUCKET"
    echo "3. Create an application key: https://secure.backblaze.com/app_keys.htm"
    echo "4. Add credentials to your .env file:"
    echo ""
    echo "   B2_APPLICATION_KEY_ID=your_key_id_here"
    echo "   B2_APPLICATION_KEY=your_application_key_here"
    echo "   B2_BUCKET=$B2_BUCKET"
    echo ""
    
    if [ -n "$B2_APPLICATION_KEY_ID" ] && [ -n "$B2_APPLICATION_KEY" ]; then
        echo -e "${GREEN}Credentials found! Testing authorization...${NC}"
        authorize
        echo ""
        echo -e "${GREEN}✓ Setup complete! You can now use 'upload' and 'download' commands.${NC}"
    else
        echo -e "${YELLOW}After adding credentials, run: $0 setup${NC}"
    fi
}

# Main
case "${1:-}" in
    download)
        do_download
        ;;
    upload)
        do_upload
        ;;
    list)
        do_list
        ;;
    setup)
        do_setup
        ;;
    *)
        print_usage
        exit 1
        ;;
esac

