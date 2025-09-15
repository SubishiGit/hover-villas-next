import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function testApiKey() {
  console.log("--- Starting API Key Debug Script ---");

  const apiKey = process.env.GOOGLE_API_KEY;
  const sheetId = process.env.SHEET_ID;
  const sheetRange = process.env.SHEET_RANGE;

  if (!apiKey || !sheetId || !sheetRange) {
    console.error("🔴 FATAL: Missing GOOGLE_API_KEY, SHEET_ID, or SHEET_RANGE in .env.local");
    return;
  }
  console.log("✅ Environment variables loaded.");

  try {
    const sheets = google.sheets({ version: "v4" });
    console.log(`Fetching data from public Sheet ID: ${sheetId}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetRange,
      key: apiKey, // Using API Key for auth
    });

    const rows = response.data.values;
    console.log(`✅ SUCCESS! Found ${rows.length} rows.`);
    console.log("First row data:", JSON.stringify(rows[0]));

  } catch (e) {
    console.error("🔴 FATAL: API Key test failed.");
    console.error("Error Code:", e.code);
    console.error("Error Message:", e.errors[0]?.message || e.message); // Google often nests error messages
  } finally {
    console.log("--- API Key Debug Script Finished ---");
  }
}

testApiKey();