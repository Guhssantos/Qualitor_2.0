import { env } from '../../config/env.js';
import { ruleBasedProvider } from './ruleBased.provider.js';
import { azureOpenAIProvider } from './azureOpenAI.provider.js';

/**
 * Contrato de um provedor de IA para triagem de chamados:
 *
 *   triage({ message, categories }) => Promise<{
 *     intent: 'INCIDENT' | 'REQUEST' | 'QUESTION',
 *     categoryId: string | null, subcategoryId: string | null,
 *     priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
 *     title: string, summary: string, confidence: number (0..1)
 *   }>
 *
 * `categories` = categorias ativas com subcategorias (id, name, description).
 * Novos provedores (Microsoft Foundry Agents, Anthropic Claude, etc.) só precisam implementar esse contrato.
 */
const providers = {
  'rule-based': ruleBasedProvider,
  'azure-openai': azureOpenAIProvider,
};

export function getAIProvider() {
  const p = providers[env.aiProvider];
  if (p && p.isConfigured()) return p;
  return ruleBasedProvider;
}

export function aiProviderInfo() {
  const p = getAIProvider();
  return { configured: env.aiProvider, active: p.name };
}
