import { google } from "googleapis";
import { NextResponse } from "next/server";

// This function determines availability based on status values
function normalizeAvailability(status) {
  const s = String(status || "").trim().toLowerCase();
  
  if (s === '2') return "Sold";
  if (s === '1') return "Blocked";
  if (s === '0' || s === 'premium') return "Available";
  
  // Default case
  return "Available";
}

// This function determines villa type based on plot size (SqYds)
function determineType(plotSize) {
  const size = parseFloat(String(plotSize || "0").trim());
  return size > 500 ? "Premium" : "Standard";
}

export async function GET(req) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const sheetId = process.env.SHEET_ID;
    const sheetRangeRaw = process.env.SHEET_RANGE;

    if (!apiKey || !sheetId) {
      return NextResponse.json({ error: "Missing GOOGLE_API_KEY or SHEET_ID" }, { status: 500 });
    }

    const sheets = google.sheets({ version: "v4" });

    const ranges = sheetRangeRaw.split(",").map(s => s.trim()).filter(Boolean);
    
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges: ranges,
      key: apiKey,
    });

    const vals = batch.data.valueRanges || [];
    const left = vals[0]?.values || [];
    const right = vals[1]?.values || [];

    const rowsL = left.slice(1);
    const rowsR = right.slice(1);

    const len = Math.max(rowsL.length, rowsR.length);
    const rows = [];
    for (let i = 0; i < len; i++) {
      const L = rowsL[i] || [];
      const R = rowsR[i] || [];
      if (!L[0]) continue;
      
      const plotSizeValue = String(R[1] || "").trim();    // Column E (SqYds)
      const availability = normalizeAvailability(R[2]);   // Column F (status)
      const type = determineType(plotSizeValue);          // Based on plot size
      
      rows.push({
        id: String(L[0] || "").trim(),          // Column A (e.g., V_121)
        facing: String(L[1] || "").trim(),      // Column B
        sqft: String(R[0] || "").trim(),        // Column D
        plotSize: plotSizeValue,                // Column E
        availability: availability,
        type: type
      });
    }

    return NextResponse.json({ rows });
  } catch (e) {
    console.error(e);
    const errorMessage = e.response?.data?.error?.message || e.message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}