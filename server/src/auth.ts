import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { findSessionUser, SESSION_COOKIE } from "./session.js";

// The acting user resolved from the session cookie — never from any client-
// supplied field (BR-03). Replaces Lab 2's requester-header context.
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: number;
    }
  }
}

/**
 * Gate 1 — authenticate (api-spec §1.3). Read the cookie, resolve a live session,
 * load the user, and confirm the account is still active. Any failure → 401,
 * before any resource is read (BR-13). A user deactivated during a live session
 * fails here on the next request, so deactivation takes effect immediately.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token.length === 0) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  try {
    const resolved = await findSessionUser(getPrisma(), token);
    if (!resolved || !resolved.user.isActive) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const { id, name, email, role, mustChangePassword } = resolved.user;
    req.user = { id, name, email, role, mustChangePassword };
    req.sessionId = resolved.sessionId;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Gate 2 — password gate (api-spec §1.3). A user flagged for a change may reach
 * only /api/auth/me, /api/auth/password, and /api/auth/logout; every other route
 * returns 403 with passwordChangeRequired so the client can route to the change
 * screen (BR-02). Apply after requireAuth.
 */
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    res.status(403).json({ error: "Password change required", passwordChangeRequired: true });
    return;
  }
  next();
}

/**
 * Gate 3 — authorize (api-spec §1.3, spec §6.1). A role refusal → 403; existence
 * is already known to the caller from their own role's route list (BR-14). Apply
 * after requireAuth (and normally requirePasswordChanged).
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have access to this resource" });
      return;
    }
    next();
  };
}
