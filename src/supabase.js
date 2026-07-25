import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Todo o app vive num único registro (id = 1) da tabela "grupo",
// na coluna JSON "dados". Isso mantém a migração praticamente sem refatoração.
const ROW_ID = 1;

// Lê o documento do grupo. Retorna o objeto de dados ou null.
export async function fetchData() {
  const { data, error } = await supabase
    .from("grupo").select("dados").eq("id", ROW_ID).maybeSingle();
  if (error) { console.error("Supabase fetch:", error.message); return null; }
  return data ? data.dados : null;
}

// Grava o documento inteiro. Só funciona para admins (bloqueado pelo RLS).
export async function pushData(dados) {
  const { error } = await supabase
    .from("grupo")
    .update({ dados, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID);
  if (error) { console.error("Supabase save (sem permissão?):", error.message); return false; }
  return true;
}

// Escuta mudanças em tempo real e chama onChange(novosDados) quando alguém salva.
export function subscribeData(onChange) {
  const ch = supabase
    .channel("grupo-realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "grupo", filter: `id=eq.${ROW_ID}` },
      (payload) => { if (payload.new && payload.new.dados) onChange(payload.new.dados); }
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// Auto-cadastro do jogador na 1ª vez. Chama a função do banco (RPC), que
// roda com privilégio elevado mas VALIDA no servidor: força o e-mail do
// próprio login e recusa se já houver cadastro. Depois disso, só admin edita.
export async function selfRegister(player) {
  const { error } = await supabase.rpc("self_register_player", { payload: player });
  if (error) { console.error("Auto-cadastro:", error.message); return { ok: false, error: error.message }; }
  return { ok: true };
}

// Gera uma cobrança PIX (Mercado Pago) via Edge Function. Jogador comum gera a
// própria; admin pode passar { playerId } para gerar de qualquer um.
// Retorna { ok, qr_code, qr_code_base64, valor, payment_id } ou { ok:false, error }.
export async function criarCobrancaPix(opts = {}) {
  const { data, error } = await supabase.functions.invoke("criar-cobranca", { body: opts });
  if (error) {
    // Extrai a mensagem real do corpo da resposta (não só "non-2xx status")
    let msg = error.message || "falha ao gerar cobrança";
    try { const body = await error.context?.json?.(); if (body?.error) msg = body.error; } catch { /* corpo não-JSON */ }
    return { ok: false, error: msg };
  }
  if (data?.error) return { ok: false, error: data.error };
  if (!data?.qr_code) return { ok: false, error: "Mercado Pago não retornou o código PIX" };
  return { ok: true, ...data };
}

// Jogador ajusta o próprio X1 (drible) UMA vez. A função no banco valida o
// e-mail do login e recusa se já foi ajustado antes.
export async function setMyX1(valor) {
  const { error } = await supabase.rpc("set_my_x1", { valor });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Confere se o e-mail logado está na tabela de admins (diretoria).
export async function isAdminEmail(email) {
  if (!email) return false;
  const { data } = await supabase
    .from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}

// Confere se o e-mail logado é o PRESIDENTE (admins.role = 'presidente').
export async function isPresidentEmail(email) {
  if (!email) return false;
  const { data } = await supabase
    .from("admins").select("role").eq("email", email.toLowerCase()).maybeSingle();
  return data?.role === "presidente";
}

// Presidente promove/remove a "Estrela da Patota" de um jogador. A função no
// banco valida que o chamador é o presidente (nem outros admins conseguem).
export async function setEstrela(playerId, estrela) {
  const { error } = await supabase.rpc("set_estrela", { player_id: playerId, estrela });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
