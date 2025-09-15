import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';

// This boilerplate is needed to make process.env work in a standalone ES Module script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function testGoogleSheets() {
  console.log("--- Starting Google Sheets API Debug Script ---");

  const keyB64 = process.env.GOOGLE_SA_BASE64;
  const sheetId = process.env.SHEET_ID;
  const sheetRange = process.env.SHEET_RANGE;

  // --- Verification Step 1: Check if .env.local was loaded ---
  if (!keyB64 || !sheetId || !sheetRange) {
    console.error("🔴 FATAL: One or more environment variables are missing.");
    console.error("Ensure .env.local exists and contains GOOGLE_SA_BASE64, SHEET_ID, and SHEET_RANGE.");
    return;
  }
  console.log("✅ Environment variables loaded successfully.");

  try {
    // --- Verification Step 2: Decode and parse credentials ---
    console.log("Attempting to decode and parse credentials...");
    const creds = JSON.parse(Buffer.from(keyB64, "base64").toString("utf8"));
    console.log(`✅ Credentials parsed for project: ${creds.project_id}`);
    console.log(`✅ Using client email: ${creds.client_email}`);

    // --- Verification Step 3: Authenticate with Google ---
    console.log("Authenticating with Google...");
    const auth = new google.auth.JWT(
      creds.client_email,
      null,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    );
    const sheets = google.sheets({ version: "v4", auth });
    console.log("✅ Authentication object created.");

    // --- Verification Step 4: Make the API Call ---
    console.log(`Fetching data from Sheet ID: ${sheetId}, Range: ${sheetRange}`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetRange,
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      console.log(`✅ SUCCESS! Found ${rows.length} rows.`);
      console.log("First row data:", JSON.stringify(rows[0]));
    } else {
      console.warn("🟡 WARNING: API call succeeded but returned no data.");
    }
  } catch (e) {
    console.error("🔴 FATAL: An error occurred during the API call.");
    console.error("Error Code:", e.code);
    console.error("Error Message:", e.message);
  } finally {
    console.log("--- Debug Script Finished ---");
  }
}

testGoogleSheets();