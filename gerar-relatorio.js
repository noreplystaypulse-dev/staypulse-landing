// api/gerar-relatorio.js
// Función serverless de Vercel. La API key vive SOLO acá (variable de entorno),
// nunca llega al navegador del cliente.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  // --- 1. Autenticación simple (protege el endpoint mientras es "solo para vos") ---
  const senhaEnviada = req.headers["x-admin-password"];
  if (senhaEnviada !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const { resenhas } = req.body;
  if (!Array.isArray(resenhas) || resenhas.length === 0) {
    return res.status(400).json({ error: "Envíe un array 'resenhas' no vacío" });
  }

  // --- 2. Métricas cuantitativas (equivalente al pandas de tu script) ---
  const total = resenhas.length;
  const positivas = resenhas.filter((r) => r.estrellas >= 4);
  const negativas = resenhas.filter((r) => r.estrellas <= 2);
  const respondidas = resenhas.filter((r) => r.respondida === true);
  const sinResponder = total - respondidas.length;
  const listaQuejas = negativas.map((r) => r.comentario);

  // --- 3. Prompt (mismo formato que tu versión en Python) ---
  const prompt = `
Atue como um Consultor Estratégico de Operações e Reputação da StayPulse.

Você recebeu o seguinte volume de avaliações do Google Maps de um cliente:
- Total de Avaliações Analisadas: ${total}
- Avaliações Positivas (4-5★): ${positivas.length}
- Avaliações Críticas (1-2★): ${negativas.length}
- Avaliações Respondidas pelo Estabelecimento: ${respondidas.length} de ${total}

Lista de Reclamações Detectadas:
${JSON.stringify(listaQuejas)}

Gere um relatório estruturado e profissional em português do Brasil (máximo de 180 palavras) com a seguinte estrutura exata:

📊 **Visão Geral dos Números:**
(Resuma em 1 frase o panorama geral destacando a taxa de resposta e o impacto das avaliações negativas).

🔴 **Gargalo Principal de Atendimento:**
(Identifique o padrão comum entre as reclamações).

⚠️ **Risco de Perda de Clientes:**
(Explique o impacto comercial de deixar ${sinResponder} avaliações sem resposta no Google).

💡 **Plano de Ação StayPulse:**
(Explique como a automação do StayPulse resolve isso: filtragem de queixas via WhatsApp, respostas automáticas com IA e aumento no volume de 5 estrelas).
`.trim();

  // --- 4. Llamada a la API de Gemini (server-to-server, key nunca expuesta) ---
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
