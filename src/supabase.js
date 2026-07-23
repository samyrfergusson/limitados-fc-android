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
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, ...data };
}

// Confere se o e-mail logado está na tabela de admins (diretoria).
export async function isAdminEmail(email) {
  if (!email) return false;
  const { data } = await supabase
    .from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return !!data;
}
