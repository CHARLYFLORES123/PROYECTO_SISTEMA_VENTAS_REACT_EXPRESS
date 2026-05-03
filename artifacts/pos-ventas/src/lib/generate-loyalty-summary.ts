import jsPDF from "jspdf";

export interface LoyaltySummaryCoupon {
  code: string;
  tier: string;
  discountPercent: number;
  status: string;
  expiresAt: string;
}

export interface LoyaltySummaryData {
  customerId: number;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  tier: string;
  tierLabel: string;
  tierMultiplier: number;
  tierColor?: string;
  points: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  discountValue: number;
  progressToNext: number;
  pointsToNext: number;
  nextTier: { name: string; label: string; min: number } | null;
  coupons: LoyaltySummaryCoupon[];
  companyName: string;
  currencySymbol: string;
  generatedAt: string;
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

function addChip(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, fill: [number, number, number], text: [number, number, number]) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setTextColor(...text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label, x + w / 2, y + 5.4, { align: "center" });
}

export async function generateLoyaltySummaryPDF(data: LoyaltySummaryData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const INDIGO = [79, 70, 229] as [number, number, number];
  const VIOLET = [109, 40, 217] as [number, number, number];
  const GREEN = [22, 163, 74] as [number, number, number];
  const AMBER = [217, 119, 6] as [number, number, number];
  const SLATE = [100, 116, 139] as [number, number, number];
  const DARK = [15, 23, 42] as [number, number, number];
  const LIGHT = [238, 240, 245] as [number, number, number];
  let y = 0;

  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageW, 40, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(data.companyName, 14, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 225, 255);
  doc.text("Resumen de fidelización del cliente", 14, 24);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - 64, 6, 50, 28, 4, 4, "F");
  doc.setTextColor(...VIOLET);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Fidelización", pageW - 39, 15, { align: "center" });
  doc.setFontSize(13);
  doc.text(`#${String(data.customerId).padStart(6, "0")}`, pageW - 39, 25, { align: "center" });

  y = 50;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, y, pageW - 28, 40, 4, 4, "F");
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, 20, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  if (data.customerEmail) doc.text(`Email: ${data.customerEmail}`, 20, y + 18);
  if (data.customerPhone) doc.text(`Tel: ${data.customerPhone}`, 20, y + 25);
  doc.text(`Generado: ${fmtDate(data.generatedAt)}`, 20, y + 32);

  addChip(doc, pageW - 68, y + 8, 48, 10, `Nivel ${data.tierLabel}`, AMBER, [255, 255, 255]);
  addChip(doc, pageW - 68, y + 21, 48, 10, `x${data.tierMultiplier}`, INDIGO, [255, 255, 255]);

  y = 98;
  const metrics = [
    { label: "Puntos", value: data.points.toLocaleString("es"), fill: VIOLET },
    { label: "Saldo en Bs", value: fmtMoney(data.discountValue, data.currencySymbol), fill: GREEN },
    { label: "Acumulados", value: data.lifetimeEarned.toLocaleString("es"), fill: AMBER },
    { label: "Canjeados", value: data.lifetimeRedeemed.toLocaleString("es"), fill: SLATE },
  ];
  const metricW = (pageW - 34) / 2;
  metrics.forEach((m, i) => {
    const x = 14 + (i % 2) * (metricW + 6);
    const yy = y + Math.floor(i / 2) * 20;
    doc.setFillColor(...m.fill);
    doc.roundedRect(x, yy, metricW, 16, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(m.label, x + 4, yy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(m.value, x + 4, yy + 12);
  });

  y = 144;
  doc.setFillColor(...LIGHT);
  doc.roundedRect(14, y, pageW - 28, 24, 4, 4, "F");
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Progreso a ${data.nextTier ? data.nextTier.label : "nivel máximo"}`, 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  if (data.nextTier) {
    doc.text(`${data.pointsToNext.toLocaleString("es")} pts para subir`, 20, y + 15);
    doc.setFillColor(230, 232, 240);
    doc.roundedRect(20, y + 17, pageW - 40, 4, 2, 2, "F");
    doc.setFillColor(...VIOLET);
    doc.roundedRect(20, y + 17, ((pageW - 40) * data.progressToNext) / 100, 4, 2, 2, "F");
  } else {
    doc.text("Cliente en nivel máximo", 20, y + 15);
  }

  y = 174;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Cupones disponibles", 14, y);
  y += 5;
  const activeCoupons = data.coupons.filter((c) => c.status === "active");
  if (activeCoupons.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text("No tiene cupones activos por el momento.", 14, y + 6);
  } else {
    activeCoupons.slice(0, 4).forEach((c, idx) => {
      const yy = y + idx * 18;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, yy, pageW - 28, 14, 3, 3, "F");
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(c.code, 20, yy + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...SLATE);
      doc.setFontSize(8);
      doc.text(`${c.discountPercent}% · vence ${fmtDate(c.expiresAt)}`, 20, yy + 10.5);
      doc.setTextColor(...VIOLET);
      doc.setFont("helvetica", "bold");
      doc.text(c.tier.toUpperCase(), pageW - 20, yy + 8.2, { align: "right" });
    });
  }

  y = 236;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Resumen rápido", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`• Multiplicador activo: x${data.tierMultiplier}`, 18, y + 8);
  doc.text(`• Próximo nivel: ${data.nextTier ? data.nextTier.label : "Máximo"}`, 18, y + 14);
  doc.text(`• Descuento actual potencial: ${fmtMoney(data.discountValue, data.currencySymbol)}`, 18, y + 20);

  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text("Gracias por su compra y por confiar en nosotros.", pageW / 2, 285, { align: "center" });

  return doc;
}

export async function printLoyaltySummary(data: LoyaltySummaryData): Promise<void> {
  const doc = await generateLoyaltySummaryPDF(data);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}

export async function downloadLoyaltySummary(data: LoyaltySummaryData): Promise<void> {
  const doc = await generateLoyaltySummaryPDF(data);
  doc.save(`resumen-fidelizacion-${String(data.customerId).padStart(6, "0")}.pdf`);
}
