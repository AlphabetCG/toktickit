import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

// Exported without app.listen() — that lives in index.ts — so Supertest can
// import the app without opening a port.
export const app = express();

app.use(cors());          // lets the Vite dev server call this API
app.use(express.json());

// Issue 2: health check the client uses to confirm the API is reachable.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// Issue 4: list the seeded IT request categories from PostgreSQL, in id order.
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load categories" });
  }
});
