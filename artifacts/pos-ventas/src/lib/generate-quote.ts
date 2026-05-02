import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface QuoteDetail {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface QuoteForPDF {
  id: number;
  customerName?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  validUntil?: string | null;
  createdAt: string;
  details: QuoteDetail[];
}

interface BusinessSettingsForQuote {
  companyName: string;
  rucNit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  currency: string;
  currencySymbol: string;
}

function fmtMoney(amount: number, symbol: string): string {
  return `${symbol} ${amount.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDateOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: "PENDIENTE",
  convertida: "CONVERTIDA",
  vencida: "VENCIDA",
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pendiente: [245, 158, 11],
  convertida: [22, 163, 74],
  vencida: [220, 38, 38],
};

const STATUS_BG: Record<string, [number, number, number]> = {
  pendiente: [255, 251, 235],
  convertida: [220, 252, 231],
  vencida: [254, 226, 226],
};

export async function generateQuotePDF(
  quote: QuoteForPDF,
  settings: BusinessSettingsForQuote
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sym = settings.currencySymbol || "Bs";
  const quoteNum = `#${String(quote.id).padStart(6, "0")}`;

  const INDIGO = [79, 70, 229] as [number, number, number];
  const GRAY = [100, 116, 139] as [number, number, number];
  const DARK = [15, 23, 42] as [number, number, number];
  const LIGHT_BG = [238, 240, 245] as [number, number, number];
  const AMBER = [245, 158, 11] as [number, number, number];

  let y = 0;

  // ─── WATERMARK (drawn first, behind content) ──────────────────────────────
  const wmStatus = quote.status;
  const wmText =
    wmStatus === "pendiente"
      ? "PENDIENTE DE APROBACIÓN"
      : wmStatus === "convertida"
      ? "COTIZACIÓN APROBADA"
      : "COTIZACIÓN VENCIDA";

  doc.saveGraphicsState();
  doc.setFontSize(38);
  doc.setFont("helvetica", "bold");
  // Very light gray watermark
  doc.setTextColor(220, 220, 220);
  doc.text(wmText, pageW / 2, pageH / 2, {
    align: "center",
    angle: 45,
  });
  doc.restoreGraphicsState();

  // ─── HEADER BAND ──────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageW, 38, "F");

  // Left: amber accent stripe
  doc.setFillColor(...AMBER);
  doc.rect(0, 0, 3, 38, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.companyName, 18, 15);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 255);
  const subLines: string[] = [];
  if (settings.rucNit) subLines.push(`NIT/RUC: ${settings.rucNit}`);
  if (settings.phone) subLines.push(`Tel: ${settings.phone}`);
  if (settings.email) subLines.push(settings.email);
  if (settings.address) subLines.push(settings.address);
  doc.text(subLines.join("   •   "), 18, 23);

  // COTIZACIÓN badge (top right)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - 62, 5, 50, 28, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...AMBER);
  doc.text("COTIZACIÓN", pageW - 37, 15, { align: "center" });

  doc.setFontSize(15);
  doc.setTextColor(...INDIGO);
  doc.text(quoteNum, pageW - 37, 26, { align: "center" });

  y = 46;

  // ─── STATUS BADGE ─────────────────────────────────────────────────────────
  const statusColor = STATUS_COLORS[quote.status] || GRAY;
  const statusBg = STATUS_BG[quote.status] || ([240, 240, 240] as [number, number, number]);
  const statusLabel = STATUS_LABELS[quote.status] || quote.status.toUpperCase();

  doc.setFillColor(...statusBg);
  doc.roundedRect(14, y, 48, 9, 2, 2, "F");
  doc.setDrawColor(...statusColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, 48, 9, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...statusColor);
  doc.text(statusLabel, 38, y + 6, { align: "center" });

  y += 16;

  // ─── INFO ROW ─────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageW - 28, 32, 3, 3, "F");

  const col1 = 20;
  const col2 = pageW / 2 + 4;

  // Labels
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("FECHA EMISIÓN", col1, y + 8);
  doc.text("VÁLIDO HASTA", col1, y + 20);
  doc.text("CLIENTE", col2, y + 8);
  doc.text("VENDEDOR", col2, y + 20);

  // Values
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.text(fmtDate(quote.createdAt), col1, y + 14);
  doc.text(
    quote.validUntil ? fmtDateOnly(quote.validUntil) : "Sin vencimiento",
    col1,
    y + 26
  );
  doc.text(quote.customerName || "Consumidor Final", col2, y + 14);
  doc.text(quote.userName || "—", col2, y + 26);

  y += 40;

  // ─── NOTES ABOUT VALIDITY ─────────────────────────────────────────────────
  if (quote.validUntil) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...AMBER);
    doc.text(
      `⚠  Esta cotización es válida hasta el ${fmtDateOnly(quote.validUntil)}. Pasada esa fecha los precios pueden variar.`,
      14,
      y
    );
    y += 8;
  }

  // ─── PRODUCT TABLE ────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Detalle de Productos / Servicios", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["N°", "Descripción", "Cantidad", "Precio Unit.", "Subtotal"]],
    body: quote.details.map((d, i) => [
      String(i + 1),
      d.productName,
      String(d.quantity),
      fmtMoney(d.unitPrice, sym),
      fmtMoney(d.subtotal, sym),
    ]),
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [245, 158, 11] as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── TOTALS BOX ───────────────────────────────────────────────────────────
  const boxW = 80;
  const boxX = pageW - 14 - boxW;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(boxX, y, boxW, 32, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Subtotal (sin IVA):", boxX + 6, y + 9);
  doc.text("IVA (13%):", boxX + 6, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("TOTAL COTIZADO:", boxX + 6, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(quote.subtotal, sym), boxX + boxW - 6, y + 9, { align: "right" });
  doc.text(fmtMoney(quote.iva, sym), boxX + boxW - 6, y + 18, { align: "right" });

  doc.setFillColor(...AMBER);
  doc.roundedRect(boxX, y + 22, boxW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtMoney(quote.total, sym), boxX + boxW - 6, y + 29, { align: "right" });
  doc.text("TOTAL", boxX + 6, y + 29);

  y += 40;

  // ─── NOTES ────────────────────────────────────────────────────────────────
  if (quote.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Nota: ${quote.notes}`, 14, y);
    y += 8;
  }

  // ─── TERMS BOX ────────────────────────────────────────────────────────────
  const remainingY = doc.internal.pageSize.getHeight() - 60;
  if (y < remainingY) {
    y = Math.max(y, remainingY - 30);
  }

  // Signature lines
  const sigY = Math.min(y + 10, pageH - 45);
  const sig1X = 14;
  const sig2X = pageW / 2 + 5;
  const sigW = pageW / 2 - 20;

  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.4);
  doc.line(sig1X, sigY, sig1X + sigW, sigY);
  doc.line(sig2X, sigY, sig2X + sigW, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Autorizado por / Empresa", sig1X + sigW / 2, sigY + 5, { align: "center" });
  doc.text("Aceptado por / Cliente", sig2X + sigW / 2, sigY + 5, { align: "center" });

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = pageH - 18;
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 4, pageW - 14, footerY - 4);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    "Esta cotización no constituye una factura. Precios sujetos a cambio sin previo aviso.",
    pageW / 2,
    footerY,
    { align: "center" }
  );
  doc.setFontSize(7.5);
  doc.text(
    `${settings.companyName}  •  Cotización ${quoteNum}  •  Generado el ${fmtDate(new Date().toISOString())}`,
    pageW / 2,
    footerY + 6,
    { align: "center" }
  );

  return doc;
}

export function downloadQuotePDF(
  quote: QuoteForPDF,
  settings: BusinessSettingsForQuote
): void {
  generateQuotePDF(quote, settings).then((doc) => {
    doc.save(`Cotizacion_${String(quote.id).padStart(6, "0")}.pdf`);
  });
}

export function printQuotePDF(
  quote: QuoteForPDF,
  settings: BusinessSettingsForQuote
): void {
  generateQuotePDF(quote, settings).then((doc) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => win.print());
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
