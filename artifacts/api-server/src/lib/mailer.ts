import dotenv from "dotenv";
import path from "path";
import nodemailer from "nodemailer";

dotenv.config();
if (!process.env.SMTP_USER) {
  dotenv.config({ path: path.resolve(process.cwd(), "artifacts/api-server/.env") });
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("SMTP no configurado en el servidor. Define SMTP_HOST, SMTP_USER y SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass: password },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendSaleReceiptEmail(params: {
  to: string;
  customerName: string;
  saleId: number;
  total: number;
  companyName: string;
  pdf: Buffer;
}): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM o SMTP_USER es requerido.");

  const formattedFrom = `"${params.companyName}" <${from}>`;

  await getTransporter().sendMail({
    from: formattedFrom,
    to: params.to,
    subject: `Boleta de venta #${String(params.saleId).padStart(6, "0")} - ${params.companyName}`,
    text: `Hola ${params.customerName},\n\nAdjuntamos tu boleta de venta #${String(params.saleId).padStart(6, "0")} por un total de Bs ${params.total.toFixed(2)}.\n\nGracias por tu preferencia.\n${params.companyName}`,
    attachments: [{
      filename: `Boleta_${String(params.saleId).padStart(6, "0")}.pdf`,
      content: params.pdf,
      contentType: "application/pdf",
    }],
  });
}