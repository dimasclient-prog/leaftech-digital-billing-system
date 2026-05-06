import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIDR, formatDate, statusLabel } from "./format";

interface InvoiceData {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
    paid_amount: number;
    status: string;
    notes?: string | null;
    client: {
      name: string;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
    };
  };
  items: Array<{ description: string; quantity: number; unit_price: number; amount: number }>;
  agency: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_name?: string | null;
    receipt_footer?: string | null;
  };
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(34, 156, 96);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("INVOICE", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Tagihan", 14, 21);

  doc.setFontSize(11);
  doc.text(data.agency.name, W - 14, 14, { align: "right" });
  doc.setFontSize(9);
  if (data.agency.email) doc.text(data.agency.email, W - 14, 20, { align: "right" });
  if (data.agency.phone) doc.text(data.agency.phone, W - 14, 25, { align: "right" });

  doc.setTextColor(40);
  let y = 44;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("No. Invoice:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoice.invoice_number, 45, y);

  doc.setFont("helvetica", "bold");
  doc.text("Tanggal:", W - 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.invoice.issue_date), W - 14, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Status:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text((statusLabel[data.invoice.status] ?? data.invoice.status).toString(), 45, y);

  doc.setFont("helvetica", "bold");
  doc.text("Jatuh Tempo:", W - 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.invoice.due_date), W - 14, y, { align: "right" });

  // Bill to
  y += 12;
  doc.setFillColor(240, 250, 244);
  doc.roundedRect(14, y, W - 28, 28, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Ditagihkan kepada", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(data.invoice.client.name, 18, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const meta: string[] = [];
  if (data.invoice.client.company) meta.push(data.invoice.client.company);
  if (data.invoice.client.email) meta.push(data.invoice.client.email);
  if (data.invoice.client.phone) meta.push(data.invoice.client.phone);
  if (meta.length) doc.text(meta.join(" • "), 18, y + 19);
  if (data.invoice.client.address) doc.text(data.invoice.client.address, 18, y + 25);

  // Items table
  y += 36;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Deskripsi", "Qty", "Harga", "Jumlah"]],
    body: data.items.map((it) => [
      it.description,
      String(Number(it.quantity)),
      formatIDR(it.unit_price),
      formatIDR(it.amount),
    ]),
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [34, 156, 96], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "right", cellWidth: 20 },
      2: { halign: "right", cellWidth: 40 },
      3: { halign: "right", cellWidth: 40, fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error lastAutoTable injected by autotable
  let cursorY = doc.lastAutoTable.finalY + 6;

  // Totals
  const remaining = Math.max(0, Number(data.invoice.total) - Number(data.invoice.paid_amount));
  const rows: Array<[string, string]> = [
    ["Subtotal", formatIDR(data.invoice.subtotal)],
    [`Pajak (${data.invoice.tax_rate}%)`, formatIDR(data.invoice.tax_amount)],
    ["Total", formatIDR(data.invoice.total)],
    ["Dibayar", formatIDR(data.invoice.paid_amount)],
    ["Sisa Tagihan", formatIDR(remaining)],
  ];
  const boxX = W - 94;
  doc.setFontSize(10);
  rows.forEach(([label, val], i) => {
    const isTotal = label === "Total";
    const isRem = label === "Sisa Tagihan";
    if (isTotal || isRem) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.setTextColor(isRem ? 34 : 40, isRem ? 156 : 40, isRem ? 96 : 40);
    doc.text(label, boxX, cursorY + i * 6);
    doc.text(val, W - 14, cursorY + i * 6, { align: "right" });
  });
  cursorY += rows.length * 6 + 6;

  if (data.invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Catatan:", 14, cursorY);
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(data.invoice.notes, W - 28), 14, cursorY + 5);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setDrawColor(220);
  doc.line(14, footerY, W - 14, footerY);
  doc.setFontSize(9);
  doc.setTextColor(100);
  if (data.agency.bank_name) {
    doc.text(
      `Pembayaran: ${data.agency.bank_name} • ${data.agency.bank_account_number ?? ""} • a/n ${data.agency.bank_account_name ?? ""}`,
      14,
      footerY + 6,
    );
  }
  doc.text(data.agency.receipt_footer || "Terima kasih atas kepercayaan Anda.", 14, footerY + 12);
  doc.setFontSize(8);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, W - 14, footerY + 12, { align: "right" });

  return doc;
}