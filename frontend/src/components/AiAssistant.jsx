import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bot, Send, Sparkles, Check, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

/**
 * Assistente de abertura de chamados.
 * Fluxo: mensagem → interpretação (IA) → confirmação → criação → encaminhamento automático.
 */
export default function AiAssistant({ compact = false }) {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Olá! Descreva seu problema com suas palavras e eu abro o chamado para você. Ex.: "Meu notebook não liga".' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(null);
  const endRef = useRef(null);
  const navigate = useNavigate();
  const { priorityLabel } = useAuth();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);
  const push = (m) => setMessages((list) => [...list, m]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    push({ from: 'user', text });
    if (proposal && /^(sim|s|isso|correto|ok|confirmo)\b/i.test(text)) return confirm();
    if (proposal && /^(n[aã]o|n)\b/i.test(text)) return reject();
    if (text.length < 5) return push({ from: 'bot', text: 'Pode detalhar um pouco mais o problema?' });
    setBusy(true);
    try {
      const r = await api.post('/ai/triage', { message: text });
      setProposal(r.proposal);
      push({ from: 'bot', text: r.confirmationMessage, proposal: r.needsManualCategory ? null : r.proposal });
      if (r.needsManualCategory) push({ from: 'bot', text: 'Vou te levar ao formulário com a descrição preenchida.', action: 'form', proposal: r.proposal });
    } catch (err) {
      push({ from: 'bot', text: `Desculpe, não consegui processar: ${err.message}` });
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const r = await api.post('/ai/confirm', {
        title: proposal.title, description: proposal.description, categoryId: proposal.categoryId,
        subcategoryId: proposal.subcategoryId, priority: proposal.priority, proposal,
      });
      push({ from: 'bot', text: `${r.message} Ele já foi encaminhado para a equipe responsável.`, ticket: r.ticket });
      setProposal(null);
    } catch (err) {
      push({ from: 'bot', text: `Não foi possível criar o chamado: ${err.message}` });
    } finally { setBusy(false); }
  };

  const reject = () => {
    push({ from: 'bot', text: 'Sem problemas! Você pode ajustar os dados no formulário.', action: 'form', proposal });
    setProposal(null);
  };

  const openForm = (p) => navigate('/tickets/new', { state: { prefill: p } });

  return (
    <div className="card flex flex-col">
      <div className="card-header">
        <span className="card-title flex items-center gap-2"><Sparkles size={16} className="text-brand-500" /> Assistente de abertura</span>
        <span className="badge bg-brand-500/10 text-brand-600 ring-brand-500/30 dark:text-brand-300">IA</span>
      </div>
      <div className={clsx('flex-1 space-y-3 overflow-y-auto p-4', compact ? 'max-h-80' : 'max-h-[28rem]')}>
        {messages.map((m, i) => (
          <div key={i} className={clsx('flex gap-2', m.from === 'user' && 'justify-end')}>
            {m.from === 'bot' && <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-brand-600/15 p-1.5 text-brand-500"><Bot size={16} /></div>}
            <div className={clsx('max-w-[85%] rounded-2xl px-3 py-2 text-sm', m.from === 'user' ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-slate-100 dark:bg-ink-800')}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.proposal && proposal === m.proposal && (
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg bg-white/60 p-2 text-xs dark:bg-ink-900/60">
                    <p><b>Título:</b> {m.proposal.title}</p>
                    <p><b>Categoria:</b> {m.proposal.categoryName}{m.proposal.subcategoryName ? ` / ${m.proposal.subcategoryName}` : ''}</p>
                    <p><b>Prioridade:</b> {priorityLabel(m.proposal.priority)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary btn-sm" onClick={() => { push({ from: 'user', text: 'Sim' }); confirm(); }} disabled={busy}><Check size={14} /> Sim, abrir chamado</button>
                    <button className="btn-secondary btn-sm" onClick={() => { push({ from: 'user', text: 'Não' }); reject(); }} disabled={busy}><Pencil size={14} /> Ajustar</button>
                  </div>
                </div>
              )}
              {m.action === 'form' && <button className="btn-secondary btn-sm mt-2" onClick={() => openForm(m.proposal)}>Abrir formulário</button>}
              {m.ticket && <Link className="mt-1 inline-block font-medium text-brand-600 underline dark:text-brand-300" to={`/tickets/view/${m.ticket.id}`}>Ver {m.ticket.code}</Link>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-xs muted"><Spinner size={14} /> Analisando...</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <input className="input" placeholder="Descreva o problema..." value={input} onChange={(e) => setInput(e.target.value)} maxLength={5000} />
        <button className="btn-primary btn-icon px-3" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={16} /></button>
      </form>
    </div>
  );
}
