import { google } from "googleapis";
import { NextResponse } from "next/server";

// This function translates the sheet data (0, 1, 2, "Premium") into clear strings.
function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === '2') return "Sold";
  if (s === '1') return "Hold";
  if (s === '0' || s === 'premium') return "Available";
  return "Available"; // Default to Available if the cell is empty or has another value
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
      rows.push({
        id: String(L[0] || "").trim(),          // Column A (e.g., V_121)
        facing: String(L[1] || "").trim(),      // Column B
        sqft: String(R[0] || "").trim(),        // Column D
        plotSize: String(R[1] || "").trim(),    // Column E
        availability: normalizeStatus(R[2])     // Column F
      });
    }

    return NextResponse.json({ rows });
  } catch (e) {
    console.error(e);
    const errorMessage = e.response?.data?.error?.message || e.message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}