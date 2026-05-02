import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SaleDetail {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface SaleForBoleta {
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

interface BusinessSettingsForBoleta {
  companyName: string;
  rucNit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
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

export async function generateBoleta(
  sale: SaleForBoleta,
  settings: BusinessSettingsForBoleta
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const sym = settings.currencySymbol || "Bs";
  const saleNum = `#${String(sale.id).padStart(6, "0")}`;

  const INDIGO = [79, 70, 229] as [number, number, number];
  const GRAY = [100, 116, 139] as [number, number, number];
  const DARK = [15, 23, 42] as [number, number, number];
  const LIGHT_BG = [238, 240, 245] as [number, number, number];

  let y = 0;

  // ─── HEADER BAND ────────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageW, 38, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(settings.companyName, 14, 15);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 255);
  const subLines: string[] = [];
  if (settings.rucNit) subLines.push(`NIT/RUC: ${settings.rucNit}`);
  if (settings.phone) subLines.push(`Tel: ${settings.phone}`);
  if (settings.email) subLines.push(settings.email);
  if (settings.address) subLines.push(settings.address);
  doc.text(subLines.join("   •   "), 14, 23);

  // BOLETA / FACTURA label (top right)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - 60, 6, 46, 26, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INDIGO);
  doc.text("BOLETA DE VENTA", pageW - 37, 16, { align: "center" });
  doc.setFontSize(14);
  doc.text(saleNum, pageW - 37, 25, { align: "center" });

  y = 46;

  // ─── INFO ROW ───────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageW - 28, 28, 3, 3, "F");

  const col1 = 20;
  const col2 = pageW / 2 + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("FECHA", col1, y + 8);
  doc.text("MÉTODO DE PAGO", col1, y + 18);
  doc.text("CLIENTE", col2, y + 8);
  doc.text("VENDEDOR", col2, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.text(fmtDate(sale.createdAt), col1, y + 14);
  doc.text(sale.paymentMethod, col1, y + 24);
  doc.text(sale.customerName || "Consumidor Final", col2, y + 14);
  doc.text(sale.userName || "—", col2, y + 24);

  y += 36;

  // ─── STATUS BADGE ───────────────────────────────────────────────────────────
  const isCompleted = sale.status === "completada";
  doc.setFillColor(...(isCompleted ? ([220, 252, 231] as [number, number, number]) : ([254, 226, 226] as [number, number, number])));
  doc.roundedRect(14, y, 40, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...(isCompleted ? ([22, 163, 74] as [number, number, number]) : ([220, 38, 38] as [number, number, number])));
  doc.text(isCompleted ? "COMPLETADO" : "ANULADO", 34, y + 5.5, { align: "center" });

  y += 14;

  // ─── PRODUCT TABLE ──────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Detalle de Productos", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["N°", "Producto", "Cant.", "Precio Unit.", "Subtotal"]],
    body: sale.details.map((d, i) => [
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
      fillColor: INDIGO,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ─── TOTALS BOX ─────────────────────────────────────────────────────────────
  const boxW = 78;
  const boxX = pageW - 14 - boxW;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(boxX, y, boxW, 32, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Subtotal:", boxX + 6, y + 9);
  doc.text("IVA (13%):", boxX + 6, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("TOTAL:", boxX + 6, y + 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(sale.subtotal, sym), boxX + boxW - 6, y + 9, { align: "right" });
  doc.text(fmtMoney(sale.iva, sym), boxX + boxW - 6, y + 18, { align: "right" });

  doc.setFillColor(...INDIGO);
  doc.roundedRect(boxX, y + 22, boxW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtMoney(sale.total, sym), boxX + boxW - 6, y + 29, { align: "right" });
  doc.text("TOTAL", boxX + 6, y + 29);

  y += 40;

  // ─── NOTES ──────────────────────────────────────────────────────────────────
  if (sale.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Nota: ${sale.notes}`, 14, y);
    y += 8;
  }

  // ─── FOOTER ─────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setDrawColor(...INDIGO);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 4, pageW - 14, footerY - 4);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("¡Gracias por su compra! — Este documento es su comprobante de pago.", pageW / 2, footerY, { align: "center" });
  doc.setFontSize(7.5);
  doc.text(`${settings.companyName}  •  ${saleNum}  •  Generado el ${fmtDate(new Date().toISOString())}`, pageW / 2, footerY + 6, { align: "center" });

  return doc;
}

export function downloadBoleta(sale: SaleForBoleta, settings: BusinessSettingsForBoleta): void {
  generateBoleta(sale, settings).then((doc) => {
    doc.save(`Boleta_${String(sale.id).padStart(6, "0")}.pdf`);
  });
}

export function printBoleta(sale: SaleForBoleta, settings: BusinessSettingsForBoleta): void {
  generateBoleta(sale, settings).then((doc) => {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        win.print();
      });
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
}
