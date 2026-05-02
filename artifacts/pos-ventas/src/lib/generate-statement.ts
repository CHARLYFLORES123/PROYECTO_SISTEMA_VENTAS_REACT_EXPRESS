import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface StatementSale {
  id: number;
  createdAt: string;
  paymentMethod: string;
  status: string;
  subtotal: number;
  iva: number;
  total: number;
}

export interface CustomerStatement {
  id: number;
  name: string;
  nitCi?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  totalSpent: number;
  saleCount: number;
  averageTicket: number;
  firstPurchase?: string | null;
  lastPurchase?: string | null;
  sales: StatementSale[];
}

interface BusinessSettingsForStatement {
  companyName: string;
  rucNit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  currencySymbol: string;
}

function fmtMoney(amount: number, symbol: string): string {
  return `${symbol} ${amount.toFixed(2)}`;
}

function fmtDate(iso: string): string {
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

function fmtDateTime(iso: string): string {
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

const STATUS_LABELS: Record<string, string> = {
  completada: "Completada",
  cancelada: "Cancelada",
  pendiente: "Pendiente",
};

export async function generateStatementPDF(
  customer: CustomerStatement,
  settings: BusinessSettingsForStatement,
  dateRange?: { from: string; to: string }
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const sym = settings.currencySymbol || "Bs";

  const INDIGO = [79, 70, 229] as [number, number, number];
  const TEAL = [20, 184, 166] as [number, number, number];
  const GRAY = [100, 116, 139] as [number, number, number];
  const DARK = [15, 23, 42] as [number, number, number];
  const LIGHT_BG = [238, 240, 245] as [number, number, number];
  const GREEN = [22, 163, 74] as [number, number, number];

  let y = 0;

  // ─── HEADER BAND ─────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, 3, 38, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.companyName, 12, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(200, 210, 255);
  const headerLines: string[] = [];
  if (settings.rucNit) headerLines.push(`NIT/RUC: ${settings.rucNit}`);
  if (settings.phone) headerLines.push(`Tel: ${settings.phone}`);
  if (settings.email) headerLines.push(settings.email);
  if (settings.address) headerLines.push(settings.address);
  doc.text(headerLines.join("   •   "), 12, 23);

  // Badge top-right
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - 62, 5, 58, 28, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEAL);
  doc.text("EXTRACTO DE CUENTA", pageW - 33, 15, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Generado: ${fmtDate(new Date().toISOString())}`, pageW - 33, 23, { align: "center" });

  y = 46;

  // ─── CUSTOMER INFO BOX ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(12, y, pageW - 24, 34, 3, 3, "F");

  doc.setFillColor(...TEAL);
  doc.roundedRect(12, y, 4, 34, 1, 1, "F");

  const cx = 22;
  const cy = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(customer.name, cx, cy + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  const infoLine: string[] = [];
  if (customer.nitCi) infoLine.push(`NIT/CI: ${customer.nitCi}`);
  if (customer.phone) infoLine.push(`Tel: ${customer.phone}`);
  if (customer.email) infoLine.push(customer.email);
  if (customer.address) infoLine.push(customer.address);
  doc.text(infoLine.join("   |   ") || "Sin datos de contacto registrados", cx, cy + 18);

  // Date range
  doc.setFontSize(8);
  if (dateRange) {
    doc.text(
      `Período: ${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`,
      cx,
      cy + 27
    );
  } else if (customer.firstPurchase && customer.lastPurchase) {
    doc.text(
      `Historial completo: ${fmtDate(customer.firstPurchase)} — ${fmtDate(customer.lastPurchase)}`,
      cx,
      cy + 27
    );
  }

  y += 42;

  // ─── SUMMARY CARDS ───────────────────────────────────────────────────────
  const cardW = (pageW - 24 - 12) / 4;
  const cards = [
    { label: "TOTAL GASTADO", value: fmtMoney(customer.totalSpent, sym), color: INDIGO },
    { label: "N° COMPRAS", value: String(customer.saleCount), color: TEAL },
    { label: "TICKET PROMEDIO", value: fmtMoney(customer.averageTicket, sym), color: GREEN },
    { label: "ÚLTIMA COMPRA", value: customer.lastPurchase ? fmtDate(customer.lastPurchase) : "—", color: GRAY },
  ];

  cards.forEach((card, i) => {
    const cx2 = 12 + i * (cardW + 4);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cx2, y, cardW, 22, 2, 2, "F");
    doc.setDrawColor(...(card.color as [number, number, number]));
    doc.setLineWidth(0.4);
    doc.roundedRect(cx2, y, cardW, 22, 2, 2, "S");

    doc.setFillColor(...(card.color as [number, number, number]));
    doc.rect(cx2, y, cardW, 1, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(card.label, cx2 + cardW / 2, y + 7, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(i < 3 ? 9 : 8);
    doc.setTextColor(...(card.color as [number, number, number]));
    doc.text(card.value, cx2 + cardW / 2, y + 16, { align: "center" });
  });

  y += 30;

  // ─── TRANSACTIONS TABLE ───────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Historial de Transacciones", 12, y);
  y += 4;

  const tableRows = customer.sales.map((s, i) => [
    String(i + 1),
    `#${String(s.id).padStart(6, "0")}`,
    fmtDateTime(s.createdAt),
    s.paymentMethod,
    STATUS_LABELS[s.status] || s.status,
    fmtMoney(s.subtotal, sym),
    fmtMoney(s.iva, sym),
    fmtMoney(s.total, sym),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "N° Venta", "Fecha", "Pago", "Estado", "Subtotal", "IVA", "Total"]],
    body: tableRows,
    margin: { left: 12, right: 12 },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: INDIGO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const status = customer.sales[data.row.index]?.status;
        if (status === "completada") data.cell.styles.textColor = GREEN;
        else if (status === "cancelada") data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── TOTALS ROW ───────────────────────────────────────────────────────────
  const boxW = 90;
  const boxX = pageW - 12 - boxW;

  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(boxX, y, boxW, 22, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text("Total de compras realizadas:", boxX + 6, y + 9);
  doc.text("Saldo acumulado:", boxX + 6, y + 17);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(String(customer.saleCount), boxX + boxW - 6, y + 9, { align: "right" });

  doc.setFillColor(...INDIGO);
  doc.roundedRect(boxX + 46, y + 12, boxW - 52, 9, 2, 2, "F");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtMoney(customer.totalSpent, sym), boxX + boxW - 8, y + 19, { align: "right" });

  // ─── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 16;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(12, footerY - 4, pageW - 12, footerY - 4);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "Este documento es un resumen informativo del historial de compras del cliente.",
    pageW / 2,
    footerY,
    { align: "center" }
  );
  doc.setFontSize(7.5);
  doc.text(
    `${settings.companyName}  •  Extracto de cuenta: ${customer.name}  •  ${fmtDateTime(new Date().toISOString())}`,
    pageW / 2,
    footerY + 6,
    { align: "center" }
  );

  return doc;
}

export function downloadStatementPDF(
  customer: CustomerStatement,
  settings: BusinessSettingsForStatement
): void {
  generateStatementPDF(customer, settings).then((doc) => {
    doc.save(`Extracto_${customer.name.replace(/\s+/g, "_")}.pdf`);
  });
}

export function printStatementPDF(
  customer: CustomerStatement,
  settings: BusinessSettingsForStatement
): void {
  generateStatementPDF(customer, settings).then((doc) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => win.print());
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
