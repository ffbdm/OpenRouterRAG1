import "dotenv/config";
import { db } from "../server/db";
import { catalogItems, catalogItemsSeed } from "@shared/schema";

async function main() {
  console.log("Seeding catalog items...");
  const inserted = await db
    .insert(catalogItems)
    .values(catalogItemsSeed)
    .onConflictDoNothing()
    .returning({ id: catalogItems.id });

  console.log(`Inserted ${inserted.length} catalog rows.`);
}

main()
  .then(() => {
    console.log("Catalog seed finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Catalog seed failed:", error);
    process.exit(1);
  });
