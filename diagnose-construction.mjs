// Comprehensive diagnostic script to trace construction data flow

import fs from 'fs/promises';
import path from 'path';

console.log("🔍 Construction Data Flow Diagnostic\n");
console.log("=" .repeat(60));

// Step 1: Check API response
console.log("\n📡 Step 1: Checking /api/plots response...");
try {
  const apiResponse = await fetch('http://localhost:3000/api/plots');
  const apiData = await apiResponse.json();
  
  const firstRow = apiData.rows[0];
  console.log("✓ API returned", apiData.rows.length, "rows");
  console.log("\nFirst row from API:");
  console.log(JSON.stringify(firstRow, null, 2));
  
  const hasConstruction = firstRow.construction !== null && firstRow.construction !== undefined;
  console.log("\n✓ Construction field present?", hasConstruction ? "YES ✅" : "NO ❌");
  
  if (hasConstruction) {
    console.log("  - Completion:", firstRow.construction.completionPercentage + "%");
    console.log("  - Stage:", firstRow.construction.currentStage);
  }
} catch (err) {
  console.error("❌ Failed to fetch API:", err.message);
}

// Step 2: Check plots.json structure
console.log("\n" + "=".repeat(60));
console.log("\n📄 Step 2: Checking plots.json structure...");
try {
  const plotsPath = path.join(process.cwd(), 'public', 'plots.json');
  const plotsContent = await fs.readFile(plotsPath, 'utf8');
  const plotsData = JSON.parse(plotsContent);
  
  console.log("✓ plots.json loaded");
  console.log("  - Total plots:", plotsData.plots.length);
  
  // Find villa plots (not canal/clubhouse)
  const villaPlots = plotsData.plots.filter(p => 
    !/CANAL|LANDSCAPE|CLUBHOUSE/i.test(p.id)
  ).slice(0, 5);
  
  console.log("\nFirst 5 villa plot IDs from plots.json:");
  villaPlots.forEach(p => console.log("  -", p.id));
  
  // Show how extractVillaKey would process these
  console.log("\nExtracted keys (using extractVillaKey logic):");
  villaPlots.forEach(p => {
    const match = String(p.id).toUpperCase().match(/[0-9]+[A-Z]?/);
    const key = match ? match[0] : null;
    console.log(`  - "${p.id}" → "${key}"`);
  });
  
} catch (err) {
  console.error("❌ Failed to read plots.json:", err.message);
}

// Step 3: Simulate villaDataMap creation
console.log("\n" + "=".repeat(60));
console.log("\n🗺️  Step 3: Simulating villaDataMap creation...");
try {
  const apiResponse = await fetch('http://localhost:3000/api/plots');
  const apiData = await apiResponse.json();
  
  const villaDataMap = new Map();
  for (const row of apiData.rows) {
    const match = String(row.id).toUpperCase().match(/[0-9]+[A-Z]?/);
    const key = match ? match[0] : null;
    if (key) {
      villaDataMap.set(key, row);
    }
  }
  
  console.log("✓ villaDataMap created with", villaDataMap.size, "entries");
  
  // Test lookups
  const testKeys = ['1', '2', '3', '12A', '121'];
  console.log("\nTest lookups in villaDataMap:");
  testKeys.forEach(key => {
    const data = villaDataMap.get(key);
    if (data) {
      const hasConstruction = data.construction !== null && data.construction !== undefined;
      console.log(`  - Key "${key}": FOUND ✅ | Construction: ${hasConstruction ? 'YES ✅' : 'NO ❌'}`);
      if (hasConstruction) {
        console.log(`    → ${data.construction.completionPercentage}% - ${data.construction.currentStage}`);
      }
    } else {
      console.log(`  - Key "${key}": NOT FOUND ❌`);
    }
  });
  
} catch (err) {
  console.error("❌ Failed:", err.message);
}

// Step 4: Check Tooltip component
console.log("\n" + "=".repeat(60));
console.log("\n🎨 Step 4: Checking Tooltip component...");
try {
  const tooltipPath = path.join(process.cwd(), 'components', 'Tooltip.jsx');
  const tooltipContent = await fs.readFile(tooltipPath, 'utf8');
  
  const hasConstructionCheck = tooltipContent.includes('activePlot.sheetData?.construction');
  const hasConstructionSection = tooltipContent.includes('CONSTRUCTION PROGRESS SECTION');
  const hasConstructionColor = tooltipContent.includes('getConstructionColor');
  
  console.log("✓ Tooltip.jsx analysis:");
  console.log("  - Has construction data check?", hasConstructionCheck ? "YES ✅" : "NO ❌");
  console.log("  - Has construction section?", hasConstructionSection ? "YES ✅" : "NO ❌");
  console.log("  - Has construction color helper?", hasConstructionColor ? "YES ✅" : "NO ❌");
  
} catch (err) {
  console.error("❌ Failed to read Tooltip:", err.message);
}

console.log("\n" + "=".repeat(60));
console.log("\n📋 Summary:");
console.log("\nIf all checks pass:");
console.log("1. Open http://localhost:3000");
console.log("2. Hover over villas 1-50");
console.log("3. Look for 'Construction' section in tooltip");
console.log("4. Should show: percentage, progress bar, and current stage");
console.log("\nIf construction doesn't show:");
console.log("- Check browser console for errors");
console.log("- Verify villa IDs in hover match API villa IDs");
console.log("- Use browser DevTools Network tab to inspect data");

console.log("\n" + "=".repeat(60) + "\n");

