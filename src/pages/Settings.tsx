import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const [s, setS] = useState<any>(null);

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
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Branding tersimpan");
  };

  if (!s) return <div className="text-sm text-muted-foreground">Memuat...</div>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Branding Agency (untuk kuitansi)</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Nama Agency</Label><Input value={s.name ?? ""} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={s.email ?? ""} onChange={(e) => setS({ ...s, email: e.target.value })} /></div>
          <div><Label>Telepon</Label><Input value={s.phone ?? ""} onChange={(e) => setS({ ...s, phone: e.target.value })} /></div>
          <div><Label>Alamat</Label><Input value={s.address ?? ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></div>
          <div><Label>Bank</Label><Input value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} /></div>
          <div><Label>No. Rekening</Label><Input value={s.bank_account_number ?? ""} onChange={(e) => setS({ ...s, bank_account_number: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Atas Nama</Label><Input value={s.bank_account_name ?? ""} onChange={(e) => setS({ ...s, bank_account_name: e.target.value })} /></div>
        </div>
        <div><Label>Footer Kuitansi</Label><Textarea value={s.receipt_footer ?? ""} onChange={(e) => setS({ ...s, receipt_footer: e.target.value })} /></div>
        <Button onClick={save} className="w-fit">Simpan</Button>
      </CardContent>
    </Card>
  );
};

export default Settings;