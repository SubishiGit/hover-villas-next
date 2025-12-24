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

    // Fetch construction data from Sheet3 of the same spreadsheet
    let constructionData = {};
    try {
      const constructionSheetId = process.env.CONSTRUCTION_SHEET_ID || sheetId;
      const constructionRange = process.env.CONSTRUCTION_RANGE || "Sheet3!B2:R287";

      const constructionResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: constructionSheetId,
        range: constructionRange,
        key: apiKey,
      });

      const constructionRows = constructionResponse.data.values || [];
      
      if (constructionRows.length > 1) {
        const stageWeights = [5, 10, 5, 6, 5, 4, 6, 6, 5, 8, 7, 6, 6, 10, 7, 4];
        const stageNames = ["Ground Levelling", "Foundation", "Plinth Beams", "First Slab", 
                           "Second Slab", "Third Slab", "GF Brick Work", "FF Brick Work", 
                           "TF Brick Work", "Plumbing & Electrical", "Internal Plastering", 
                           "External Plastering", "Elevations", "Flooring", "Painting", "Completion"];
        
        // Skip first row (headers), process from index 1
        for (let i = 1; i < constructionRows.length; i++) {
          const row = constructionRows[i] || [];
          const villaNumber = String(row[0] || "").trim();
          
          if (!villaNumber) continue;
          
          const stageStatuses = row.slice(1).map(val => {
            const num = parseInt(val);
            return [0, 1, 2].includes(num) ? num : 0;
          });
          
          let totalProgress = 0;
          let displayStage = null;
          let stageStatus = "not_started"; // "not_started", "in_progress", "completed"
          let lastCompletedStage = null;
          
          stageStatuses.forEach((status, idx) => {
            const weight = stageWeights[idx] || 6.25;
            const stageName = stageNames[idx] || `Stage ${idx + 1}`;
            
            if (status === 2) {
              // Stage completed
              totalProgress += weight;
              lastCompletedStage = stageName;
            } else if (status === 1) {
              // Stage in progress
              totalProgress += weight * 0.5;
              if (!displayStage) {
                displayStage = stageName;
                stageStatus = "in_progress";
              }
            }
          });
          
          // If no stage is in progress, show the last completed stage
          if (stageStatus !== "in_progress" && lastCompletedStage) {
            displayStage = lastCompletedStage;
            stageStatus = totalProgress >= 100 ? "completed" : "completed";
          }
          
          // If nothing started at all
          if (!displayStage && totalProgress === 0) {
            displayStage = null;
            stageStatus = "not_started";
          }
          
          constructionData[villaNumber] = {
            completionPercentage: Math.round(totalProgress),
            currentStage: displayStage,
            stageStatus: stageStatus, // "not_started", "in_progress", "completed"
            currentStageIndex: displayStage ? stageNames.indexOf(displayStage) : -1
          };
        }
        console.log(`✓ Loaded construction data for ${Object.keys(constructionData).length} villas`);
      }
    } catch (err) {
      console.warn("Could not fetch construction data:", err.message);
    }

    const rowsL = left.slice(1);
    const rowsR = right.slice(1);

    const len = Math.max(rowsL.length, rowsR.length);
    const rows = [];
    for (let i = 0; i < len; i++) {
      const L = rowsL[i] || [];
      const R = rowsR[i] || [];
      if (!L[0]) continue;
      
      const villaId = String(L[0] || "").trim();          // Column A (e.g., V_121)
      const plotSizeValue = String(R[1] || "").trim();    // Column E (SqYds)
      const availability = normalizeAvailability(R[2]);   // Column F (status)
      const type = determineType(plotSizeValue);          // Based on plot size
      
      // Extract villa number from ID (V_121 -> 121)
      const villaNumberMatch = villaId.match(/\d+/);
      const villaNumber = villaNumberMatch ? villaNumberMatch[0] : null;
      
      // Get construction progress for this villa
      const construction = villaNumber && constructionData[villaNumber] 
        ? constructionData[villaNumber] 
        : null;
      
      rows.push({
        id: villaId,
        facing: String(L[1] || "").trim(),      // Column B
        sqft: String(R[0] || "").trim(),        // Column D
        plotSize: plotSizeValue,                // Column E
        availability: availability,
        type: type,
        construction: construction              // New field with progress data
      });
    }

    return NextResponse.json({ rows });
  } catch (e) {
    console.error(e);
    const errorMessage = e.response?.data?.error?.message || e.message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}