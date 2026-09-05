import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { requireRequester } from "./requesterContext.js";

// Exported without app.listen() — that lives in index.ts — so Supertest can
// import the app without opening a port.
export const app = express();

app.use(cors());          // lets the Vite dev server call this API
app.use(express.json());

// Lab 1 / Issue 2: health check the client uses to confirm the API is reachable.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// --- Public: the selector must load before any Requester exists in state -----

// Lab 2 / Issue #14: active Development Requesters for the selection screen.
// Public (api-spec §1.6); inactive Requesters never appear (BR-13, BR-20).
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requesterUser.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Failed to load requesters" });
  }
});

// --- Scoped: every route below requires a valid X-Requester-Id ---------------

// Lab 1 / Issue 4, now scoped in Lab 2 (api-spec §1.6): the active IT request
// categories from PostgreSQL, in id order.
app.get("/api/categories", requireRequester, async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Failed to load categories" });
  }
});
