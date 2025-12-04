# Test Data Cloud Storage Setup

Store and sync test patient data across development environments using Backblaze B2.

**Cost:** ~$0.005/GB/month (100GB = $0.50/month)

## Quick Start

```bash
# 1. Install B2 CLI
brew install b2-tools

# 2. Download test data (after setup)
./scripts/sync-test-data.sh download

# 3. Upload your local test data
./scripts/sync-test-data.sh upload
```

## Initial Setup (5 minutes)

### Step 1: Create Backblaze Account

1. Go to https://www.backblaze.com/b2/sign-up.html
2. Create a free account (10GB free)

### Step 2: Create a Bucket

1. Log in to Backblaze: https://secure.backblaze.com/
2. Go to **B2 Cloud Storage** → **Buckets**
3. Click **Create a Bucket**
4. Name it: `superbeam-test-data`
5. Set to **Private**
6. Click **Create**

### Step 3: Create Application Key

1. Go to **App Keys**: https://secure.backblaze.com/app_keys.htm
2. Click **Add a New Application Key**
3. Name: `superbeam-dev`
4. Allow access to: `superbeam-test-data` bucket
5. Click **Create New Key**
6. **Save both keys** (shown only once!):
   - `keyID` → Your `B2_APPLICATION_KEY_ID`
   - `applicationKey` → Your `B2_APPLICATION_KEY`

### Step 4: Configure Locally

Add to your `.env` file:

```bash
# Backblaze B2 Test Data Storage
B2_APPLICATION_KEY_ID=your_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET=superbeam-test-data
```

### Step 5: Test

```bash
./scripts/sync-test-data.sh setup
```

## Usage

### Download Test Data (new dev environment)

```bash
./scripts/sync-test-data.sh download
```

Downloads to `./test-data/` by default.

### Upload Test Data (share with team)

```bash
./scripts/sync-test-data.sh upload
```

Uploads from `./test-data/` to B2.

### List Remote Files

```bash
./scripts/sync-test-data.sh list
```

### Custom Data Directory

```bash
LOCAL_DATA_DIR=./my-data ./scripts/sync-test-data.sh download
```

## Data Organization

Recommended structure in B2:

```
superbeam-test-data/
├── test-patients/
│   ├── PATIENT_001/
│   │   ├── CT/
│   │   ├── MRI/
│   │   └── RTSTRUCT/
│   ├── PATIENT_002/
│   └── ...
└── ml-weights/          # Optional: store model weights
    ├── segvol/
    └── nninteractive/
```

## Sharing with Team

1. Create a **read-only** application key for team members
2. Share the key ID and key securely
3. Team members add to their local `.env` and run `download`

## Costs

| Storage | Monthly Cost |
|---------|--------------|
| 10 GB   | Free         |
| 100 GB  | ~$0.50       |
| 500 GB  | ~$2.50       |
| 1 TB    | ~$5.00       |

Download bandwidth: First 1GB/day free, then $0.01/GB

## Troubleshooting

### "b2 command not found"
```bash
brew install b2-tools
# or
pip install b2
```

### "Unauthorized"
- Check your key ID and application key are correct
- Ensure the key has access to the bucket
- Try re-authorizing: `b2 authorize-account`

### Slow uploads
B2 uploads are single-threaded by default. For large datasets:
```bash
# Use parallel uploads (requires GNU parallel)
find ./test-data -type f | parallel -j4 b2 upload-file superbeam-test-data {} {}
```

