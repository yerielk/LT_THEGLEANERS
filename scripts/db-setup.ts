import { openDb, dbPath } from "../src/lib/db";
import { seedDatabase } from "../src/lib/data/seed";

const db = openDb();
const res = seedDatabase(db);
const counts = db.prepare(
  "SELECT (SELECT COUNT(*) FROM works) AS works, (SELECT COUNT(*) FROM work_tags) AS tags, (SELECT COUNT(*) FROM exhibitions) AS exhibitions",
).get();
console.log(`[db:setup] ${dbPath()}`);
console.log(`[db:setup] seeded ${res.works} catalog works, ${res.exhibitions} editorial exhibitions`);
console.log(`[db:setup] totals`, counts);
db.close();
