import fs from 'fs/promises';
import path from 'path';
import MasterPlan from "../components/MasterPlan";

async function getSheetData() {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const url = `${baseUrl}/api/plots`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch sheet data. Check API route.');
  }
  const data = await res.json();
  return data.rows;
}

async function getMapData() {
  const filePath = path.join(process.cwd(), 'public', 'plots.json');
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error("Could not read plots.json. Did you run `npm run svg:convert`?", error);
    return { viewBox: "0 0 1000 1000", plots: [] };
  }
}

export default async function HomePage() {
  const [sheetRows, mapData] = await Promise.all([
    getSheetData(),
    getMapData()
  ]);

  return (
    <main>
      <MasterPlan mapData={mapData} sheetRows={sheetRows} />
    </main>
  );
}
