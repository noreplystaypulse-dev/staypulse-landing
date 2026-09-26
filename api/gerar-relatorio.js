// api/gerar-relatorio.js
// Función serverless de Vercel. La API key vive SOLO acá (variable de entorno).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // --- 1. Autenticación simple ---
  const senhaEnviada = req.headers["x-admin-password"];
  if (senhaEnviada !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { resenhas } = req.body;
  if (!Array.isArray(resenhas) || resenhas.length === 0) {
    return res.status(400).json({ error: "Envíe un array 'resenhas' no vacío" });
  }

  // --- 2. Métricas cuantitativas ---
  const total = resenhas.length;
  const positivas = resenhas.filter((r) => r.estrellas >= 4);
  const negativas = resenhas.filter((r) => r.estrellas <= 2);
  const respondidas = resenhas.filter((r) => r.respondida === true);
  const sinResponder = total - respondidas.length;
  const listaQuejas = negativas.map((r) => r.comentario);

  // --- 3. Prompt Consultivo, Ejecutivo y Comercial ---
  const prompt = `
Atue como um Consultor Executivo de Inteligência Operacional e Reputação da StayPulse.

Você recebeu o seguinte volume de avaliações do Google Maps de um cliente potencial:
- Total de Avaliações Analisadas: ${total}
- Avaliações Positivas (4-5★): ${positivas.length}
- Avaliações Críticas (1-2★): ${negativas.length}
- Avaliações Respondidas pelo Estabelecimento: ${respondidas.length} de ${total}

Amostra de Reclamações Detectadas:
${JSON.stringify(listaQuejas)}

Gere um diagnóstico estratégico, formal, rigoroso e comercialmente persuasivo em português do Brasil (máximo de 200 palavras) mantendo a seguinte estrutura exata:

📊 **VISÃO GERAL E MÉTRICAS CHAVE**
(Resuma com tom executivo a situação da empresa, destacando a taxa de resposta e como a omissão afeta o posicionamento no algoritmo do Google).

🎯 **PONTOS CRÍTICOS DE ATENÇÃO OPERACIONAL**
(Identifique e padronize tecnicamente os principais motivos de insatisfação presentes nas queixas, como falhas de processo, atendimento ou infraestrutura. NUNCA use palavras informais como "gargalo" ou "desleixo").

📉 **IMPACTO FINANCEIRO E PERDA DE OPORTUNIDADES**
(Explique o impacto comercial direto de deixar ${sinResponder} avaliações sem resposta, citando perda de conversão de novos clientes e fuga de receita para concorrentes da região).

🚀 **PLANO DE AÇÃO E SOLUÇÃO STAYPULSE**
(Apresente a solução comercial StayPulse de forma indispensável: filtragem de insatisfações via WhatsApp antes de irem ao Google, respostas assistidas por IA para 100% dos comentários e alavancagem de avaliações 5 estrelas).
`.trim();

  // --- 4. Llamada a la API de Gemini ---
  const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: "Error de Gemini", detalle: errText });
    }

    const data = await resp.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta generada.";

    return res.status(200).json({
      relatorio: texto,
      metricas: { total, positivas: positivas.length, negativas: negativas.length, sinResponder },
    });
  } catch (err) {
    return res.status(500).json({ error: "Fallo al llamar a Gemini", detalle: String(err) });
  }
}
