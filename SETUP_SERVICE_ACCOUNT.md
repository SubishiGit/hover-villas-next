# 🔐 Service Account Setup Required

## Current Status
Your construction spreadsheet is **shared with a service account**, but the API doesn't have the service account credentials yet.

**Error**: `This operation is not supported for this document (400)`

---

## ✅ Solution: Add Service Account Credentials

You need to add the **service account JSON credentials** to your `.env.local` file.

### Step 1: Locate Your Service Account JSON File

The service account JSON file looks like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

**Where to find it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Find the service account you shared the sheets with
5. Click **Actions** (⋮) > **Manage Keys**
6. Click **Add Key** > **Create New Key** > **JSON**
7. Download the JSON file

### Step 2: Convert to Base64

Run this command with your JSON file:

```bash
cd /Users/rishikthimmaiahgari/Desktop/hover-villas-next

# If your service account JSON is in Downloads:
base64 -i ~/Downloads/your-service-account-file.json | tr -d '\n' > sa-base64.txt

# Then add it to .env.local:
echo "" >> .env.local
echo "# Service Account Credentials (base64)" >> .env.local
echo "GOOGLE_SA_BASE64=$(cat sa-base64.txt)" >> .env.local

# Clean up temp file
rm sa-base64.txt
```

### Step 3: Verify

After adding the credentials, restart your dev server and test:

```bash
# The server should auto-reload, or restart it
curl http://localhost:3000/api/construction | jq
```

You should see real construction data instead of an error!

---

## 🔄 Alternative: Make Spreadsheet Public

If you don't want to use service account authentication, you can make the construction spreadsheet **publicly accessible** (like your villa spreadsheet appears to be):

1. Open: https://docs.google.com/spreadsheets/d/1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH
2. Click **Share** (top-right)
3. Click **Change to anyone with the link**
4. Set permission to **Viewer**
5. Click **Done**

Then the API will work with your existing `GOOGLE_API_KEY`.

---

## 📧 Which Service Account Email?

You mentioned you shared the sheet with a service account email. The email should look like:

`xxx@xxx.iam.gserviceaccount.com`

Make sure both spreadsheets are shared with the **same** service account email:
- ✅ Villa Sheet: `1WCcVEjw3a9gAheuS4-0K8-QEksbN-SXBaX7EvRbPOIo`
- ✅ Construction Sheet: `1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH`

---

## 🧪 Current System Behavior

**Right now:**
- Construction API tries to use service account (not found)
- Falls back to API key
- Fails because sheet is private
- System uses **mock data** as fallback

**After adding credentials:**
- Construction API uses service account ✅
- Successfully reads from private sheet ✅
- Real construction progress displays in tooltips ✅

---

## Need Help?

Run this to check your current environment:

```bash
cd /Users/rishikthimmaiahgari/Desktop/hover-villas-next
cat .env.local | grep -E "GOOGLE|CONSTRUCTION"
```

You should see:
```bash
GOOGLE_API_KEY=...          # For public sheets
GOOGLE_SA_BASE64=...        # For private sheets (MISSING - need to add)
CONSTRUCTION_SHEET_ID=...   # ✅ Already set
CONSTRUCTION_RANGE=...      # ✅ Already set to 'Progress!B2:R287'
```

