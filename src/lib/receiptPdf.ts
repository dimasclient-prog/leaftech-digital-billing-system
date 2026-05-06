import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatIDR, formatDate, methodLabel } from "./format";

interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  method: string;
  amount: number;
  notes?: string | null;
  invoice: {
    invoice_number: string;
    total: number;
    paid_amount: number;
    status: string;
    client: { name: string; company?: string | null; email?: string | null };
  };
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

export function generateReceiptPdf(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(34, 156, 96);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("KUITANSI PEMBAYARAN", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Payment Receipt", 14, 21);

  doc.setFontSize(11);
  doc.text(data.agency.name, W - 14, 14, { align: "right" });
  doc.setFontSize(9);
  if (data.agency.email) doc.text(data.agency.email, W - 14, 20, { align: "right" });
  if (data.agency.phone) doc.text(data.agency.phone, W - 14, 25, { align: "right" });

  // Receipt info
  doc.setTextColor(40);
  let y = 44;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("No. Kuitansi:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.receipt_number, 45, y);

  doc.setFont("helvetica", "bold");
  doc.text("Tanggal:", W - 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.payment_date), W - 14, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Invoice:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoice.invoice_number, 45, y);

  doc.setFont("helvetica", "bold");
  doc.text("Metode:", W - 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(methodLabel[data.method] ?? data.method, W - 14, y, { align: "right" });

  // Diterima dari
  y += 12;
  doc.setFillColor(240, 250, 244);
  doc.roundedRect(14, y, W - 28, 22, 3, 3, "F");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("Diterima dari", 18, y + 6);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(data.invoice.client.name, 18, y + 13);
  if (data.invoice.client.company) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(data.invoice.client.company, 18, y + 19);
  }

  // Amount box
  y += 30;
  doc.setFillColor(34, 156, 96);
  doc.roundedRect(14, y, W - 28, 24, 3, 3, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.text("Jumlah Dibayar", 18, y + 8);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(formatIDR(data.amount), W - 18, y + 16, { align: "right" });

  // Reconciliation table
  y += 32;
  const remaining = Number(data.invoice.total) - Number(data.invoice.paid_amount);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Rekonsiliasi", "Nilai"]],
    body: [
      ["Total Invoice", formatIDR(data.invoice.total)],
      ["Total Dibayar", formatIDR(data.invoice.paid_amount)],
      ["Sisa Tagihan", formatIDR(Math.max(0, remaining))],
      ["Status", data.invoice.status === "paid" ? "LUNAS" : data.invoice.status === "partially_paid" ? "DIBAYAR SEBAGIAN" : data.invoice.status.toUpperCase()],
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [240, 250, 244], textColor: 40, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error lastAutoTable injected by autotable
  let cursorY = doc.lastAutoTable.finalY + 10;

  if (data.notes) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Catatan:", 14, cursorY);
    doc.setTextColor(40);
    doc.text(doc.splitTextToSize(data.notes, W - 28), 14, cursorY + 5);
    cursorY += 18;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setDrawColor(220);
  doc.line(14, footerY, W - 14, footerY);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(data.agency.receipt_footer || "Terima kasih atas pembayaran Anda.", 14, footerY + 6);
  if (data.agency.bank_name) {
    doc.text(
      `${data.agency.bank_name} • ${data.agency.bank_account_number ?? ""} • a/n ${data.agency.bank_account_name ?? ""}`,
      14,
      footerY + 12,
    );
  }
  doc.setFontSize(8);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")}`, W - 14, footerY + 12, { align: "right" });

  return doc;
}