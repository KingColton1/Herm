// Converts a civmap.com claims (manual) export into Herm's JSON format.
//
// Getting the export (in your browser, on civmap.com/map):
//   1. Press F12 (Inspect Element) -> Console tab.
//   2. Go to the file named "manual-claim-download.txt" for command to export the json file.
//   3. Then go back to the IDE of your choice (or in command line, not in browser's) and run this command below (REPLACE "Your/Path/To/Herm" with your actual path to Herm folder);
//
//   node tools/civmap_to_herm.js ~/Your/Path/To/Herm/claims.json "Civmap Territory.json" [nation filter...]
//
// Usage (in command line):
//   node tools/civmap_to_herm.js ~/Your/Path/To/Herm/claims.json "Civmap Territory.json" [nation filter...]
//   e.g. node tools/civmap_to_herm.js ~/Your/Path/To/Herm/claims.json "Civmap Territory.json" "Republic of Icenia"

const fs = require("fs");
const [inFile, outFile, ...nationFilter] = process.argv.slice(2);
const raw = fs.readFileSync(inFile, "utf8");
const wanted = new Set(nationFilter.map(n => n.toLowerCase()));
const roundRing = ring => ring.map(([x, z]) => [Math.round(x), Math.round(z)]);
const features = [];
let claims;

// Failsafe to prevent crash, incomplete, or empty claims.json from being used.
if (!inFile || !outFile) {
   console.error("Usage: node civmap_to_herm.js <claims.json> <out.json> [nation names...]");
   process.exit(1);
}

if (raw.trim() === "") {
   console.error(`${inFile} is empty. Redownload it from civmap.com (see the steps at top of this file).`);
   process.exit(1);
}

try {
   claims = JSON.parse(raw);
} catch (e) {
   console.error(`${inFile} isn't valid JSON (${e.message}). It is probably cut off when copying. Please try redownload it.`);
   process.exit(1);
}
// claims.json is valid, continue the converter script.

function polygonsOf(geo) {
   if (!geo) return [];
   if (geo.type === "Polygon") return [geo.coordinates];
   if (geo.type === "MultiPolygon") return geo.coordinates;
   return [];
}

// Some claims such as "Jorvik (Volterra)" will result in "Jorvik (Volterra), Volterra".
// So this function will remove the nation name from the end of the claim name if present.
// After this function, it will show as "Jorvik, Volterra" in the alert.
function regionName(claim) {
   const name = claim.name ?? claim.nationName;
   const suffix = ` (${claim.nationName})`;
   return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

for (const claim of claims) {
   if (wanted.size && !wanted.has(String(claim.nationName).toLowerCase())) continue;
   if (claim.status && claim.status !== "live") continue;

   const polys = (claim.polygons ?? []).flatMap(p => polygonsOf(p.geometryGeoJson));
   if (polys.length === 0) continue;
   const holes = polys.flatMap(p => p.slice(1)).map(roundRing);

   features.push({
      name: regionName(claim),
      id: `civmap/${claim.uid}`,
      polygon: polys.map(p => roundRing(p[0])),
      ...(holes.length ? { holes } : {}),
      nation: claim.nationName,
      color: claim.color ?? claim.nationColor ?? undefined,        // region color
      nationColor: claim.nationColor ?? claim.color ?? undefined,  // nation color
   });
}

const out = {
   id: "civmap/claims",
   name: "civmap.com claims",
   info: { last_update: Math.floor(Date.now() / 1000) },
   features,
};

fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`Converted ${features.length} features to ${outFile}`);