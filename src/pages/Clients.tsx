import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1, "Nama wajib").max(120),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("Email tidak valid").max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
});

const Clients = () => {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", address: "" });

  const load = async () => {
    const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ name: "", company: "", email: "", phone: "", address: "" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ name: c.name, company: c.company ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "" }); setOpen(true); };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const payload = { name: form.name.trim(), company: form.company || null, email: form.email || null, phone: form.phone || null, address: form.address || null };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Client diperbarui" : "Client ditambahkan");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus client ini?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dihapus"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} clients</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Tambah Client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Client" : "Client Baru"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nama *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Perusahaan</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Alamat</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Simpan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-12 text-center text-muted-foreground text-sm">Belum ada client.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 hover:bg-accent/30">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.company || "—"} • {c.email || "no email"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
};

export default Clients;