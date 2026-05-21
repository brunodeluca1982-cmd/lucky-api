/**
 * lucky-concierge/index.ts
 *
 * Lucky — Rio-first concierge AI for The Lucky Trip.
 * Powered ONLY by real Supabase data. Never invents places.
 *
 * Pipeline:
 *  1. Check access_levels for userId (premium gate)
 *  2. Check + increment lucky_usage count (2-question free limit)
 *  3. Route query intent → query relevant Supabase tables
 *  4. Build rich context from real rows only
 *  5. Call Gemini to synthesize a natural concierge response
 *  6. Return { reply, isPremium, questionCount }
 */

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_LIMIT = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role:    "user" | "assistant";
  content: string;
}

interface RequestBody {
  query:       string;
  history?:    Message[];
  deviceId:    string;
  destination?: string;
}

// ── Premium check ─────────────────────────────────────────────────────────────
// SOURCE OF TRUTH: matches exactly what the profile screen uses.
//
// Priority:
//   1. Authenticated user JWT → check app_metadata.plan_type + access_until
//      (written by the Stripe webhook — same source the profile reads).
//   2. Anonymous fallback → check access_levels table by deviceId.
//      (for legacy or device-scoped grants only).
//
// The previous implementation used ONLY path 2 (access_levels by deviceId),
// which never matched because Stripe writes to app_metadata, not access_levels.

async function checkPremium(
  supa:     ReturnType<typeof createClient>,
  jwt:      string,
  deviceId: string,
): Promise<boolean> {
  // ── Path 1: authenticated user — read app_metadata (same as profile screen) ──
  if (jwt) {
    try {
      const { data: { user } } = await supa.auth.getUser(jwt);
      if (user) {
        const meta      = user.app_metadata as Record<string, unknown> | undefined;
        const validPlan = meta?.plan_type === "premium" || meta?.plan_type === "vip";
        // null access_until = lifetime / no expiry — same logic as GuiaContext
        const notExpired = !meta?.access_until
          || new Date(meta.access_until as string) > new Date();
        if (validPlan && notExpired) {
          console.log("[lucky-concierge] premium via app_metadata (auth user)");
          return true;
        }
      }
    } catch (e) {
      console.warn("[lucky-concierge] getUser(jwt) failed:", (e as Error).message);
    }
  }

  // ── Path 2: anonymous / device-based fallback ──
  try {
    const { data } = await supa
      .from("access_levels")
      .select("plan_type, access_until")
      .eq("user_id", deviceId)
      .maybeSingle();

    if (!data) return false;
    const validPlan = data.plan_type === "premium" || data.plan_type === "vip";
    if (!validPlan) return false;
    if (!data.access_until) return false;
    return new Date(data.access_until) > new Date();
  } catch {
    return false;
  }
}

// ── Usage tracking ────────────────────────────────────────────────────────────
// lucky_usage table: device_id TEXT PK, question_count INT, last_question_at TIMESTAMPTZ

async function getQuestionCount(supa: ReturnType<typeof createClient>, deviceId: string): Promise<number> {
  try {
    const { data } = await supa
      .from("lucky_usage")
      .select("question_count")
      .eq("device_id", deviceId)
      .maybeSingle();
    return (data as { question_count: number } | null)?.question_count ?? 0;
  } catch {
    return 0;
  }
}

async function incrementQuestionCount(supa: ReturnType<typeof createClient>, deviceId: string): Promise<number> {
  try {
    const current = await getQuestionCount(supa, deviceId);
    const next = current + 1;
    await supa
      .from("lucky_usage")
      .upsert(
        {
          device_id:        deviceId,
          question_count:   next,
          last_question_at: new Date().toISOString(),
          updated_at:       new Date().toISOString(),
        },
        { onConflict: "device_id" },
      );
    return next;
  } catch {
    return 1;
  }
}

// ── Intent routing ────────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<string, string[]> = {
  restaurants: [
    "restaurante","comer","gastronomia","comida","jantar","almoço","almoco",
    "café","cafe","bar","drink","drinks","pizza","sushi","frutos","mariscos",
    "churrasco","brunch","café da manhã","lanche","refeição","culinária","bistrô",
    "fine dining","vinho","cerveja","prato","cardápio","menu","onde comer",
  ],
  activities: [
    "fazer","atividade","visitar","conhecer","passeio","atração","atrações","tour",
    "museu","trilha","parque","praia","surf","mergulho","show","teatro","galeria",
    "compras","shopping","esporte","aventura","natureza","mirante","vista","pôr do sol",
    "cultura","história","arte","festa","carnaval","lapa","forró","samba","balada",
    "o que fazer","hoje","fim de semana","amigos","criança","família",
  ],
  hotels: [
    "hotel","hospedagem","ficar","dormir","hospedar","pousada","resort","suite",
    "quarto","acomodação","check-in","check in","accommodation","lodging","onde ficar",
  ],
  neighborhoods: [
    "bairro","região","zona","área","melhor bairro","onde fica","localização",
    "ipanema","copacabana","leblon","botafogo","santa teresa","lapa","centro",
    "tijuca","barra","recreio","urca","flamengo","lagoa","jardim botânico",
  ],
  lucky_picks: [
    "dica","dicas","segredo","segredos","exclusivo","curadores","curadoria",
    "lucky","list","picks","especial","escondido","pouco conhecido","desconhecido",
    "jóia","descoberta","insider","local","diferente","fora do comum",
  ],
};

function detectIntent(query: string): Set<string> {
  const q = query.toLowerCase();
  const intents = new Set<string>();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intents.add(intent);
    }
  }

  // Default: show activities + lucky picks if nothing detected
  if (intents.size === 0) {
    intents.add("activities");
    intents.add("lucky_picks");
  }

  return intents;
}

// ── Supabase data fetching ────────────────────────────────────────────────────
// Each fetch uses ONLY real curated columns. No invented data.

async function fetchRestaurants(supa: ReturnType<typeof createClient>) {
  const { data } = await supa
    .from("restaurantes")
    .select("id, nome, bairro, categoria, meu_olhar, vibe")
    .limit(25);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:        String(r.id),
    name:      r.nome,
    bairro:    r.bairro,
    categoria: "restaurante",
    meu_olhar: r.meu_olhar,
    vibe:      r.vibe,
  }));
}

async function fetchActivities(supa: ReturnType<typeof createClient>) {
  const { data } = await supa
    .from("o_que_fazer_rio_v2")
    .select("id, nome, bairro, categoria, meu_olhar, vibe, momento_ideal")
    .eq("ativo", true)
    .limit(30);
  return (data ?? []).map((a: Record<string, unknown>) => ({
    id:        String(a.id),
    name:      a.nome,
    bairro:    a.bairro,
    categoria: a.categoria ?? "atividade",
    meu_olhar: a.meu_olhar,
    vibe:      a.vibe,
    momento:   a.momento_ideal,
  }));
}

async function fetchHotels(supa: ReturnType<typeof createClient>) {
  const { data } = await supa
    .from("stay_hotels")
    .select("id, hotel_name, neighborhood_slug, hotel_category, my_view, how_to_enjoy, audience")
    .limit(15);
  return (data ?? []).map((h: Record<string, unknown>) => ({
    id:        String(h.id),
    name:      h.hotel_name,
    bairro:    h.neighborhood_slug,
    categoria: "hotel",
    tipo:      h.hotel_category,
    my_view:   h.my_view,
    how_to_enjoy: h.how_to_enjoy,
    audience:  h.audience,
  }));
}

async function fetchNeighborhoods(supa: ReturnType<typeof createClient>) {
  const { data } = await supa
    .from("stay_neighborhoods")
    .select("neighborhood_name, my_view, how_to_live, walkable, nightlife, gastronomy, scenery, safety_solo_woman, better_for")
    .limit(15);
  return (data ?? []).map((n: Record<string, unknown>) => ({
    name:       n.neighborhood_name,
    my_view:    n.my_view,
    how_to_live: n.how_to_live,
    gastronomy: n.gastronomy,
    nightlife:  n.nightlife,
    scenery:    n.scenery,
    walkable:   n.walkable,
    safety_solo: n.safety_solo_woman,
    better_for:  n.better_for,
  }));
}

async function fetchLuckyPicks(supa: ReturnType<typeof createClient>) {
  const { data } = await supa
    .from("lucky_list_rio_v2")
    .select("id, nome, bairro, tipo_item, meu_olhar, destaque_lucky")
    .eq("ativo", true)
    .limit(20);
  return (data ?? []).map((l: Record<string, unknown>) => ({
    id:        String(l.id),
    name:      l.nome,
    bairro:    l.bairro,
    categoria: l.tipo_item ?? "lucky",
    meu_olhar: l.meu_olhar,
    destaque:  l.destaque_lucky,
  }));
}

// ── AI Provider: Gemini (primary) + OpenAI (adapter fallback) ────────────────
//
// Primary:  Gemini 2.0 Flash — uses GEMINI_API_KEY
// Fallback: OpenAI GPT-4o-mini — uses OPENAI_API_KEY (only if GEMINI_API_KEY absent)
//
// To switch providers in the future: change callAI() — all call sites stay the same.

async function callGemini(
  apiKey:       string,
  systemPrompt: string,
  allMessages:  Message[],
): Promise<string> {
  const history = allMessages.slice(0, -1);
  const lastMsg = allMessages[allMessages.length - 1]?.content ?? "";

  const contents = [
    ...history.map((m) => ({
      role:  m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: lastMsg }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.65, maxOutputTokens: 600 },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("[lucky-concierge] Gemini API error:", res.status, errText);
    throw new Error(`Gemini error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    console.error("[lucky-concierge] Gemini returned empty text. Response:", JSON.stringify(data).slice(0, 300));
  }
  return text;
}

async function callOpenAIFallback(
  apiKey:       string,
  systemPrompt: string,
  allMessages:  Message[],
): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    ...allMessages.map((m) => ({
      role:    m.role === "user" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.65, max_tokens: 600 }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAI(systemPrompt: string, allMessages: Message[]): Promise<string> {
  const geminiKey  = Deno.env.get("GEMINI_API_KEY");
  const openAiKey  = Deno.env.get("OPENAI_API_KEY");

  if (geminiKey) {
    console.log("[lucky-concierge] provider: Gemini 2.5 Flash");
    return await callGemini(geminiKey, systemPrompt, allMessages);
  }

  if (openAiKey) {
    console.log("[lucky-concierge] provider: OpenAI GPT-4o-mini (fallback — set GEMINI_API_KEY to switch to Gemini)");
    return await callOpenAIFallback(openAiKey, systemPrompt, allMessages);
  }

  throw new Error("No AI provider configured: set GEMINI_API_KEY (preferred) or OPENAI_API_KEY");
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { query, history = [], deviceId, destination = "Rio de Janeiro" } = body;

    if (!query || !deviceId) {
      return new Response(
        JSON.stringify({ error: "query and deviceId are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // Reject questions about destinations other than Rio
    const lowerQuery = query.toLowerCase();
    const otherCityKeywords = [
      "paris","tokyo","tóquio","madrid","barcelona","nova york","new york",
      "miami","londra","london","dubai","bali","santorini","kyoto","lisboa",
      "buenos aires","florianópolis","florianopolis","gramado","paraty","ilhabela",
    ];
    const isNonRio = otherCityKeywords.some((c) => lowerQuery.includes(c)) &&
      !lowerQuery.includes("rio");

    if (isNonRio) {
      const reply =
        "Ainda sou especialista só no Rio de Janeiro nesta versão do app. " +
        "Em breve expandiremos para outros destinos — por enquanto, me pergunte " +
        "sobre o Rio e posso te guiar com muita precisão.";
      return new Response(
        JSON.stringify({ reply, isPremium: false, questionCount: 0, limitReached: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    console.log("[lucky-concierge] REQUEST:", { deviceId, destination, queryLength: query.length });

    const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supaUrl || !supaKey) {
      console.error("[lucky-concierge] Missing Supabase env vars:", { supaUrl: !!supaUrl, supaKey: !!supaKey });
    }

    const supa = createClient(supaUrl, supaKey);

    // ── 1. Premium check — extract JWT from Authorization header ──
    // Frontend sends the user's session token (not the anon key) when logged in,
    // so the backend can verify premium via app_metadata — same source as the profile.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const isPremium = await checkPremium(supa, jwt, deviceId);
    console.log("[lucky-concierge] isPremium:", isPremium);

    // ── 2. Usage gate (server-side enforcement) ──
    const currentCount = await getQuestionCount(supa, deviceId);
    console.log("[lucky-concierge] questionCount:", currentCount, "/ limit:", FREE_LIMIT);

    if (!isPremium && currentCount >= FREE_LIMIT) {
      console.log("[lucky-concierge] GATE: limit reached — returning 402");
      return new Response(
        JSON.stringify({
          reply:         null,
          isPremium:     false,
          questionCount: currentCount,
          limitReached:  true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 },
      );
    }

    // ── 3. Intent routing + Supabase data fetch ──
    const intents = detectIntent(query);
    console.log("[lucky-concierge] intents:", [...intents]);
    const contextParts: string[] = [];

    if (intents.has("restaurants")) {
      const rows = await fetchRestaurants(supa);
      console.log("[lucky-concierge] restaurantes rows:", rows.length);
      if (rows.length) {
        contextParts.push(
          "RESTAURANTES DA CURADORIA (use apenas estes, nunca invente):\n" +
          rows.map((r) =>
            `- ${r.name} (${r.bairro}): ${r.meu_olhar ?? r.vibe ?? ""}`.trim()
          ).join("\n"),
        );
      }
    }

    if (intents.has("activities")) {
      const rows = await fetchActivities(supa);
      console.log("[lucky-concierge] o_que_fazer_rio rows:", rows.length);
      if (rows.length) {
        contextParts.push(
          "O QUE FAZER NO RIO (use apenas estes):\n" +
          rows.map((a) =>
            `- ${a.name} (${a.bairro}): ${a.meu_olhar ?? a.vibe ?? ""}. Momento: ${Array.isArray(a.momento) ? a.momento.join(", ") : (a.momento ?? "")}`.trim()
          ).join("\n"),
        );
      }
    }

    if (intents.has("hotels")) {
      const rows = await fetchHotels(supa);
      console.log("[lucky-concierge] stay_hotels rows:", rows.length);
      if (rows.length) {
        contextParts.push(
          "ONDE FICAR NO RIO (use apenas estes):\n" +
          rows.map((h) =>
            `- ${h.name} (${h.bairro}): ${h.tipo ?? "hotel"}. ${h.my_view ?? ""}. Para: ${h.audience ?? ""}`.trim()
          ).join("\n"),
        );
      }
    }

    if (intents.has("neighborhoods")) {
      const rows = await fetchNeighborhoods(supa);
      console.log("[lucky-concierge] stay_neighborhoods rows:", rows.length);
      if (rows.length) {
        contextParts.push(
          "BAIRROS DO RIO:\n" +
          rows.map((n) =>
            `- ${n.name}: ${n.my_view ?? ""}. Gastronomia: ${n.gastronomy ?? ""}/5, noite: ${n.nightlife ?? ""}/5, cenário: ${n.scenery ?? ""}/5, caminhável: ${n.walkable ? "sim" : "não"}. ${n.better_for ?? ""}`.trim()
          ).join("\n"),
        );
      }
    }

    if (intents.has("lucky_picks")) {
      const rows = await fetchLuckyPicks(supa);
      console.log("[lucky-concierge] lucky_list_rio rows:", rows.length);
      if (rows.length) {
        contextParts.push(
          "LUCKY PICKS — SELEÇÃO EXCLUSIVA (use apenas estes):\n" +
          rows.map((l) =>
            `- ${l.name} (${l.bairro}): ${l.meu_olhar ?? l.destaque ?? ""}`.trim()
          ).join("\n"),
        );
      }
    }

    const noData = contextParts.length === 0;
    console.log("[lucky-concierge] contextParts:", contextParts.length, "noData:", noData);

    const systemPrompt =
`Você é o Lucky, concierge pessoal do app The Lucky Trip — guia editorial premium do Rio de Janeiro.

REGRAS ABSOLUTAS:
- Responda APENAS usando os lugares listados nos dados abaixo. Nunca invente lugares.
- Se os dados não contiverem o que o usuário pediu, diga isso com naturalidade.
- Tom: concierge local, editorial, direto. Não genérico. Não ChatGPT.
- Máximo 220 palavras. Prefira 2-4 recomendações com detalhe real.
- Nunca use "claro!", "ótima pergunta!", disclaimers, ou linguagem de chatbot.
- Use a voz do campo meu_olhar se disponível — é a voz editorial da curadoria.
- Seja específico: mencione bairros, momentos, para quem é cada lugar.
- Responda em português brasileiro.
- Para questões fora do Rio, diga naturalmente que só cobre o Rio nesta versão.

${noData
  ? "Sem dados encontrados. Diga ao usuário que você não tem informações disponíveis para essa consulta agora."
  : "DADOS REAIS DA CURADORIA — USE APENAS ESTES:\n" + contextParts.join("\n\n")}`;

    const allMessages: Message[] = [
      ...history.slice(-6),
      { role: "user", content: query },
    ];

    console.log("[lucky-concierge] Calling AI provider...");
    const answer = await callAI(systemPrompt, allMessages);
    console.log("[lucky-concierge] AI answered:", answer.length > 0, "chars:", answer.length);

    if (!answer.trim()) {
      throw new Error("Empty response from AI — model returned no text");
    }

    // ── 4. Increment count AFTER successful answer ──
    const newCount = await incrementQuestionCount(supa, deviceId);
    console.log("[lucky-concierge] SUCCESS — newCount:", newCount);

    return new Response(
      JSON.stringify({
        reply:         answer.trim(),
        isPremium,
        questionCount: newCount,
        limitReached:  false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const errMsg = (err as Error).message ?? "unknown error";
    console.error("[lucky-concierge] UNHANDLED ERROR:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
