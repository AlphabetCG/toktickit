import { getPrisma } from "../src/prisma.js";

// TODO(Issue 3): upsert the four categories — Account and Access, Hardware,
// Software, Network — so that running the seed twice creates no duplicates.
// Hint: prisma.category.upsert({ where: { name }, update: {}, create: { name } })
async function main() {
  const prisma = getPrisma();
  console.log("TODO: implement the category seed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
