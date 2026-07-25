// Edge Function: criar-cobranca
// Gera uma cobranca PIX no Mercado Pago para um jogador.
// - Jogador comum: gera SO a propria cobranca (identificado pelo e-mail do login).
// - Admin: pode gerar de qualquer jogador (passando { playerId }).
// O Access Token do MP fica em secret (MP_ACCESS_TOKEN), nunca no app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const MP = Deno.env.get("MP_ACCESS_TOKEN");
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!MP) return json({ error: "MP_ACCESS_TOKEN nao configurado" }, 500);

    // Quem chamou? (valida o JWT do login)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    const email = u?.user?.email?.toLowerCase();
    if (!email) return json({ error: "nao autenticado" }, 401);

    const admin = createClient(URL_, SERVICE);
    const { data: grupoRow } = await admin.from("grupo").select("dados").eq("id", 1).maybeSingle();
    const dados: any = grupoRow?.dados ?? {};
    const players: any[] = dados.players ?? [];

    const body = await req.json().catch(() => ({} as any));
    const { data: adminRow } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
    const isAdmin = !!adminRow;

    // Jogador alvo: admin pode escolher; senao, o proprio (pelo e-mail)
    const target = (body.playerId && isAdmin)
      ? players.find((p) => p.id === body.playerId)
      : players.find((p) => (p.email ?? "").toLowerCase() === email);
    if (!target) return json({ error: "jogador nao encontrado" }, 404);

    // Valor devido = mensalidade (se nao paga) + multas em aberto
    const competencia = body.competencia ?? new Date().toISOString().slice(0, 7); // YYYY-MM
    const mensalidade = Number(dados.club?.mensalidade ?? 0);
    const jaPago = (dados.payments?.[target.id]?.[competencia]) === "pago";
    const multas = (dados.multas ?? []).filter((m: any) => m.playerId === target.id && !m.pago);
    let valor = 0;
    if (target.mensalista && !jaPago) valor += mensalidade;
    valor += multas.reduce((s: number, m: any) => s + (Number(m.valor) || 0), 0);
    if (valor <= 0) return json({ error: "nada a pagar neste mes" }, 400);

    const externalRef = `${target.id}|${competencia}`;
    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Number(valor.toFixed(2)),
        description: `Limitados F.C - ${target.apelido} - ${competencia}`,
        payment_method_id: "pix",
        payer: { email: target.email ?? email },
        external_reference: externalRef,
        notification_url: `${URL_}/functions/v1/mp-webhook`,
      }),
    });
    const mp = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP erro:", JSON.stringify(mp));
      const det = mp.message ?? mp.error ?? mpResp.status;
      const cause = Array.isArray(mp.cause) && mp.cause[0]?.description ? " — " + mp.cause[0].description : "";
      return json({ error: "Mercado Pago: " + det + cause }, 502);
    }

    const tx = mp.point_of_interaction?.transaction_data;
    await admin.from("cobrancas").upsert({
      payment_id: String(mp.id),
      player_id: target.id,
      competencia,
      valor,
      external_reference: externalRef,
      status: mp.status,
    });

    return json({
      payment_id: mp.id,
      status: mp.status,
      valor,
      qr_code: tx?.qr_code,               // copia-e-cola
      qr_code_base64: tx?.qr_code_base64, // imagem do QR (base64)
      ticket_url: tx?.ticket_url,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
