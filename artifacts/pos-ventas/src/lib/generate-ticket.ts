import jsPDF from "jspdf";

interface SaleDetail {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleForTicket {
  id: number;
  customerName?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  details: SaleDetail[];
}

interface BusinessSettingsForTicket {
  companyName: string;
  rucNit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  currency: string;
  currencySymbol: string;
}

const TICKET_WIDTH_MM = 80;
const TICKET_MARGIN = 5;
const CONTENT_WIDTH = TICKET_WIDTH_MM - TICKET_MARGIN * 2;
const LINE_H = 4.5;

function fmtMoney(amount: number, sym: string): string {
  return `${sym} ${amount.toFixed(2)}`;
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

function separator(doc: jsPDF, y: number, style: "dash" | "solid" = "dash"): number {
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  if (style === "dash") {
    const segW = 2.5;
    const gap = 1.5;
    let x = TICKET_MARGIN;
    while (x < TICKET_WIDTH_MM - TICKET_MARGIN) {
      doc.line(x, y, Math.min(x + segW, TICKET_WIDTH_MM - TICKET_MARGIN), y);
      x += segW + gap;
    }
  } else {
    doc.line(TICKET_MARGIN, y, TICKET_WIDTH_MM - TICKET_MARGIN, y);
  }
  return y + 3;
}

function addLine(
  doc: jsPDF,
  y: number,
  left: string,
  right: string,
  bold = false,
  fontSize = 8,
  rightBold = false
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(20, 20, 20);
  doc.text(left, TICKET_MARGIN, y);
  doc.setFont("helvetica", rightBold ? "bold" : "normal");
  doc.text(right, TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  return y + LINE_H;
}

function addCentered(
  doc: jsPDF,
  y: number,
  text: string,
  fontSize = 8,
  bold = false,
  color: [number, number, number] = [20, 20, 20]
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setTextColor(...color);
  doc.text(text, TICKET_WIDTH_MM / 2, y, { align: "center" });
  return y + LINE_H;
}

export async function generateTicket(
  sale: SaleForTicket,
  settings: BusinessSettingsForTicket
): Promise<jsPDF> {
  const sym = settings.currencySymbol || "Bs";
  const saleNum = `#${String(sale.id).padStart(6, "0")}`;

  // Estimate height: header ~30 + separator×2 + items + totals + footer ~20
  const estimatedHeight = 50 + sale.details.length * LINE_H * 1.5 + 60;

  const doc = new jsPDF({
    unit: "mm",
    format: [TICKET_WIDTH_MM, Math.max(estimatedHeight, 100)],
  });

  let y = 8;

  // ─── HEADER ──────────────────────────────────────────────────────────────────
  y = addCentered(doc, y, settings.companyName, 11, true);
  if (settings.rucNit) {
    y = addCentered(doc, y, `NIT/RUC: ${settings.rucNit}`, 7.5);
  }
  if (settings.address) {
    // Wrap address if long
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(settings.address, CONTENT_WIDTH) as string[];
    lines.forEach((line: string) => {
      doc.text(line, TICKET_WIDTH_MM / 2, y, { align: "center" });
      y += LINE_H;
    });
  }
  if (settings.phone) {
    y = addCentered(doc, y, `Tel: ${settings.phone}`, 7.5);
  }

  y += 2;
  y = separator(doc, y, "solid");

  // ─── BOLETA LABEL ────────────────────────────────────────────────────────────
  y += 1;
  y = addCentered(doc, y, "BOLETA DE VENTA", 9, true);
  y = addCentered(doc, y, saleNum, 9, true, [79, 70, 229]);
  y += 1;
  y = separator(doc, y, "solid");

  // ─── SALE INFO ───────────────────────────────────────────────────────────────
  y += 1;
  y = addLine(doc, y, "Fecha:", fmtDate(sale.createdAt));
  y = addLine(doc, y, "Cliente:", sale.customerName || "Consumidor Final");
  y = addLine(doc, y, "Pago:", sale.paymentMethod);
  if (sale.userName) {
    y = addLine(doc, y, "Vendedor:", sale.userName);
  }
  y += 1;
  y = separator(doc, y);

  // ─── COLUMN HEADERS ──────────────────────────────────────────────────────────
  y += 1;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("PRODUCTO", TICKET_MARGIN, y);
  doc.text("CANT", TICKET_MARGIN + 37, y, { align: "right" });
  doc.text("P.U.", TICKET_MARGIN + 52, y, { align: "right" });
  doc.text("TOTAL", TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  y += LINE_H - 0.5;
  y = separator(doc, y);
  y += 0.5;

  // ─── ITEMS ───────────────────────────────────────────────────────────────────
  sale.details.forEach((item) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);

    // Product name may wrap
    const nameLines = doc.splitTextToSize(item.productName, 34) as string[];
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, TICKET_MARGIN, y + i * LINE_H);
    });

    // Qty, unit price, subtotal on the first line
    doc.text(String(item.quantity), TICKET_MARGIN + 37, y, { align: "right" });
    doc.text(item.unitPrice.toFixed(2), TICKET_MARGIN + 52, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(item.subtotal.toFixed(2), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });

    y += nameLines.length * LINE_H + 0.5;
  });

  y += 1;
  y = separator(doc, y);
  y += 1;

  // ─── TOTALS ──────────────────────────────────────────────────────────────────
  y = addLine(doc, y, "Subtotal:", fmtMoney(sale.subtotal, sym));
  y = addLine(doc, y, "IVA (13%):", fmtMoney(sale.iva, sym));
  y += 1;
  y = separator(doc, y, "solid");
  y += 1;

  // Big total line
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL:", TICKET_MARGIN, y);
  doc.setTextColor(79, 70, 229);
  doc.text(fmtMoney(sale.total, sym), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  y += LINE_H + 2;

  // ─── NOTES ───────────────────────────────────────────────────────────────────
  if (sale.notes) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize(`Nota: ${sale.notes}`, CONTENT_WIDTH) as string[];
    noteLines.forEach((line: string) => {
      doc.text(line, TICKET_WIDTH_MM / 2, y, { align: "center" });
      y += LINE_H;
    });
    y += 1;
  }

  y = separator(doc, y, "solid");
  y += 2;

  // ─── FOOTER ──────────────────────────────────────────────────────────────────
  y = addCentered(doc, y, "¡Gracias por su compra!", 8, true);
  y = addCentered(doc, y, "Vuelva pronto", 7.5, false, [100, 116, 139]);
  if (settings.email) {
    y += 1;
    y = addCentered(doc, y, settings.email, 7, false, [100, 116, 139]);
  }
  y += 3;

  // Resize page to actual content
  const pages = doc.internal.pages;
  if (pages) {
    (doc.internal as any).pageSize.height = y;
  }

  return doc;
}

export function downloadTicket(
  sale: SaleForTicket,
  settings: BusinessSettingsForTicket
): void {
  generateTicket(sale, settings).then((doc) => {
    doc.save(`Ticket_${String(sale.id).padStart(6, "0")}.pdf`);
  });
}

export function printTicket(
  sale: SaleForTicket,
  settings: BusinessSettingsForTicket
): void {
  generateTicket(sale, settings).then((doc) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => win.print());
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
