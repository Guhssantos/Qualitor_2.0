/**
 * Provedor Azure OpenAI / Microsoft Foundry (Chat Completions com saída JSON).
 * Configure AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT e AI_PROVIDER=azure-openai.
 */
const SYSTEM_PROMPT = `Você é um analista de Service Desk. Analise a mensagem do usuário e classifique o chamado.
Responda SOMENTE em JSON com as chaves: intent (INCIDENT|REQUEST|QUESTION), categoryId, subcategoryId (ou null),
priority (LOW|MEDIUM|HIGH|CRITICAL), title (até 80 caracteres), summary (problema reescrito de forma clara, em português),
confidence (0 a 1). Use apenas IDs presentes na lista de categorias fornecida.`;

export const azureOpenAIProvider = {
  name: 'azure-openai',
  isConfigured: () => Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_DEPLOYMENT),
  async triage({ message, categories }) {
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION = '2024-10-21' } = process.env;
    const url = `${AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
    const catalog = categories.map((c) => ({ id: c.id, name: c.name, description: c.description, subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })) }));
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY },
      body: JSON.stringify({
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Categorias: ${JSON.stringify(catalog)}\n\nMensagem do usuário: ${message}` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) throw new Error(`Azure OpenAI respondeu ${resp.status}`);
    const data = await resp.json();
    return JSON.parse(data.choices[0].message.content);
  },
};
