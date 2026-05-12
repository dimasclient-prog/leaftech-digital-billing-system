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
    logo_url?: string | null;
    brand_color?: string | null;
    invoice_header_label?: string | null;
  };
}

function hexToRgb(hex?: string | null): [number, number, number] {
  const fallback: [number, number, number] = [34, 156, 96];
  if (!hex) return fallback;
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function generateInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const [br, bg, bb] = hexToRgb(data.agency.brand_color);

  // Header band
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 32, "F");

  // Logo (top-left)
  let infoX = 14;
  if (data.agency.logo_url) {
    try {
      const ext = (data.agency.logo_url.split(".").pop() || "PNG").toUpperCase();
      const fmt = ext === "JPG" ? "JPEG" : ext;
      doc.addImage(data.agency.logo_url, fmt, 10, 4, 22, 22);
      infoX = 36;
    } catch {
      // ignore
    }
  }

  // Agency info (top-left, beside logo)
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.agency.name, infoX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let infoY = 15;
  if (data.agency.email) {
    doc.text(data.agency.email, infoX, infoY);
    infoY += 5;
  }
  if (data.agency.phone) {
    doc.text(data.agency.phone, infoX, infoY);
  }

  // Invoice title (centered)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text((data.agency.invoice_header_label || "INVOICE").toUpperCase(), W / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Tagihan", W / 2, 21, { align: "center" });

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
  doc.setFillColor(Math.min(255, br + 200), Math.min(255, bg + 100), Math.min(255, bb + 150));
  doc.roundedRect(14, y, W - 28, 44, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Ditagihkan kepada", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  const title = data.invoice.client.company || data.invoice.client.name;
  doc.text(title, 18, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let by = y + 19;
  if (data.invoice.client.address) {
    doc.text(data.invoice.client.address, 18, by);
    by += 6;
  }
  if (data.invoice.client.company && data.invoice.client.name) {
    by += 1;
    doc.setFont("helvetica", "bold");
    doc.text(`up : Bpk/Ibu ${data.invoice.client.name}`, 18, by);
    doc.setFont("helvetica", "normal");
    by += 5;
  }
  if (data.invoice.client.email) {
    doc.text(data.invoice.client.email, 18, by);
    by += 5;
  }
  if (data.invoice.client.phone) {
    doc.text(data.invoice.client.phone, 18, by);
    by += 5;
  }

  // Items table
  y += 52;
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
    headStyles: { fillColor: [br, bg, bb], textColor: 255, fontStyle: "bold" },
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
    if (isRem) doc.setTextColor(br, bg, bb); else doc.setTextColor(40, 40, 40);
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