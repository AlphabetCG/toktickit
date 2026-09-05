import type { Request, Response, NextFunction } from "express";
import { getPrisma } from "./prisma.js";

// The Development Requester resolved from X-Requester-Id. Not authentication
// (BR-03) — a testing mechanism shaped like an auth header so Lab 3 can swap it
// for `Authorization: Bearer …` without changing any route signature (D-07).
export interface RequesterContext {
  id: number;
  name: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requester?: RequesterContext;
    }
  }
}

// Deliberately identical for every rejection case so the endpoint never becomes
// a probe for which Requester ids exist (api-spec §1.2).
const UNAUTHORIZED = { error: "No Development Requester selected" };

/**
 * Resolves X-Requester-Id to an **active** RequesterUser and attaches it to the
 * request, or returns 401. The four rejection cases — header absent, not an
 * integer, no such Requester, and inactive Requester — return the same body.
 */
export async function requireRequester(req: Request, res: Response, next: NextFunction) {
  const raw = req.header("X-Requester-Id");

  // Absent or not a plain positive integer.
  if (!raw || !/^\d+$/.test(raw)) {
    res.status(401).json(UNAUTHORIZED);
    return;
  }

  try {
    const requester = await getPrisma().requesterUser.findFirst({
      where: { id: Number(raw), isActive: true },
      select: { id: true, name: true, email: true },
    });

    // Unknown id or inactive Requester — same response as the malformed cases.
    if (!requester) {
      res.status(401).json(UNAUTHORIZED);
      return;
    }

    req.requester = requester;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
