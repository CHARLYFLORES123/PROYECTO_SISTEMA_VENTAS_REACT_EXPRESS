import { Router } from "express";
import { db, businessSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";
import { openCashDrawer } from "../lib/cash-drawer";

const router = Router();

router.use(verifyToken);

// POST /api/hardware/open-drawer — abre el cajón de dinero conectado a la impresora.
// La configuración (si está activo y si solo aplica a efectivo) vive en business_settings.
router.post("/open-drawer", async (req, res) => {
  try {
    const [settings] = await db.select().from(businessSettingsTable).limit(1);

    const force = req.body?.force === true;

    if (!force) {
      if (!settings || settings.openCashDrawer === false) {
        res.json({ success: false, skipped: true, message: "Apertura de cajón desactivada en configuración" });
        return;
      }

      const paymentMethod: string | undefined = req.body?.paymentMethod;
      if (settings.cashDrawerOnlyCash && paymentMethod && !paymentMethod.toLowerCase().includes("efectivo")) {
        res.json({ success: false, skipped: true, message: "Apertura omitida: el método de pago no es efectivo" });
        return;
      }
    }

    const printer = req.body?.printerName !== undefined ? req.body.printerName : settings?.printerName;
    const result = await openCashDrawer(printer);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "OpenCashDrawer error");
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

export default router;
