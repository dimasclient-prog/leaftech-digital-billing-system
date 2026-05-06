import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatIDR, formatDate, methodLabel } from "@/lib/format";
import { Receipt } from "lucide-react";

const Payments = () => {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("payments").select("*, invoice:invoices(invoice_number, client:clients(name))").order("payment_date", { ascending: false });
    setItems(data ?? []);
  })(); }, []);

  return (
    <Card><CardContent className="p-0">
      {items.length === 0 ? (
        <div className="p-12 text-center"><Receipt className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">Belum ada pembayaran.</p></div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((p) => (
            <Link key={p.id} to={`/invoices/${p.invoice_id}`} className="flex items-center justify-between p-4 hover:bg-accent/30">
              <div>
                <p className="font-medium">{p.receipt_number}</p>
                <p className="text-xs text-muted-foreground">{p.invoice?.invoice_number} • {p.invoice?.client?.name} • {formatDate(p.payment_date)} • {methodLabel[p.method]}</p>
              </div>
              <p className="font-semibold">{formatIDR(p.amount)}</p>
            </Link>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
};

export default Payments;