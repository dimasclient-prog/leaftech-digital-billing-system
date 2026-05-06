import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Mail, Trash2, ArrowLeft, Receipt } from "lucide-react";
import { formatIDR, formatDate, statusColor, statusLabel, methodLabel } from "@/lib/format";
import { generateReceiptPdf } from "@/lib/receiptPdf";

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [agency, setAgency] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payment_date: new Date().toISOString().slice(0, 10), method: "bank_transfer", amount: 0, notes: "" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: inv }, { data: its }, { data: pays }, { data: ag }] = await Promise.all([
      supabase.from("invoices").select("*, client:clients(*)").eq("id", id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
      supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false }),
      supabase.from("agency_settings").select("*").limit(1).single(),
    ]);
    setInvoice(inv); setItems(its ?? []); setPayments(pays ?? []); setAgency(ag);
    setForm((f) => ({ ...f, amount: inv ? Math.max(0, Number(inv.total) - Number(inv.paid_amount)) : 0 }));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addPayment = async () => {
    if (!invoice) return;
    if (form.amount <= 0) { toast.error("Jumlah harus > 0"); return; }
    setBusy(true);
    try {
      let proof_path: string | null = null;
      if (proofFile) {
        const path = `${invoice.id}/${Date.now()}-${proofFile.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile);
        if (upErr) throw upErr;
        proof_path = path;
      }
      const { data: pay, error } = await supabase.from("payments").insert({
        receipt_number: "", // auto-generated
        invoice_id: invoice.id,
        payment_date: form.payment_date,
        method: form.method as any,
        amount: form.amount,
        notes: form.notes || null,
        proof_path,
      }).select("*").single();
      if (error) throw error;
      toast.success(`Kuitansi ${pay.receipt_number} dibuat`);
      setOpen(false); setProofFile(null); setForm({ ...form, notes: "" });
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal mencatat pembayaran");
    } finally { setBusy(false); }
  };

  const buildPdf = (pay: any) => generateReceiptPdf({
    receipt_number: pay.receipt_number,
    payment_date: pay.payment_date,
    method: pay.method,
    amount: Number(pay.amount),
    notes: pay.notes,
    invoice: {
      invoice_number: invoice.invoice_number,
      total: Number(invoice.total),
      paid_amount: Number(invoice.paid_amount),
      status: invoice.status,
      client: invoice.client,
    },
    agency: agency ?? { name: "My Agency" },
  });

  const downloadReceipt = (pay: any) => {
    const doc = buildPdf(pay);
    doc.save(`${pay.receipt_number}.pdf`);
  };

  const emailReceipt = async (pay: any) => {
    if (!invoice.client?.email) { toast.error("Client tidak memiliki email"); return; }
    const doc = buildPdf(pay);
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    toast.loading("Mengirim email...", { id: "em" });
    const { data, error } = await supabase.functions.invoke("send-receipt-email", {
      body: {
        to: invoice.client.email,
        clientName: invoice.client.name,
        receiptNumber: pay.receipt_number,
        invoiceNumber: invoice.invoice_number,
        amount: Number(pay.amount),
        agencyName: agency?.name ?? "Agency",
        pdfBase64,
      },
    });
    toast.dismiss("em");
    if (error || (data && data.error)) { toast.error((error?.message) || data?.error || "Gagal kirim"); return; }
    await supabase.from("payments").update({ emailed_at: new Date().toISOString() }).eq("id", pay.id);
    toast.success("Kuitansi terkirim");
    load();
  };

  const deletePayment = async (pid: string) => {
    if (!confirm("Hapus pembayaran ini? Status invoice akan otomatis dihitung ulang.")) return;
    const { error } = await supabase.from("payments").delete().eq("id", pid);
    if (error) { toast.error(error.message); return; }
    toast.success("Dihapus, invoice direkonsiliasi"); load();
  };

  const downloadProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Gagal membuka file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!invoice) return <div className="text-sm text-muted-foreground">Memuat...</div>;

  const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid_amount));

  return (
    <div className="space-y-4">
      <Link to="/invoices" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" />Kembali</Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Invoice</p>
              <h2 className="text-2xl font-bold">{invoice.invoice_number}</h2>
              <Badge className={`${statusColor[invoice.status]} border-0 mt-2`}>{statusLabel[invoice.status]}</Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{formatIDR(invoice.total)}</p>
              <p className="text-xs text-muted-foreground mt-1">Dibayar {formatIDR(invoice.paid_amount)} • Sisa <span className="font-semibold text-foreground">{formatIDR(remaining)}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
            <div><p className="text-muted-foreground">Client</p><p className="font-medium">{invoice.client?.name}</p></div>
            <div><p className="text-muted-foreground">Perusahaan</p><p className="font-medium">{invoice.client?.company || "—"}</p></div>
            <div><p className="text-muted-foreground">Tanggal</p><p className="font-medium">{formatDate(invoice.issue_date)}</p></div>
            <div><p className="text-muted-foreground">Jatuh Tempo</p><p className="font-medium">{formatDate(invoice.due_date)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rincian Item</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-2">Deskripsi</th><th className="text-right">Qty</th><th className="text-right">Harga</th><th className="text-right">Jumlah</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-border/50">
                  <td className="py-2">{it.description}</td>
                  <td className="text-right">{Number(it.quantity)}</td>
                  <td className="text-right">{formatIDR(it.unit_price)}</td>
                  <td className="text-right font-medium">{formatIDR(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={3} className="text-right pt-3 text-muted-foreground">Subtotal</td><td className="text-right pt-3">{formatIDR(invoice.subtotal)}</td></tr>
              <tr><td colSpan={3} className="text-right text-muted-foreground">Pajak ({invoice.tax_rate}%)</td><td className="text-right">{formatIDR(invoice.tax_amount)}</td></tr>
              <tr><td colSpan={3} className="text-right font-semibold pt-2 border-t border-border">Total</td><td className="text-right font-semibold pt-2 border-t border-border">{formatIDR(invoice.total)}</td></tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" />Histori Pembayaran ({payments.length})</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" disabled={remaining <= 0}><Plus className="w-4 h-4 mr-1" />Catat Pembayaran</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Pembayaran Baru</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tanggal</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} /></div>
                  <div><Label>Metode</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(methodLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Jumlah (Sisa: {formatIDR(remaining)})</Label><Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                <div><Label>Bukti Transfer</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} /></div>
                <div><Label>Catatan</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={addPayment} disabled={busy}>{busy ? "Menyimpan..." : "Simpan & Buat Kuitansi"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Belum ada pembayaran.</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium">{p.receipt_number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.payment_date)} • {methodLabel[p.method]}{p.emailed_at && " • ✓ email terkirim"}</p>
                  </div>
                  <p className="font-semibold">{formatIDR(p.amount)}</p>
                  <div className="flex gap-1">
                    {p.proof_path && <Button variant="ghost" size="sm" onClick={() => downloadProof(p.proof_path)}>Bukti</Button>}
                    <Button variant="ghost" size="sm" onClick={() => downloadReceipt(p)}><Download className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => emailReceipt(p)}><Mail className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deletePayment(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceDetail;