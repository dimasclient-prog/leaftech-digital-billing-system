import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, FileDown } from "lucide-react";
import { generateInvoicePdf } from "@/lib/invoicePdf";
import { generateReceiptPdf } from "@/lib/receiptPdf";

const Settings = () => {
  const [s, setS] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("agency_settings").select("*").limit(1).single();
    setS(data);
  })(); }, []);

  const save = async () => {
    if (!s?.id) return;
    const { error } = await supabase.from("agency_settings").update({
      name: s.name, email: s.email, phone: s.phone, address: s.address,
      bank_name: s.bank_name, bank_account_number: s.bank_account_number, bank_account_name: s.bank_account_name,
      receipt_footer: s.receipt_footer,
      logo_url: s.logo_url,
      brand_color: s.brand_color,
      invoice_header_label: s.invoice_header_label,
      receipt_header_label: s.receipt_header_label,
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Branding tersimpan");
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("agency-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("agency-assets").getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updErr } = await supabase.from("agency_settings").update({ logo_url: url }).eq("id", s.id);
      if (updErr) throw updErr;
      setS({ ...s, logo_url: url });
      toast.success("Logo terunggah");
    } catch (e: any) {
      toast.error(e.message ?? "Gagal upload");
    } finally { setUploading(false); }
  };

  const removeLogo = async () => {
    const { error } = await supabase.from("agency_settings").update({ logo_url: null }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setS({ ...s, logo_url: null });
    toast.success("Logo dihapus");
  };

  const previewInvoice = () => {
    const doc = generateInvoicePdf({
      invoice: {
        invoice_number: "INV-PREVIEW-0001", issue_date: new Date().toISOString().slice(0,10),
        due_date: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
        subtotal: 5000000, tax_rate: 11, tax_amount: 550000, total: 5550000, paid_amount: 0,
        status: "sent", notes: "Contoh catatan invoice.",
        client: { name: "PT Contoh Client", company: "Contoh Co.", email: "client@contoh.com", phone: "0812-0000-0000", address: "Jl. Contoh No. 1, Jakarta" },
      },
      items: [
        { description: "Jasa Digital Marketing — Bulan Berjalan", quantity: 1, unit_price: 4000000, amount: 4000000 },
        { description: "Iklan Meta Ads (Service Fee)", quantity: 1, unit_price: 1000000, amount: 1000000 },
      ],
      agency: s,
    });
    window.open(doc.output("bloburl"), "_blank");
  };

  const previewReceipt = () => {
    const doc = generateReceiptPdf({
      receipt_number: "RCP-PREVIEW-0001", payment_date: new Date().toISOString().slice(0,10),
      method: "bank_transfer", amount: 2750000, notes: "Contoh kuitansi.",
      invoice: { invoice_number: "INV-PREVIEW-0001", total: 5550000, paid_amount: 2750000, status: "partially_paid",
        client: { name: "PT Contoh Client", company: "Contoh Co.", email: "client@contoh.com" } },
      agency: s,
    });
    window.open(doc.output("bloburl"), "_blank");
  };

  if (!s) return <div className="text-sm text-muted-foreground">Memuat...</div>;

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="text-base">Branding Agency (untuk kuitansi)</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-4 rounded-lg border border-border p-3">
          <div className="w-20 h-20 rounded bg-accent/40 flex items-center justify-center overflow-hidden">
            {s.logo_url ? <img src={s.logo_url} alt="Logo" className="object-contain w-full h-full" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <div className="flex-1">
            <Label>Logo Agency</Label>
            <p className="text-xs text-muted-foreground">PNG/JPG. Akan tampil di pojok kanan atas invoice & kuitansi.</p>
            <div className="flex gap-2 mt-2">
              <label>
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <Button asChild size="sm" variant="outline" disabled={uploading}><span><Upload className="w-4 h-4 mr-1" />{uploading ? "Mengunggah..." : "Upload Logo"}</span></Button>
              </label>
              {s.logo_url && <Button size="sm" variant="ghost" onClick={removeLogo}><Trash2 className="w-4 h-4 mr-1 text-destructive" />Hapus</Button>}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Nama Agency</Label><Input value={s.name ?? ""} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={s.email ?? ""} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
          <div><Label>Telepon</Label><Input value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} /></div>
          <div><Label>Alamat</Label><Input value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></div>
          <div><Label>Bank</Label><Input value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} /></div>
          <div><Label>No. Rekening</Label><Input value={s.bank_account_number ?? ""} onChange={(e) => setS({ ...s, bank_account_number: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Atas Nama</Label><Input value={s.bank_account_name ?? ""} onChange={(e) => setS({ ...s, bank_account_name: e.target.value })} /></div>
        </div>

        <div className="grid md:grid-cols-3 gap-3 pt-2 border-t border-border">
          <div>
            <Label>Warna Brand</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" className="w-14 h-10 p-1" value={s.brand_color ?? "#229c60"} onChange={(e) => setS({ ...s, brand_color: e.target.value })} />
              <Input value={s.brand_color ?? "#229c60"} onChange={(e) => setS({ ...s, brand_color: e.target.value })} />
            </div>
          </div>
          <div><Label>Judul Header Invoice</Label><Input value={s.invoice_header_label ?? "INVOICE"} onChange={(e) => setS({ ...s, invoice_header_label: e.target.value })} /></div>
          <div><Label>Judul Header Kuitansi</Label><Input value={s.receipt_header_label ?? "KUITANSI PEMBAYARAN"} onChange={(e) => setS({ ...s, receipt_header_label: e.target.value })} /></div>
        </div>

        <div><Label>Footer Kuitansi</Label><Textarea value={s.receipt_footer ?? ""} onChange={(e) => setS({ ...s, receipt_footer: e.target.value })} /></div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save}>Simpan</Button>
          <Button variant="outline" onClick={previewInvoice}><FileDown className="w-4 h-4 mr-1" />Preview Invoice</Button>
          <Button variant="outline" onClick={previewReceipt}><FileDown className="w-4 h-4 mr-1" />Preview Kuitansi</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

export default Settings;