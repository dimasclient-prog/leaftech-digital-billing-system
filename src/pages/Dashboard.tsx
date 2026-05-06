import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import { FileText, Coins, Wallet, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { statusColor, statusLabel, formatDate } from "@/lib/format";

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, outstanding: 0, paidThisMonth: 0, overdue: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: invoices } = await supabase.from("invoices").select("id, invoice_number, total, paid_amount, status, issue_date, due_date, client:clients(name, company)").order("created_at", { ascending: false });
      if (!invoices) return;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: pays } = await supabase.from("payments").select("amount, payment_date").gte("payment_date", monthStart.toISOString().slice(0, 10));
      const total = invoices.reduce((s, i) => s + Number(i.total), 0);
      const outstanding = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0);
      const paidThisMonth = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const overdue = invoices.filter((i) => i.status !== "paid" && new Date(i.due_date) < now).length;
      setStats({ total: invoices.length, outstanding, paidThisMonth, overdue });
      setRecent(invoices.slice(0, 6));
    })();
  }, []);

  const cards = [
    { label: "Total Invoice", value: stats.total, icon: FileText, tint: "bg-primary/10 text-primary" },
    { label: "Outstanding", value: formatIDR(stats.outstanding), icon: Coins, tint: "bg-warning/15 text-warning" },
    { label: "Diterima Bulan Ini", value: formatIDR(stats.paidThisMonth), icon: Wallet, tint: "bg-success/15 text-success" },
    { label: "Jatuh Tempo", value: stats.overdue, icon: AlertTriangle, tint: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 md:p-8" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Overview keuangan agency Anda</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Setiap pembayaran otomatis menghasilkan kuitansi dan merekonsiliasi status invoice.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {cards.map((c) => (
            <div key={c.label} className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
              <div className={`w-10 h-10 rounded-xl grid place-items-center ${c.tint}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">{c.label}</p>
              <p className="text-xl md:text-2xl font-bold mt-1 tracking-tight">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada invoice. Buat invoice pertama Anda di halaman Invoices.</p>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((inv) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between py-3 hover:bg-accent/40 -mx-2 px-2 rounded-lg transition-colors">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.client?.name} • {formatDate(inv.issue_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatIDR(inv.total)}</p>
                    <Badge className={`${statusColor[inv.status]} mt-1 border-0`}>{statusLabel[inv.status]}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;