import fs from 'fs/promises';
import path from 'path';
import MasterPlan from "../components/MasterPlan";
import OrientationLock from "../components/OrientationLock";

async function getSheetData() {
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001";
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
    <OrientationLock>
      <main className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden" style={{
        minHeight: '100vh',
        minHeight: '100dvh', // Dynamic viewport height for mobile
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}>
        <MasterPlan mapData={mapData} sheetRows={sheetRows} />
      </main>
    </OrientationLock>
  );
}