const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  to: string;
  clientName: string;
  receiptNumber: string;
  invoiceNumber: string;
  amount: number;
  agencyName: string;
  pdfBase64: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.to || !body?.receiptNumber || !body?.pdfBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(body.amount);

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a1a1a">
        <div style="background:linear-gradient(135deg,#229c60,#2bb574);color:#fff;padding:24px;border-radius:12px 12px 0 0">
          <h2 style="margin:0">Kuitansi Pembayaran</h2>
          <p style="margin:4px 0 0;opacity:.9">${body.agencyName}</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 12px 12px">
          <p>Halo <b>${body.clientName}</b>,</p>
          <p>Terima kasih, kami telah menerima pembayaran Anda. Berikut detailnya:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:6px 0;color:#666">No. Kuitansi</td><td style="text-align:right;font-weight:600">${body.receiptNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Invoice</td><td style="text-align:right;font-weight:600">${body.invoiceNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Jumlah</td><td style="text-align:right;font-weight:700;color:#229c60;font-size:18px">${idr}</td></tr>
          </table>
          <p style="font-size:13px;color:#666">Kuitansi resmi dalam format PDF terlampir di email ini.</p>
          <p style="margin-top:24px">Salam,<br/><b>${body.agencyName}</b></p>
        </div>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${body.agencyName} <onboarding@resend.dev>`,
        to: [body.to],
        subject: `Kuitansi ${body.receiptNumber} - ${body.invoiceNumber}`,
        html,
        attachments: [{ filename: `${body.receiptNumber}.pdf`, content: body.pdfBase64 }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ error: data?.message || "Resend failed", details: data }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});