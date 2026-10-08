import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfCell = string | number;

interface ExportTablePdfOptions {
  title: string;
  fileName: string;
  headers: string[];
  rows: PdfCell[][];
  subtitle?: string;
}

export function exportTablePDF({
  title,
  fileName,
  headers,
  rows,
  subtitle,
}: ExportTablePdfOptions) {
  const doc = new jsPDF({
    orientation: headers.length > 6 ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const subtitleLines = doc.splitTextToSize(
    subtitle || `Generado: ${new Date().toLocaleString("es-BO")}`,
    pageWidth - 28,
  );
  doc.text(subtitleLines, 14, 22);
  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? "-"))),
    startY: 22 + subtitleLines.length * 4 + 2,
    margin: { left: 14, right: 14, bottom: 14 },
    styles: { font: "helvetica", fontSize: headers.length > 7 ? 6 : 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 7,
        { align: "right" },
      );
      doc.setTextColor(0);
    },
  });
  doc.save(fileName);
}
