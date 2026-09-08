import "dotenv/config";
import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error("SMTP no configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASSWORD.");
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass: password },
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

  await getTransporter().sendMail({
    from,
    to: params.to,
    subject: `Boleta de venta #${String(params.saleId).padStart(6, "0")} - ${params.companyName}`,
    text: `Hola ${params.customerName},\n\nAdjuntamos tu boleta de venta por Bs ${params.total.toFixed(2)}.\n\nGracias por tu compra.`,
    attachments: [{
      filename: `Boleta_${String(params.saleId).padStart(6, "0")}.pdf`,
      content: params.pdf,
      contentType: "application/pdf",
    }],
  });
}