// Edge Function: mp-webhook
// O Mercado Pago chama esta URL quando um pagamento muda de status.
// Se o pagamento foi aprovado, marca o jogador como "pago", quita as multas
// e lanca a entrada no caixa — tudo idempotente (nao aplica duas vezes).
// Deve ser publicada com --no-verify-jwt (o MP nao manda JWT do Supabase).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const MP = Deno.env.get("MP_ACCESS_TOKEN")!;
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // O MP manda o id via query (?id=&topic=payment) ou no corpo { data: { id } }
    const url = new URL(req.url);
    let paymentId = url.searchParams.get("id") ?? url.searchParams.get("data.id");
    if (!paymentId) {
      const body = await req.json().catch(() => ({} as any));
      paymentId = body?.data?.id ?? body?.id ?? null;
    }
    if (!paymentId) return new Response("sem id", { status: 200 });

    // Confirma o pagamento consultando o MP (nao confia so no aviso)
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP}` },
    });
    const pay = await r.json();
    if (!r.ok) return new Response("mp erro", { status: 200 }); // 200 evita reenvio infinito

    const admin = createClient(URL_, SERVICE);
    const status = pay.status; // approved | pending | rejected | ...
    await admin.from("cobrancas").update({ status }).eq("payment_id", String(paymentId));

    if (status !== "approved") return new Response("ok", { status: 200 });

    // Idempotencia: se ja aplicamos, sai
    const { data: cob } = await admin.from("cobrancas").select("applied,external_reference")
      .eq("payment_id", String(paymentId)).maybeSingle();
    if (cob?.applied) return new Response("ja aplicado", { status: 200 });

    const externalRef: string = cob?.external_reference ?? pay.external_reference ?? "";
    const [playerId, competencia] = externalRef.split("|");
    if (!playerId) return new Response("sem referencia", { status: 200 });

    const { data: grupoRow } = await admin.from("grupo").select("dados").eq("id", 1).maybeSingle();
    const dados: any = grupoRow?.dados ?? {};
    const payments = { ...(dados.payments ?? {}) };
    payments[playerId] = { ...(payments[playerId] ?? {}), [competencia]: "pago" };
    const multas = (dados.multas ?? []).map((m: any) =>
      (m.playerId === playerId && !m.pago) ? { ...m, pago: true } : m);
    const lancamentos = [
      { id: crypto.randomUUID(), data: new Date().toISOString().slice(0, 10),
        desc: `PIX recebido (${competencia})`, tipo: "receita", valor: Number(pay.transaction_amount) },
      ...(dados.lancamentos ?? []),
    ];
    const caixa = Number(dados.club?.caixa ?? 0) + Number(pay.transaction_amount);
    const novo = { ...dados, payments, multas, lancamentos, club: { ...(dados.club ?? {}), caixa } };

    await admin.from("grupo").update({ dados: novo, updated_at: new Date().toISOString() }).eq("id", 1);
    await admin.from("cobrancas").update({ applied: true }).eq("payment_id", String(paymentId));

    return new Response("ok", { status: 200 });
  } catch (_e) {
    return new Response("erro", { status: 200 });
  }
});
