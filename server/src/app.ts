import express, { Request, Response } from "express";
import cors from "cors";

// Exported without app.listen() — that lives in index.ts — so Supertest can
// import the app without opening a port.
export const app = express();

app.use(cors());          // lets the Vite dev server call this API
app.use(express.json());

// Issue 2: health check the client uses to confirm the API is reachable.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// TODO(Issue 4): add GET /api/categories.
// Import getPrisma from "./prisma.js", read with getPrisma().category.findMany()
// in id order, return each { id, name }, and answer 500 on failure.
