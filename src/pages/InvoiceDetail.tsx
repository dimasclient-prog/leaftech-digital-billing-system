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
import { Plus, Download, Mail, Trash2, ArrowLeft, Receipt, Pencil, Repeat } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatIDR, formatDate, statusColor, statusLabel, methodLabel } from "@/lib/format";
import { generateReceiptPdf } from "@/lib/receiptPdf";
import { generateInvoicePdf } from "@/lib/invoicePdf";

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [agency, setAgency] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payment_date: new Date().toISOString().slice(0, 10), method: "bank_transfer", amount: 0, notes: "" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editInvOpen, setEditInvOpen] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editPay, setEditPay] = useState<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: inv }, { data: its }, { data: pays }, { data: ag }, { data: cls }] = await Promise.all([
      supabase.from("invoices").select("*, client:clients(*)").eq("id", id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position"),
      supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false }),
      supabase.from("agency_settings").select("*").limit(1).single(),
      supabase.from("clients").select("*").order("name"),
    ]);
    setInvoice(inv); setItems(its ?? []); setPayments(pays ?? []); setAgency(ag); setClients(cls ?? []);
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

  const downloadInvoice = () => {
    if (!invoice) return;
    const doc = generateInvoicePdf({
      invoice: {
        invoice_number: invoice.invoice_number,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal: Number(invoice.subtotal),
        tax_rate: Number(invoice.tax_rate),
        tax_amount: Number(invoice.tax_amount),
        total: Number(invoice.total),
        paid_amount: Number(invoice.paid_amount),
        status: invoice.status,
        notes: invoice.notes,
        client: invoice.client,
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        amount: Number(it.amount),
      })),
      agency: agency ?? { name: "My Agency" },
    });
    doc.save(`${invoice.invoice_number}.pdf`);
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

  const openEditInvoice = () => {
    setEditInv({
      client_id: invoice.client_id,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      tax_rate: Number(invoice.tax_rate),
      notes: invoice.notes ?? "",
      status: invoice.status,
      is_recurring: !!invoice.is_recurring,
      recurring_active: !!invoice.recurring_active,
      recurring_day: invoice.recurring_day ?? 1,
      items: items.map((it) => ({ id: it.id, description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price) })),
    });
    setEditInvOpen(true);
  };

  const saveInvoice = async () => {
    if (!editInv) return;
    if (!editInv.client_id) { toast.error("Pilih client"); return; }
    const valid = (editInv.items as any[]).filter((l) => l.description.trim() && l.quantity > 0);
    if (valid.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("invoices").update({
        client_id: editInv.client_id,
        issue_date: editInv.issue_date,
        due_date: editInv.due_date,
        tax_rate: editInv.tax_rate,
        notes: editInv.notes || null,
        status: editInv.status,
        is_recurring: editInv.is_recurring,
        recurring_active: editInv.is_recurring ? editInv.recurring_active : false,
        recurring_day: editInv.is_recurring ? editInv.recurring_day : null,
      }).eq("id", invoice.id);
      if (error) throw error;

      // Replace items
      await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
      const { error: e2 } = await supabase.from("invoice_items").insert(
        valid.map((l, i) => ({ invoice_id: invoice.id, description: l.description.trim(), quantity: l.quantity, unit_price: l.unit_price, position: i }))
      );
      if (e2) throw e2;
      toast.success("Invoice diperbarui");
      setEditInvOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally { setBusy(false); }
  };

  const openEditPayment = (p: any) => {
    setEditPay({
      id: p.id,
      payment_date: p.payment_date,
      method: p.method,
      amount: Number(p.amount),
      notes: p.notes ?? "",
    });
    setEditPayOpen(true);
  };

  const savePayment = async () => {
    if (!editPay) return;
    if (editPay.amount <= 0) { toast.error("Jumlah harus > 0"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("payments").update({
        payment_date: editPay.payment_date,
        method: editPay.method,
        amount: editPay.amount,
        notes: editPay.notes || null,
      }).eq("id", editPay.id);
      if (error) throw error;
      toast.success("Pembayaran diperbarui");
      setEditPayOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal menyimpan");
    } finally { setBusy(false); }
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
              <Button size="sm" variant="outline" className="mt-2" onClick={downloadInvoice}><Download className="w-4 h-4 mr-1" />Download Invoice PDF</Button>
              <Button size="sm" variant="outline" className="mt-2 ml-2" onClick={openEditInvoice}><Pencil className="w-4 h-4 mr-1" />Edit Invoice</Button>
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
                    <Button variant="ghost" size="sm" onClick={() => openEditPayment(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deletePayment(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editInvOpen} onOpenChange={setEditInvOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Invoice</DialogTitle></DialogHeader>
          {editInv && (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3"><Label>Client *</Label>
                  <Select value={editInv.client_id} onValueChange={(v) => setEditInv({ ...editInv, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tanggal</Label><Input type="date" value={editInv.issue_date} onChange={(e) => setEditInv({ ...editInv, issue_date: e.target.value })} /></div>
                <div><Label>Jatuh Tempo</Label><Input type="date" value={editInv.due_date} onChange={(e) => setEditInv({ ...editInv, due_date: e.target.value })} /></div>
                <div><Label>Pajak (%)</Label><Input type="number" min={0} value={editInv.tax_rate} onChange={(e) => setEditInv({ ...editInv, tax_rate: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                {editInv.items.map((l: any, i: number) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" placeholder="Deskripsi" value={l.description} onChange={(e) => { const n = [...editInv.items]; n[i].description = e.target.value; setEditInv({ ...editInv, items: n }); }} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.quantity} onChange={(e) => { const n = [...editInv.items]; n[i].quantity = Number(e.target.value); setEditInv({ ...editInv, items: n }); }} />
                    <Input className="col-span-3" type="number" placeholder="Harga" value={l.unit_price} onChange={(e) => { const n = [...editInv.items]; n[i].unit_price = Number(e.target.value); setEditInv({ ...editInv, items: n }); }} />
                    <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setEditInv({ ...editInv, items: editInv.items.filter((_: any, idx: number) => idx !== i) })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setEditInv({ ...editInv, items: [...editInv.items, { description: "", quantity: 1, unit_price: 0 }] })}><Plus className="w-3 h-3 mr-1" />Item</Button>
              </div>

              {(() => {
                const sub = (editInv.items as any[]).reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
                const tx = Math.round(sub * Number(editInv.tax_rate || 0) / 100);
                return (
                  <div className="bg-accent/40 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(sub)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Pajak ({editInv.tax_rate}%)</span><span>{formatIDR(tx)}</span></div>
                    <div className="flex justify-between font-semibold text-base pt-1 border-t border-border"><span>Total</span><span>{formatIDR(sub + tx)}</span></div>
                  </div>
                );
              })()}

              <div><Label>Catatan</Label><Textarea value={editInv.notes} onChange={(e) => setEditInv({ ...editInv, notes: e.target.value })} /></div>

              <div>
                <Label>Status</Label>
                <Select value={editInv.status} onValueChange={(v) => setEditInv({ ...editInv, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Status akan direkonsiliasi otomatis berdasarkan total pembayaran.</p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-primary" />
                    <div>
                      <Label className="cursor-pointer">Invoice Berulang Tiap Bulan</Label>
                      <p className="text-xs text-muted-foreground">Sistem akan otomatis membuat invoice baru setiap bulan.</p>
                    </div>
                  </div>
                  <Switch checked={editInv.is_recurring} onCheckedChange={(v) => setEditInv({ ...editInv, is_recurring: v, recurring_active: v })} />
                </div>
                {editInv.is_recurring && (
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <Label>Tanggal Generate (1–31)</Label>
                    <Input type="number" min={1} max={31} value={editInv.recurring_day} onChange={(e) => setEditInv({ ...editInv, recurring_day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
                    <p className="col-span-2 text-xs text-muted-foreground">Jika bulan tidak memiliki tanggal tersebut (mis. 31 Feb), akan digunakan tanggal terakhir bulan itu.</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={saveInvoice} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editPayOpen} onOpenChange={setEditPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Pembayaran</DialogTitle></DialogHeader>
          {editPay && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tanggal</Label><Input type="date" value={editPay.payment_date} onChange={(e) => setEditPay({ ...editPay, payment_date: e.target.value })} /></div>
                <div><Label>Metode</Label>
                  <Select value={editPay.method} onValueChange={(v) => setEditPay({ ...editPay, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(methodLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Jumlah</Label><Input type="number" min={1} value={editPay.amount} onChange={(e) => setEditPay({ ...editPay, amount: Number(e.target.value) })} /></div>
              <div><Label>Catatan</Label><Textarea value={editPay.notes} onChange={(e) => setEditPay({ ...editPay, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={savePayment} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceDetail;