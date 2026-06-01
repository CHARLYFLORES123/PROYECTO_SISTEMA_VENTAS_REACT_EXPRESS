import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

const JWT_SECRET = process.env.JWT_SECRET ?? "pos-ventas-secret-change-in-prod";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export function verifyToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "No autorizado" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch (err) {
    logger.warn({ err }, "Invalid JWT token");
    res.status(401).json({ message: "Token inválido o expirado" });
  }
}

export function signToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireRoles(allowed: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.userRole ?? "";
    if (!allowed.includes(role)) {
      res.status(403).json({ message: "No tienes permiso para realizar esta acción" });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRoles(["admin"]);
