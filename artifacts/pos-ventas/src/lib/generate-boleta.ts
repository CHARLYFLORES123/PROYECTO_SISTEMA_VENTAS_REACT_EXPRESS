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
  customerNitCi?: string | null;
  customerPhone?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number | null;
  changeDue?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  details: SaleDetail[];
  pointsEarned?: number | null;
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
  const hasClientDetails = Boolean(sale.customerNitCi || sale.customerPhone);
  const infoHeight = hasClientDetails ? 34 : 28;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, y, pageW - 28, infoHeight, 3, 3, "F");

  const col1 = 20;
  const col2 = pageW / 2 + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GRAY);
  doc.text("FECHA", col1, y + 8);
  doc.text("MÉTODO DE PAGO", col1, y + (hasClientDetails ? 22 : 18));
  doc.text("CLIENTE", col2, y + 8);
  doc.text("VENDEDOR", col2, y + (hasClientDetails ? 22 : 18));

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.text(fmtDate(sale.createdAt), col1, y + 14);
  doc.text(sale.paymentMethod, col1, y + (hasClientDetails ? 28 : 24));
  doc.text(sale.customerName || "Consumidor Final", col2, y + 14);

  if (hasClientDetails) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    const extraParts: string[] = [];
    if (sale.customerNitCi) extraParts.push(`CI/NIT: ${sale.customerNitCi}`);
    if (sale.customerPhone) extraParts.push(`Tel: ${sale.customerPhone}`);
    doc.text(extraParts.join("   •   "), col2, y + 18);
  }

  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(sale.userName || "—", col2, y + (hasClientDetails ? 28 : 24));

  y += infoHeight + 8;

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
  const isCash = (sale.paymentMethod || "").toLowerCase().includes("efectivo") || sale.amountPaid != null;
  const cashRec = sale.amountPaid !== undefined && sale.amountPaid !== null
    ? Number(sale.amountPaid)
    : (isCash ? Number(sale.total) : null);
  const chgDue = sale.changeDue !== undefined && sale.changeDue !== null
    ? Number(sale.changeDue)
    : 0;
  const hasCashInfo = isCash && cashRec !== null;
  const boxH = hasCashInfo ? 38 : 24;
  const boxW = 84;
  const boxX = pageW - 14 - boxW;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Subtotal:", boxX + 6, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(fmtMoney(sale.subtotal, sym), boxX + boxW - 6, y + 8, { align: "right" });

  doc.setFillColor(...INDIGO);
  doc.roundedRect(boxX, y + 13, boxW, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtMoney(sale.total, sym), boxX + boxW - 6, y + 21, { align: "right" });
  doc.text("TOTAL", boxX + 6, y + 21);

  if (hasCashInfo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text("Efectivo Recibido:", boxX + 6, y + 29);
    doc.text(fmtMoney(cashRec, sym), boxX + boxW - 6, y + 29, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(4, 120, 87); // Emerald green
    doc.text("Cambio:", boxX + 6, y + 34.5);
    doc.text(fmtMoney(chgDue, sym), boxX + boxW - 6, y + 34.5, { align: "right" });
  }

  y += boxH + 8;

  // ─── NOTES ──────────────────────────────────────────────────────────────────
  if (sale.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(`Nota: ${sale.notes}`, 14, y);
    y += 8;
  }

  // ─── PUNTOS GANADOS ────────────────────────────────────────────────────────
  if (sale.pointsEarned && sale.pointsEarned > 0) {
    const bannerW = pageW - 28;
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(14, y, bannerW, 16, 2.5, 2.5, "F");
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.4);
    doc.roundedRect(14, y, bannerW, 16, 2.5, 2.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 83, 9);
    doc.text(`* PUNTOS GANADOS EN ESTA COMPRA: +${sale.pointsEarned} pts`, 20, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(146, 64, 14);
    doc.text("¡Felicidades! Puedes canjear estos puntos por descuentos en tu proxima compra.", 20, y + 12);

    y += 22;
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

export async function emailBoleta(
  sale: SaleForBoleta,
  settings: BusinessSettingsForBoleta,
  apiBase: string,
  token: string | null,
): Promise<void> {
  const doc = await generateBoleta(sale, settings);
  const dataUri = doc.output("datauristring");
  const pdfBase64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const response = await fetch(`${apiBase}/sales/${sale.id}/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ pdfBase64 }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "No se pudo enviar la boleta");
  }
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
