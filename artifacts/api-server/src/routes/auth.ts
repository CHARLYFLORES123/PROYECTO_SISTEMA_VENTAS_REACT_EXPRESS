import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { verifyToken, signToken, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { auditLog } from "../lib/audit";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos inválidos" });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ message: "Credenciales incorrectas" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Credenciales incorrectas" });
      return;
    }

    const token = signToken(user.id, user.role, user.name);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });

    const forwarded = req.headers["x-forwarded-for"] as string | undefined;
    const ip = forwarded?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;
    db.insert((await import("@workspace/db")).auditLogsTable).values({
      userId: user.id, userName: user.name, userRole: user.role,
      action: "login", entity: "user", entityId: user.id, entityName: user.email, ip,
    }).catch(e => logger.warn({ err: e }, "Audit login failed"));
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos inválidos" });
    return;
  }
  const { name, email, password } = parsed.data;

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing) {
      res.status(400).json({ message: "El correo ya está registrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();

    const token = signToken(user.id, user.role, user.name);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/auth/me
router.get("/me", verifyToken, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "GetMe error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
