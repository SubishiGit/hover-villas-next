import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const apiKey = process.env.GOOGLE_API_KEY;
const constructionSheetId = process.env.CONSTRUCTION_SHEET_ID;
const constructionRange = process.env.CONSTRUCTION_RANGE || "Sheet1!B2:R287";

console.log("Testing Construction Sheet Access...");
console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "MISSING");
console.log("Sheet ID:", constructionSheetId || "MISSING");
console.log("Range:", constructionRange);
console.log("\n---\n");

const sheets = google.sheets({ version: "v4" });

try {
  // First, try to get spreadsheet metadata
  console.log("Step 1: Getting spreadsheet metadata...");
  const metadataResponse = await sheets.spreadsheets.get({
    spreadsheetId: constructionSheetId,
    key: apiKey,
  });
  
  console.log("✓ Spreadsheet found!");
  console.log("Title:", metadataResponse.data.properties.title);
  console.log("\nAvailable sheets:");
  metadataResponse.data.sheets.forEach(sheet => {
    console.log(`  - ${sheet.properties.title} (ID: ${sheet.properties.sheetId})`);
  });
  
  // Get the first sheet name
  const firstSheetName = metadataResponse.data.sheets[0].properties.title;
  console.log(`\n---\n`);
  console.log(`Step 2: Attempting to read from first sheet: "${firstSheetName}"`);
  
  // Try reading with the first sheet name
  const testRange = `${firstSheetName}!B2:R287`;
  console.log(`Reading range: ${testRange}`);
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: constructionSheetId,
    range: testRange,
    key: apiKey,
  });

  const rows = response.data.values || [];
  console.log(`\n✓ Successfully read ${rows.length} rows!`);
  
  if (rows.length > 0) {
    console.log("\nFirst row (headers):");
    console.log(rows[0]);
    
    if (rows.length > 1) {
      console.log("\nSecond row (first data row):");
      console.log(rows[1]);
      
      console.log("\nVilla number from second row:", rows[1][0]);
      console.log("Number of construction stages:", rows[1].slice(1).length);
    }
  }
  
  console.log("\n---\n");
  console.log("✅ SUCCESS! Update your .env.local with:");
  console.log(`CONSTRUCTION_RANGE='${firstSheetName}!B2:R287'`);
  
} catch (error) {
  console.error("\n❌ ERROR:", error.message);
  if (error.response) {
    console.error("Response status:", error.response.status);
    console.error("Response data:", JSON.stringify(error.response.data, null, 2));
  }
  console.log("\nPossible issues:");
  console.log("1. Spreadsheet is not shared publicly or with the API key");
  console.log("2. The spreadsheet ID is incorrect");
  console.log("3. The Google Sheets API is not enabled for this API key");
}

