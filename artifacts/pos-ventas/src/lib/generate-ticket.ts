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
const TICKET_MARGIN = 4;
const CONTENT_WIDTH = TICKET_WIDTH_MM - TICKET_MARGIN * 2;
const LINE_H = 5.8;

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

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function separator(doc: jsPDF, y: number, style: "dash" | "solid" = "dash"): number {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  if (style === "dash") {
    const segW = 2.0;
    const gap = 1.2;
    let x = TICKET_MARGIN;
    while (x < TICKET_WIDTH_MM - TICKET_MARGIN) {
      doc.line(x, y, Math.min(x + segW, TICKET_WIDTH_MM - TICKET_MARGIN), y);
      x += segW + gap;
    }
  } else {
    doc.line(TICKET_MARGIN, y, TICKET_WIDTH_MM - TICKET_MARGIN, y);
  }
  return y + 2.2;
}

function addLine(
  doc: jsPDF,
  y: number,
  left: string,
  right: string,
  bold = true,
  fontSize = 8,
  rightBold = true
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(left, TICKET_MARGIN, y);
  doc.setFont("helvetica", "bold");
  doc.text(right, TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  return y + LINE_H;
}

function addCentered(
  doc: jsPDF,
  y: number,
  text: string,
  fontSize = 8,
  bold = true,
  color: [number, number, number] = [0, 0, 0]
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "bold");
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

  const estimatedHeight = 35 + sale.details.length * LINE_H * 2.2 + 90;

  const doc = new jsPDF({
    unit: "mm",
    format: [TICKET_WIDTH_MM, Math.max(estimatedHeight, 140)],
  });

  let y = 5;

  y = addCentered(doc, y, settings.companyName, 10.5, true, [0, 0, 0]);
  if (settings.rucNit) {
    y = addCentered(doc, y, `NIT/RUC: ${settings.rucNit}`, 7.5, true, [0, 0, 0]);
  }
  if (settings.address) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(settings.address, CONTENT_WIDTH) as string[];
    lines.forEach((line: string) => {
      doc.text(line, TICKET_WIDTH_MM / 2, y, { align: "center" });
      y += LINE_H;
    });
  }
  if (settings.phone) {
    y = addCentered(doc, y, `Tele: ${settings.phone}`, 7.5, true, [0, 0, 0]);
  }

  y += 1;
  y = separator(doc, y, "solid");

  y += 0.5;
  y = addCentered(doc, y, "BOLETA DE VENTA", 8.5, true, [0, 0, 0]);
  y = addCentered(doc, y, saleNum, 8.5, true, [0, 0, 0]);
  y += 0.5;
  y = separator(doc, y, "solid");

  y += 0.5;
  y = addLine(doc, y, "Fecha:", fmtDate(sale.createdAt));
  y = addLine(doc, y, "Cliente:", sale.customerName || "Consumidor Final");
  if (sale.customerNitCi) {
    y = addLine(doc, y, "CI/NIT:", sale.customerNitCi);
  }
  if (sale.customerPhone) {
    y = addLine(doc, y, "Teléfono:", sale.customerPhone);
  }
  y = addLine(doc, y, "Pago:", sale.paymentMethod);
  if (sale.userName) {
    y = addLine(doc, y, "Vendedor:", sale.userName);
  }
  y += 0.5;
  y = separator(doc, y);

  y += 0.5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PRODUCTO", TICKET_MARGIN, y);
  doc.text("CANT", TICKET_MARGIN + 37, y, { align: "right" });
  doc.text("P.U.", TICKET_MARGIN + 52, y, { align: "right" });
  doc.text("TOTAL", TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  y += LINE_H - 0.5;
  y = separator(doc, y);
  y += 0.5;

  sale.details.forEach((item) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);

    const nameLines = doc.splitTextToSize(item.productName, 34) as string[];
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, TICKET_MARGIN, y + i * LINE_H);
    });

    doc.text(String(item.quantity), TICKET_MARGIN + 37, y, { align: "right" });
    doc.text(item.unitPrice.toFixed(2), TICKET_MARGIN + 52, y, { align: "right" });
    doc.text(item.subtotal.toFixed(2), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });

    y += nameLines.length * LINE_H + 0.5;
  });

  y += 0.5;
  y = separator(doc, y);
  y += 0.5;

  y = addLine(doc, y, "Subtotal:", fmtMoney(sale.subtotal, sym));
  y += 0.5;
  y = separator(doc, y, "solid");
  y += 0.5;

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("TOTAL:", TICKET_MARGIN, y);
  doc.text(fmtMoney(sale.total, sym), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  y += LINE_H;

  const isCash = (sale.paymentMethod || "").toLowerCase().includes("efectivo") || sale.amountPaid != null;
  const cashRec = sale.amountPaid !== undefined && sale.amountPaid !== null
    ? Number(sale.amountPaid)
    : (isCash ? Number(sale.total) : null);
  const chgDue = sale.changeDue !== undefined && sale.changeDue !== null
    ? Number(sale.changeDue)
    : 0;

  if (isCash && cashRec !== null) {
    y += 0.5;
    y = addLine(doc, y, "EFECTIVO RECIBIDO:", fmtMoney(cashRec, sym));
    y = addLine(doc, y, "CAMBIO:", fmtMoney(chgDue, sym));
  }
  y += 1;

  if (sale.notes) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    const noteLines = doc.splitTextToSize(`Nota: ${sale.notes}`, CONTENT_WIDTH) as string[];
    noteLines.forEach((line: string) => {
      doc.text(line, TICKET_WIDTH_MM / 2, y, { align: "center" });
      y += LINE_H;
    });
    y += 0.5;
  }

  if (sale.pointsEarned && sale.pointsEarned > 0) {
    y = separator(doc, y, "dash");
    y += 0.5;
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(TICKET_MARGIN, y, CONTENT_WIDTH, 10, 1.5, 1.5, "F");
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.roundedRect(TICKET_MARGIN, y, CONTENT_WIDTH, 10, 1.5, 1.5, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`* PUNTOS GANADOS: +${sale.pointsEarned} pts`, TICKET_WIDTH_MM / 2, y + 4, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(0, 0, 0);
    doc.text("¡Canjealos en tu proxima compra!", TICKET_WIDTH_MM / 2, y + 7.8, { align: "center" });

    y += 11.5;
  }

  y = separator(doc, y, "solid");
  y += 1;

  y = addCentered(doc, y, "¡Gracias por su compra!", 8, true, [0, 0, 0]);
  y = addCentered(doc, y, "Vuelva pronto", 7.5, true, [0, 0, 0]);
  if (settings.email) {
    y += 0.5;
    y = addCentered(doc, y, settings.email, 7, true, [0, 0, 0]);
  }
  y += 4;

  // Ajustar la altura exacta de la pagina al contenido para evitar salto de hoja
  const finalHeight = Math.max(y + 2, 40);
  (doc.internal as any).pageSize.height = finalHeight;
  (doc.internal as any).pageSize.setHeight?.(finalHeight);

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

export function buildThermalHTML(
  sale: SaleForTicket,
  settings: BusinessSettingsForTicket
): string {
  const sym = escHtml(settings.currencySymbol || "Bs");
  const saleNum = `#${String(sale.id).padStart(6, "0")}`;

  const itemRows = sale.details
    .map(
      (d) => `
      <tr>
        <td class="name">${escHtml(d.productName)}</td>
        <td class="num">${d.quantity}</td>
        <td class="num">${d.unitPrice.toFixed(2)}</td>
        <td class="num bold">${d.subtotal.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${saleNum}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      .no-print { display: none !important; }
      html, body {
        background: #fff;
        margin: 0 !important;
        padding: 2mm 3mm 2mm !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
      }
      * {
        page-break-inside: avoid !important;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: bold;
      width: 80mm;
      max-width: 80mm;
      padding: 2mm 3.5mm 3mm;
      color: #000;
      background: #fff;
      line-height: 1.25;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .company {
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.3px;
      margin-bottom: 1mm;
    }
    .sub { font-size: 9.5px; font-weight: bold; text-align: center; color: #000; line-height: 1.3; }
    hr.solid { border: none; border-top: 1.5px solid #000; margin: 1.5mm 0; }
    hr.dash { border: none; border-top: 1.5px dashed #000; margin: 1.2mm 0; }
    .ticket-label {
      font-size: 10.5px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 2px;
      margin: 0.5mm 0;
    }
    .ticket-num {
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      color: #000;
      margin-bottom: 0.5mm;
    }
    .info { font-size: 10px; font-weight: bold; margin: 0.6mm 0; display: flex; justify-content: space-between; gap: 1.5mm; line-height: 1.2; }
    .info .lbl { color: #000; font-weight: bold; white-space: nowrap; }
    .info .val { text-align: right; font-weight: bold; word-break: break-word; color: #000; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      font-weight: bold;
      margin: 0.8mm 0;
    }
    table.items thead th {
      font-weight: bold;
      padding-bottom: 1mm;
      border-bottom: 1.5px solid #000;
      white-space: nowrap;
      color: #000;
    }
    table.items thead th.name { text-align: left; }
    table.items thead th.num { text-align: right; }
    table.items td { padding: 0.6mm 0; vertical-align: top; font-weight: bold; color: #000; }
    table.items td.name { text-align: left; padding-right: 1mm; }
    table.items td.num { text-align: right; white-space: nowrap; }
    .totals { font-size: 10.5px; font-weight: bold; }
    .totals .row { display: flex; justify-content: space-between; padding: 0.5mm 0; font-weight: bold; color: #000; }
    .totals .row.grand {
      font-size: 14px;
      font-weight: bold;
      border-top: 1.5px solid #000;
      padding-top: 1.2mm;
      margin-top: 0.8mm;
    }
    .totals .row.grand .amt { color: #000; }
    .note { font-size: 9.5px; font-weight: bold; color: #000; text-align: center; margin: 1mm 0; }
    .footer { text-align: center; margin-top: 1.5mm; font-weight: bold; }
    .footer .main { font-size: 12px; font-weight: bold; color: #000; }
    .footer .small { font-size: 9px; font-weight: bold; color: #000; margin-top: 0.3mm; }
    .print-btn {
      display: block;
      width: calc(100% - 4mm);
      margin: 3mm auto 0;
      padding: 2.5mm 0;
      background: #4F46E5;
      color: #fff;
      border: none;
      border-radius: 4mm;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      letter-spacing: 0.5px;
    }
    .print-btn:active { background: #4338ca; }
  </style>
</head>
<body>
  <div class="company">${escHtml(settings.companyName)}</div>
  <div class="sub">
    ${settings.address ? `${escHtml(settings.address)}<br>` : ""}
    ${settings.phone ? `Tel: ${escHtml(settings.phone)}<br>` : ""}
    ${settings.email ? `${escHtml(settings.email)}` : ""}
  </div>

  <hr class="solid">

  <div class="ticket-label">BOLETA DE VENTA</div>
  <div class="ticket-num">${saleNum}</div>

  <hr class="solid">

  <div class="info"><span class="lbl">Fecha:</span><span class="val">${escHtml(fmtDate(sale.createdAt))}</span></div>
  <div class="info"><span class="lbl">Cliente:</span><span class="val">${escHtml(sale.customerName || "Consumidor Final")}</span></div>
  ${sale.customerNitCi ? `<div class="info"><span class="lbl">CI/NIT:</span><span class="val">${escHtml(sale.customerNitCi)}</span></div>` : ""}
  ${sale.customerPhone ? `<div class="info"><span class="lbl">Teléfono:</span><span class="val">${escHtml(sale.customerPhone)}</span></div>` : ""}
  <div class="info"><span class="lbl">Pago:</span><span class="val">${escHtml(sale.paymentMethod)}</span></div>
  ${sale.userName ? `<div class="info"><span class="lbl">Vendedor:</span><span class="val">${escHtml(sale.userName)}</span></div>` : ""}

  <hr class="dash">

  <table class="items">
    <thead>
      <tr>
        <th class="name">PRODUCTO</th>
        <th class="num">CANT</th>
        <th class="num">P.U.</th>
        <th class="num">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="dash">

  <div class="totals">
    <div class="row"><span>Subtotal:</span><span>${sym} ${sale.subtotal.toFixed(2)}</span></div>
    <div class="row grand"><span>TOTAL</span><span class="amt">${sym} ${sale.total.toFixed(2)}</span></div>
    ${(() => {
      const isCash = (sale.paymentMethod || "").toLowerCase().includes("efectivo") || sale.amountPaid != null;
      const rec = sale.amountPaid !== undefined && sale.amountPaid !== null ? Number(sale.amountPaid) : (isCash ? Number(sale.total) : null);
      const chg = sale.changeDue !== undefined && sale.changeDue !== null ? Number(sale.changeDue) : 0;
      if (!isCash || rec === null) return "";
      return `
      <div class="row" style="font-weight: 600; margin-top: 2px;"><span>EFECTIVO RECIBIDO:</span><span>${sym} ${rec.toFixed(2)}</span></div>
      <div class="row" style="font-weight: bold; color: #047857;"><span>CAMBIO:</span><span>${sym} ${chg.toFixed(2)}</span></div>
      `;
    })()}
  </div>

  ${sale.notes ? `<hr class="dash"><div class="note">Nota: ${escHtml(sale.notes)}</div>` : ""}

  ${sale.pointsEarned && sale.pointsEarned > 0 ? `
  <div style="margin: 6px 0; padding: 6px 4px; border: 1.5px dashed #000; background: #fff; border-radius: 4px; text-align: center;">
    <div style="font-size: 11px; font-weight: bold; color: #000;">&#9733; PUNTOS GANADOS: +${sale.pointsEarned} pts</div>
    <div style="font-size: 9.5px; font-weight: bold; color: #000; margin-top: 2px;">&iexcl;Canj&eacute;alos por descuentos en tu pr&oacute;xima compra!</div>
  </div>` : ""}

  <hr class="solid">

  <div class="footer">
    <div class="main">¡Gracias por su compra!</div>
    <div class="small">Vuelva pronto</div>
    <div class="small">${escHtml(settings.companyName)} &bull; ${saleNum}</div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">🖨&nbsp; Imprimir Ticket</button>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

export function printTicket(
  sale: SaleForTicket,
  settings: BusinessSettingsForTicket
): void {
  const html = buildThermalHTML(sale, settings);
  const win = window.open("", "_blank", "width=360,height=700,scrollbars=yes");
  if (!win) {
    alert("Permite ventanas emergentes para imprimir el ticket térmico.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
