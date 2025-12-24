# Construction Status Integration - Setup Instructions

## ❌ Current Issue

The construction spreadsheet (ID: `1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH`) is returning:
```
ERROR: This operation is not supported for this document (400 - FAILED_PRECONDITION)
```

This means the Google Sheets API cannot access this spreadsheet.

---

## ✅ Solution: Share the Spreadsheet Publicly

### Step 1: Open the Construction Spreadsheet
Visit: https://docs.google.com/spreadsheets/d/1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH

### Step 2: Share Settings
1. Click the **"Share"** button (top-right corner)
2. Click **"Change to anyone with the link"**
3. Set permission to **"Viewer"**
4. Click **"Copy link"** and **"Done"**

### Step 3: Verify Access
After sharing, run this test:
```bash
cd /Users/rishikthimmaiahgari/Desktop/hover-villas-next
CONSTRUCTION_SHEET_ID=1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH GOOGLE_API_KEY=AIzaSyDDS8G9lAIpEjKrapnglfe4s6HxKV5WBh4 node test-construction-sheet.mjs
```

You should see: ✅ SUCCESS!

---

## Alternative: If Spreadsheet ID is Wrong

If the spreadsheet ID `1A_BplJEq3hmD7plRPzzTx5Ui_Jg0gitH` is incorrect:

1. Open the correct construction spreadsheet in Google Sheets
2. Look at the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`
3. Copy the ID from the URL
4. Update `.env.local`:
   ```bash
   CONSTRUCTION_SHEET_ID=YOUR_CORRECT_SPREADSHEET_ID
   ```

---

## What Happens When It Works

Once the spreadsheet is accessible, the construction status will display in villa tooltips with:
- **Completion percentage** (0-100%) based on weighted stages
- **Animated progress bar**
- **Current construction stage** (e.g., "Foundation", "Painting")
- **Color-coded status** (gray → blue → amber → green)

Example:
```
Villa No. 121
Status: Available
Construction: 65% ✅
[████████████░░░░] Progress bar
Current: Internal Plastering
```

