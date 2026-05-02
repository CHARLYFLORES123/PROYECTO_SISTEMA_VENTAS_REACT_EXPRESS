import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, UpdateUserBody } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function fmt(u: any) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(usersTable).orderBy(usersTable.name);
    res.json(rows.map(fmt));
  } catch (err) { req.log.error({ err }, "GetUsers error"); res.status(500).json({ message: "Error interno" }); }
});

router.post("/", async (req, res) => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  const { name, email, password, role } = parsed.data;
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing) { res.status(400).json({ message: "El correo ya está registrado" }); return; }
    const passwordHash = await bcrypt.hash(password, 10);
    const [u] = await db.insert(usersTable).values({ name, email, passwordHash, role }).returning();
    res.status(201).json(fmt(u));
  } catch (err) { req.log.error({ err }, "CreateUser error"); res.status(500).json({ message: "Error interno" }); }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  const { name, email, password, role } = parsed.data;
  try {
    const updateData: any = { name, email, role };
    if (password) { updateData.passwordHash = await bcrypt.hash(password, 10); }
    const [u] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
    if (!u) { res.status(404).json({ message: "Usuario no encontrado" }); return; }
    res.json(fmt(u));
  } catch (err) { req.log.error({ err }, "UpdateUser error"); res.status(500).json({ message: "Error interno" }); }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ message: "Usuario eliminado" });
  } catch (err) { req.log.error({ err }, "DeleteUser error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
