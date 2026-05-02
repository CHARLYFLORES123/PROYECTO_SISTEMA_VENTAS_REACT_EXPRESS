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

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const estimatedHeight = 50 + sale.details.length * LINE_H * 1.5 + 60;

  const doc = new jsPDF({
    unit: "mm",
    format: [TICKET_WIDTH_MM, Math.max(estimatedHeight, 100)],
  });

  let y = 8;

  y = addCentered(doc, y, settings.companyName, 11, true);
  if (settings.rucNit) {
    y = addCentered(doc, y, `NIT/RUC: ${settings.rucNit}`, 7.5);
  }
  if (settings.address) {
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

  y += 1;
  y = addCentered(doc, y, "BOLETA DE VENTA", 9, true);
  y = addCentered(doc, y, saleNum, 9, true, [79, 70, 229]);
  y += 1;
  y = separator(doc, y, "solid");

  y += 1;
  y = addLine(doc, y, "Fecha:", fmtDate(sale.createdAt));
  y = addLine(doc, y, "Cliente:", sale.customerName || "Consumidor Final");
  y = addLine(doc, y, "Pago:", sale.paymentMethod);
  if (sale.userName) {
    y = addLine(doc, y, "Vendedor:", sale.userName);
  }
  y += 1;
  y = separator(doc, y);

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

  sale.details.forEach((item) => {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);

    const nameLines = doc.splitTextToSize(item.productName, 34) as string[];
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, TICKET_MARGIN, y + i * LINE_H);
    });

    doc.text(String(item.quantity), TICKET_MARGIN + 37, y, { align: "right" });
    doc.text(item.unitPrice.toFixed(2), TICKET_MARGIN + 52, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(item.subtotal.toFixed(2), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });

    y += nameLines.length * LINE_H + 0.5;
  });

  y += 1;
  y = separator(doc, y);
  y += 1;

  y = addLine(doc, y, "Subtotal:", fmtMoney(sale.subtotal, sym));
  y = addLine(doc, y, "IVA (13%):", fmtMoney(sale.iva, sym));
  y += 1;
  y = separator(doc, y, "solid");
  y += 1;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL:", TICKET_MARGIN, y);
  doc.setTextColor(79, 70, 229);
  doc.text(fmtMoney(sale.total, sym), TICKET_WIDTH_MM - TICKET_MARGIN, y, { align: "right" });
  y += LINE_H + 2;

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

  y = addCentered(doc, y, "¡Gracias por su compra!", 8, true);
  y = addCentered(doc, y, "Vuelva pronto", 7.5, false, [100, 116, 139]);
  if (settings.email) {
    y += 1;
    y = addCentered(doc, y, settings.email, 7, false, [100, 116, 139]);
  }
  y += 3;

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
      html, body { background: #fff; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11.5px;
      width: 80mm;
      max-width: 80mm;
      padding: 4mm 5mm 6mm;
      color: #111;
      background: #fff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .company {
      font-size: 15px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.5px;
      margin-bottom: 1.5mm;
    }
    .sub { font-size: 9.5px; text-align: center; color: #444; line-height: 1.5; }
    hr.solid { border: none; border-top: 1px solid #111; margin: 2.5mm 0; }
    hr.dash { border: none; border-top: 1px dashed #777; margin: 2mm 0; }
    .ticket-label {
      font-size: 11px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 3px;
      margin: 1mm 0;
    }
    .ticket-num {
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      color: #4F46E5;
      margin-bottom: 1mm;
    }
    .info { font-size: 10px; margin: 1mm 0; display: flex; justify-content: space-between; gap: 2mm; }
    .info .lbl { color: #555; white-space: nowrap; }
    .info .val { text-align: right; word-break: break-word; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin: 1mm 0;
    }
    table.items thead th {
      font-weight: bold;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid #111;
      white-space: nowrap;
    }
    table.items thead th.name { text-align: left; }
    table.items thead th.num { text-align: right; }
    table.items td { padding: 1mm 0; vertical-align: top; }
    table.items td.name { text-align: left; padding-right: 1mm; }
    table.items td.num { text-align: right; white-space: nowrap; }
    .totals { font-size: 10.5px; }
    .totals .row { display: flex; justify-content: space-between; padding: 0.8mm 0; }
    .totals .row.grand {
      font-size: 15px;
      font-weight: bold;
      border-top: 1.5px solid #111;
      padding-top: 2mm;
      margin-top: 1mm;
    }
    .totals .row.grand .amt { color: #4F46E5; }
    .note { font-size: 9.5px; font-style: italic; color: #555; text-align: center; margin: 1.5mm 0; }
    .footer { text-align: center; margin-top: 3mm; }
    .footer .main { font-size: 12.5px; font-weight: bold; }
    .footer .small { font-size: 9px; color: #555; margin-top: 0.5mm; }
    .print-btn {
      display: block;
      width: calc(100% - 4mm);
      margin: 5mm auto 0;
      padding: 3mm 0;
      background: #4F46E5;
      color: #fff;
      border: none;
      border-radius: 4mm;
      font-size: 13px;
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
    ${settings.rucNit ? `NIT/RUC: ${escHtml(settings.rucNit)}<br>` : ""}
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
    <div class="row"><span>IVA (13%):</span><span>${sym} ${sale.iva.toFixed(2)}</span></div>
    <div class="row grand"><span>TOTAL</span><span class="amt">${sym} ${sale.total.toFixed(2)}</span></div>
  </div>

  ${sale.notes ? `<hr class="dash"><div class="note">Nota: ${escHtml(sale.notes)}</div>` : ""}

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
