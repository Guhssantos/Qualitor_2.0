/**
 * Provedor de triagem baseado em palavras-chave. Funciona sem dependências externas
 * e serve como fallback quando nenhum provedor de IA está configurado.
 */
const KEYWORDS = {
  hardware: ['notebook', 'laptop', 'computador', 'desktop', 'monitor', 'teclado', 'mouse', 'impressora', 'não liga', 'nao liga', 'tela', 'bateria', 'carregador', 'hardware'],
  software: ['windows', 'office', 'excel', 'word', 'outlook', 'teams', 'aplicativo', 'programa', 'sistema', 'instalar', 'atualização', 'software', 'erro'],
  acesso: ['senha', 'login', 'acesso', 'bloqueado', 'bloqueada', 'mfa', 'autenticação', 'permissão', 'active directory', 'conta', 'expirou'],
  rede: ['internet', 'wi-fi', 'wifi', 'rede', 'vpn', 'cabo', 'conexão', 'lento', 'sem conexão', 'switch'],
  'microsoft 365': ['microsoft 365', 'onedrive', 'sharepoint', 'licença', 'exchange'],
  telefonia: ['telefone', 'ramal', 'celular', 'chip', 'linha'],
  'segurança': ['vírus', 'virus', 'phishing', 'malware', 'invasão', 'suspeito', 'segurança', 'ransomware'],
  infraestrutura: ['servidor', 'backup', 'storage', 'datacenter', 'banco de dados', 'infraestrutura'],
};

const CRITICAL = ['parado', 'todos', 'toda a empresa', 'urgente', 'produção', 'ransomware', 'invasão', 'servidor caiu', 'fora do ar'];
const HIGH = ['não consigo trabalhar', 'nao consigo trabalhar', 'bloqueado', 'não liga', 'nao liga', 'sem acesso', 'reunião'];
const LOW = ['dúvida', 'duvida', 'quando possível', 'gostaria', 'solicito', 'sugestão'];

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const ruleBasedProvider = {
  name: 'rule-based',
  isConfigured: () => true,
  async triage({ message, categories }) {
    const text = norm(message);
    let best = null;
    let bestScore = 0;
    for (const c of categories) {
      const words = [...(KEYWORDS[norm(c.name)] || []), norm(c.name), ...c.subcategories.map((s) => norm(s.name))];
      const score = words.reduce((acc, w) => acc + (text.includes(norm(w)) ? 1 : 0), 0);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    const sub = best?.subcategories.find((s) => text.includes(norm(s.name))) || null;
    const has = (list) => list.some((w) => text.includes(norm(w)));
    const priority = has(CRITICAL) ? 'CRITICAL' : has(HIGH) ? 'HIGH' : has(LOW) ? 'LOW' : (best?.defaultPriority || 'MEDIUM');
    const intent = /\?|como |duvida/.test(text) ? 'QUESTION' : has(['solicito', 'gostaria', 'preciso de', 'instalar', 'novo']) ? 'REQUEST' : 'INCIDENT';
    const clean = message.trim().replace(/\s+/g, ' ');
    const title = clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
    return {
      intent,
      categoryId: best?.id || null,
      subcategoryId: sub?.id || null,
      priority,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      summary: `O usuário relata: ${clean}`,
      confidence: best ? Math.min(0.9, 0.4 + bestScore * 0.15) : 0.1,
    };
  },
};
