import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatIDR, formatDate, statusColor, statusLabel } from "@/lib/format";

interface LineItem { description: string; quantity: number; unit_price: number; }

const Invoices = () => {
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const load = async () => {
    const [{ data: invs }, { data: cls }] = await Promise.all([
      supabase.from("invoices").select("*, client:clients(name, company)").order("created_at", { ascending: false }),
      supabase.from("clients").select("*").order("name"),
    ]);
    setItems(invs ?? []); setClients(cls ?? []);
  };
  useEffect(() => { load(); }, []);

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
  const tax = Math.round(subtotal * Number(taxRate || 0) / 100);
  const total = subtotal + tax;

  const create = async () => {
    if (!clientId) { toast.error("Pilih client"); return; }
    const validLines = lines.filter((l) => l.description.trim() && l.quantity > 0);
    if (validLines.length === 0) { toast.error("Tambahkan minimal 1 item"); return; }

    const { data: inv, error } = await supabase.from("invoices").insert({
      client_id: clientId, issue_date: issueDate, due_date: dueDate,
      tax_rate: taxRate, notes: notes || null, status: "sent",
    }).select("id").single();
    if (error || !inv) { toast.error(error?.message || "Gagal"); return; }

    const { error: itemsErr } = await supabase.from("invoice_items").insert(
      validLines.map((l, i) => ({ invoice_id: inv.id, description: l.description.trim(), quantity: l.quantity, unit_price: l.unit_price, position: i }))
    );
    if (itemsErr) { toast.error(itemsErr.message); return; }
    toast.success("Invoice dibuat");
    setOpen(false); setLines([{ description: "", quantity: 1, unit_price: 0 }]); setClientId(""); setNotes(""); setTaxRate(0);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus invoice & semua pembayarannya?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} invoices</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" />Invoice Baru</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Buat Invoice</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3"><Label>Client *</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue placeholder="Pilih client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Tanggal</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
                <div><Label>Jatuh Tempo</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                <div><Label>Pajak (%)</Label><Input type="number" min={0} value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
              </div>

              <div className="space-y-2">
                <Label>Items</Label>
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" placeholder="Deskripsi" value={l.description} onChange={(e) => { const n = [...lines]; n[i].description = e.target.value; setLines(n); }} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={l.quantity} onChange={(e) => { const n = [...lines]; n[i].quantity = Number(e.target.value); setLines(n); }} />
                    <Input className="col-span-3" type="number" placeholder="Harga" value={l.unit_price} onChange={(e) => { const n = [...lines]; n[i].unit_price = Number(e.target.value); setLines(n); }} />
                    <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLines([...lines, { description: "", quantity: 1, unit_price: 0 }])}><Plus className="w-3 h-3 mr-1" />Item</Button>
              </div>

              <div className="bg-accent/40 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Pajak ({taxRate}%)</span><span>{formatIDR(tax)}</span></div>
                <div className="flex justify-between font-semibold text-base pt-1 border-t border-border"><span>Total</span><span>{formatIDR(total)}</span></div>
              </div>

              <div><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Buat Invoice</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-12 text-center"><FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Belum ada invoice.</p></div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-accent/30">
                <Link to={`/invoices/${inv.id}`} className="flex-1">
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{inv.client?.name} • {formatDate(inv.issue_date)} → {formatDate(inv.due_date)}</p>
                </Link>
                <div className="text-right mr-3">
                  <p className="font-semibold">{formatIDR(inv.total)}</p>
                  <p className="text-xs text-muted-foreground">Dibayar: {formatIDR(inv.paid_amount)}</p>
                </div>
                <Badge className={`${statusColor[inv.status]} border-0 mr-2`}>{statusLabel[inv.status]}</Badge>
                <Button variant="ghost" size="icon" onClick={() => remove(inv.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
};

export default Invoices;