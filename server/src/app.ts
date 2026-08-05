import express, { Express, Request, Response } from "express";
import cors from "cors";

// The Express app is created here (separate from the server bootstrap in
// index.ts) so that Supertest can import and exercise it without opening a port.
export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Root route so the foundation shows a response when hit directly.
  app.get("/", (_req: Request, res: Response) => {
    res.json({ service: "TokTickIT API", status: "running" });
  });

  return app;
}

export default createApp;
