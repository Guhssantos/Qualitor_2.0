import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  ArrowLeft, Send, Lock, MessageSquare, Paperclip, Download, HandMetal, ArrowRightLeft, UserPlus, Flag, FolderTree,
  RefreshCw, History, CheckCircle2, XCircle, RotateCcw, Star, Ban, Info, X,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, Field, Modal, PageLoader, PriorityBadge, SlaBadge, SlaBar, Spinner, StatusBadge } from '../../components/ui';
import { PRIORITIES } from '../../lib/labels';
import { fmtDateTime, fmtRelative, fmtSize } from '../../lib/format';

const HISTORY_TEXT = {
  CREATED: () => 'abriu o chamado',
  STATUS: (h, L) => <>alterou o status de <b>{L.status(h.fromValue)}</b> para <b>{L.status(h.toValue)}</b></>,
  PRIORITY: (h, L) => <>alterou a prioridade de <b>{L.priority(h.fromValue)}</b> para <b>{L.priority(h.toValue)}</b></>,
  ASSIGNEE: (h) => (h.user?.name === h.toValue ? <>assumiu o chamado</> : <>atribuiu o chamado a <b>{h.toValue}</b></>),
  TRANSFER: (h) => <>transferiu de <b>{h.fromValue || '—'}</b> para a equipe <b>{h.toValue}</b></>,
  CATEGORY: (h) => <>alterou a categoria de <b>{h.fromValue}</b> para <b>{h.toValue}</b></>,
  ATTACHMENT: (h) => <>anexou <b>{h.toValue}</b>{h.internal ? ' (interno)' : ''}</>,
  RATING: (h) => <>avaliou o atendimento com <b>{h.toValue}/5</b></>,
};

function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 muted">{label}</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-200">{children || '—'}</span>
    </div>
  );
}

function AttachmentChip({ ticketId, a }) {
  const download = () => api.download(`/tickets/${ticketId}/attachments/${a.id}/download`, a.originalName);
  return (
    <button onClick={download} className={clsx('inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs hover:border-brand-500', a.internal ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-200 dark:border-slate-700')}>
      <Paperclip size={13} className="shrink-0" /><span className="truncate">{a.originalName}</span><span className="muted">{fmtSize(a.size)}</span><Download size={13} className="shrink-0 muted" />
    </button>
  );
}

function ActionModal({ action, ticket, onClose, onDone }) {
  const toast = useToast();
  const { statusLabel, priorityLabel } = useAuth();
  const [form, setForm] = useState({});
  const [opts, setOpts] = useState({ teams: [], agents: [], categories: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({});
    if (!action) return;
    if (action === 'transfer') api.get('/teams').then((teams) => setOpts((o) => ({ ...o, teams: teams.filter((t) => t.active) })));
    if (action === 'assign') api.get('/users/assignable', { categoryId: ticket.categoryId }).then((agents) => setOpts((o) => ({ ...o, agents })));
    if (action === 'category') api.get('/categories', { scope: 'active' }).then((categories) => setOpts((o) => ({ ...o, categories })));
  }, [action, ticket.categoryId]);

  useEffect(() => {
    if (action === 'transfer' && form.teamId) api.get('/users/assignable', { teamId: form.teamId, categoryId: ticket.categoryId }).then((agents) => setOpts((o) => ({ ...o, agents })));
  }, [action, form.teamId, ticket.categoryId]);

  const configs = {
    status: { title: 'Alterar status', url: 'status', method: 'patch', build: () => ({ status: form.status, note: form.note }) },
    priority: { title: 'Alterar prioridade', url: 'priority', method: 'patch', build: () => ({ priority: form.priority, note: form.note }) },
    assign: { title: 'Atribuir atendente', url: 'assign', method: 'patch', build: () => ({ assigneeId: form.assigneeId || null, note: form.note }) },
    transfer: { title: 'Transferir chamado', url: 'transfer', method: 'patch', build: () => ({ teamId: form.teamId, assigneeId: form.assigneeId || null, note: form.note }) },
    category: { title: 'Alterar categoria', url: 'category', method: 'patch', build: () => ({ categoryId: form.categoryId, subcategoryId: form.subcategoryId || null, note: form.note }) },
  };
  const cfg = configs[action];
  if (!cfg) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const subcats = opts.categories.find((c) => c.id === form.categoryId)?.subcategories || [];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api[cfg.method](`/tickets/${ticket.id}/${cfg.url}`, cfg.build());
      toast.success('Chamado atualizado.');
      onDone();
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={cfg.title} size="sm"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" form="action-form" disabled={saving}>{saving && <Spinner className="text-white" />} Confirmar</button></>}>
      <form id="action-form" onSubmit={submit} className="space-y-3">
        {action === 'status' && (
          <Field label="Novo status">
            <select className="input" required value={form.status || ''} onChange={set('status')}>
              <option value="">Selecione...</option>
              {ticket.allowedStatuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </Field>
        )}
        {action === 'priority' && (
          <Field label="Nova prioridade" hint="O SLA será recalculado.">
            <select className="input" required value={form.priority || ''} onChange={set('priority')}>
              <option value="">Selecione...</option>
              {PRIORITIES.filter((p) => p !== ticket.priority).map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
            </select>
          </Field>
        )}
        {action === 'assign' && (
          <Field label="Atendente" hint="Somente atendentes autorizados na categoria do chamado.">
            <select className="input" value={form.assigneeId || ''} onChange={set('assigneeId')}>
              <option value="">Sem responsável</option>
              {opts.agents.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.role.name}</option>)}
            </select>
          </Field>
        )}
        {action === 'transfer' && (
          <>
            <Field label="Equipe de destino">
              <select className="input" required value={form.teamId || ''} onChange={set('teamId')}>
                <option value="">Selecione...</option>
                {opts.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Atendente (opcional)">
              <select className="input" value={form.assigneeId || ''} onChange={set('assigneeId')} disabled={!form.teamId}>
                <option value="">Fila da equipe</option>
                {opts.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </>
        )}
        {action === 'category' && (
          <>
            <Field label="Categoria">
              <select className="input" required value={form.categoryId || ''} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, subcategoryId: '' }))}>
                <option value="">Selecione...</option>
                {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategoria">
              <select className="input" value={form.subcategoryId || ''} onChange={set('subcategoryId')} disabled={!subcats.length}>
                <option value="">—</option>
                {subcats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Observação" hint={action === 'status' ? 'Se preenchida, será enviada ao solicitante como mensagem.' : 'Registrada no histórico.'}>
          <textarea className="input min-h-[80px]" value={form.note || ''} onChange={set('note')} maxLength={5000} />
        </Field>
      </form>
    </Modal>
  );
}

function RequesterActions({ ticket, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const c = ticket.capabilities;

  const act = async (action, msg) => {
    try {
      await api.post(`/tickets/${ticket.id}/requester-action`, { action, note: note || undefined });
      toast.success(msg);
      setNote('');
      onDone();
    } catch (err) { toast.error(err); }
  };
  const rate = async () => {
    try { await api.post(`/tickets/${ticket.id}/rating`, { rating, comment }); toast.success('Obrigado pela avaliação!'); onDone(); } catch (err) { toast.error(err); }
  };

  if (!c.requesterValidate && !c.requesterClose && !c.rate && !c.requesterCancel) return null;
  return (
    <div className="card space-y-3 border-brand-500/40 p-4">
      {c.requesterValidate && (
        <>
          <p className="flex items-center gap-2 text-sm font-medium"><Info size={16} className="text-brand-500" /> A equipe informou uma solução. O problema foi resolvido?</p>
          <textarea className="input" placeholder="Comentário (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => act('approve', 'Solução confirmada.')}><CheckCircle2 size={16} /> Sim, resolvido</button>
            <button className="btn-secondary" onClick={() => act('reject', 'Chamado retornou para atendimento.')}><XCircle size={16} /> Ainda não</button>
          </div>
        </>
      )}
      {c.requesterClose && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm">Chamado resolvido. Deseja encerrá-lo ou reabrir?</p>
          <button className="btn-primary btn-sm" onClick={() => act('close', 'Chamado encerrado.')}><CheckCircle2 size={14} /> Encerrar</button>
          <button className="btn-secondary btn-sm" onClick={() => act('reopen', 'Chamado reaberto.')}><RotateCcw size={14} /> Reabrir</button>
        </div>
      )}
      {c.rate && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Como foi o atendimento?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
                <Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
              </button>
            ))}
          </div>
          <textarea className="input" placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-primary btn-sm" disabled={!rating} onClick={rate}>Enviar avaliação</button>
        </div>
      )}
      {c.requesterCancel && (
        <button className="btn-ghost btn-sm text-red-600 dark:text-red-400" onClick={() => window.confirm('Cancelar este chamado?') && act('cancel', 'Chamado cancelado.')}><Ban size={14} /> Cancelar chamado</button>
      )}
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, statusLabel, priorityLabel } = useAuth();
  const { reloadCounters } = useOutletContext() || {};
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('PUBLIC');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [action, setAction] = useState(null);
  const [showHistory, setShowHistory] = useState(true);

  const load = useCallback(() => api.get(`/tickets/${id}`).then(setT).catch((e) => setError(e)), [id]);
  useEffect(() => { setT(null); setError(null); load(); }, [load]);

  const refresh = () => { load(); reloadCounters?.(); };
  const L = { status: statusLabel, priority: priorityLabel };

  const timeline = useMemo(() => {
    if (!t) return [];
    const items = t.messages.map((m) => ({ kind: 'message', at: m.createdAt, data: m }));
    if (showHistory) t.history.forEach((h) => items.push({ kind: 'history', at: h.createdAt, data: h }));
    const msgAttIds = new Set(t.messages.flatMap((m) => m.attachments.map((a) => a.id)));
    t.attachments.filter((a) => !msgAttIds.has(a.id) && !showHistory).forEach((a) => items.push({ kind: 'attachment', at: a.createdAt, data: a }));
    return items.sort((a, b) => new Date(a.at) - new Date(b.at));
  }, [t, showHistory]);

  if (error) {
    return (
      <div className="card p-10 text-center">
        <p className="font-medium">{error.status === 404 ? 'Chamado não encontrado ou sem permissão de acesso.' : error.message}</p>
        <button className="btn-secondary mt-4" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Voltar</button>
      </div>
    );
  }
  if (!t) return <PageLoader />;
  const c = t.capabilities;

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() && !files.length) return;
    setSending(true);
    try {
      let messageId;
      if (body.trim()) messageId = (await api.post(`/tickets/${t.id}/messages`, { body, type: mode })).id;
      if (files.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        fd.append('internal', String(mode === 'INTERNAL'));
        if (messageId) fd.append('messageId', messageId);
        await api.upload(`/tickets/${t.id}/attachments`, fd);
      }
      setBody(''); setFiles([]);
      refresh();
    } catch (err) { toast.error(err); } finally { setSending(false); }
  };

  const assume = async () => {
    try { await api.post(`/tickets/${t.id}/assume`); toast.success('Chamado assumido.'); refresh(); } catch (err) { toast.error(err); }
  };

  const actionButtons = [
    c.assume && { key: 'assume', label: 'Assumir', icon: HandMetal, onClick: assume, primary: true },
    c.changeStatus && t.allowedStatuses.length > 0 && { key: 'status', label: 'Status', icon: RefreshCw },
    c.changePriority && { key: 'priority', label: 'Prioridade', icon: Flag },
    c.assign && { key: 'assign', label: 'Atribuir', icon: UserPlus },
    c.transfer && { key: 'transfer', label: 'Transferir', icon: ArrowRightLeft },
    c.changeCategory && { key: 'category', label: 'Categoria', icon: FolderTree },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <button className="btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm muted">{t.code}</span>
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            <SlaBadge sla={t.sla} showTime />
          </div>
          <h1 className="mt-1 break-words text-xl font-semibold text-slate-900 dark:text-white">{t.title}</h1>
        </div>
        {actionButtons.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {actionButtons.map((b) => (
              <button key={b.key} className={b.primary ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={b.onClick || (() => setAction(b.key))}><b.icon size={14} /> {b.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <RequesterActions ticket={t} onDone={refresh} />

          {/* Descrição */}
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={t.requester.name} />
              <div>
                <p className="text-sm font-medium">{t.requester.name}</p>
                <p className="text-xs muted">abriu em {fmtDateTime(t.createdAt)} · via {t.source}</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{t.description}</p>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2"><MessageSquare size={16} /> Interações</span>
              <button className="btn-ghost btn-sm" onClick={() => setShowHistory((s) => !s)}><History size={14} /> {showHistory ? 'Ocultar histórico' : 'Mostrar histórico'}</button>
            </div>
            <ol className="space-y-4 p-4">
              {timeline.length === 0 && <li className="text-center text-sm muted">Nenhuma interação ainda.</li>}
              {timeline.map((it) => {
                if (it.kind === 'history') {
                  const h = it.data;
                  const text = HISTORY_TEXT[h.action]?.(h, L) || h.action;
                  return (
                    <li key={`h-${h.id}`} className="flex items-start gap-3 pl-1 text-xs muted">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="flex-1"><b className="text-slate-600 dark:text-slate-300">{h.user?.name || 'Sistema'}</b> {text}{h.note && h.action !== 'CREATED' && !(h.action === 'ASSIGNEE' && h.user?.name === h.toValue) ? <> — <i>“{h.note}”</i></> : h.action === 'CREATED' && h.note ? <> · {h.note}</> : null}</span>
                      <span title={fmtDateTime(h.createdAt)} className="shrink-0">{fmtRelative(h.createdAt)}</span>
                    </li>
                  );
                }
                if (it.kind === 'attachment') {
                  return <li key={`a-${it.data.id}`} className="pl-6"><AttachmentChip ticketId={t.id} a={it.data} /></li>;
                }
                const m = it.data;
                const mine = m.author?.id === user.id;
                const internal = m.type === 'INTERNAL';
                const fromRequester = m.author?.id === t.requester.id;
                return (
                  <li key={`m-${m.id}`} className={clsx('flex gap-3', mine && 'flex-row-reverse')}>
                    <Avatar name={m.author?.name || 'Sistema'} size="sm" />
                    <div className={clsx('max-w-[85%] rounded-2xl px-4 py-2.5', internal
                      ? 'border border-dashed border-amber-500/50 bg-amber-500/10'
                      : mine ? 'rounded-tr-sm bg-brand-600 text-white' : fromRequester ? 'rounded-tl-sm bg-slate-100 dark:bg-ink-800' : 'rounded-tl-sm bg-indigo-500/10 dark:bg-indigo-500/15')}>
                      <div className={clsx('mb-1 flex flex-wrap items-center gap-2 text-xs', mine && !internal ? 'text-brand-100' : 'muted')}>
                        <b>{m.author?.name || 'Sistema'}</b>
                        {internal && <span className="badge bg-amber-500/20 text-amber-700 ring-amber-500/40 dark:text-amber-300"><Lock size={10} /> Nota interna</span>}
                        <span title={fmtDateTime(m.createdAt)}>{fmtRelative(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                      {m.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{m.attachments.map((a) => <AttachmentChip key={a.id} ticketId={t.id} a={a} />)}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>

            {c.reply ? (
              <form onSubmit={send} className="border-t border-slate-200 p-4 dark:border-slate-800">
                {c.internalNote && (
                  <div className="mb-2 inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
                    <button type="button" onClick={() => setMode('PUBLIC')} className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium', mode === 'PUBLIC' ? 'bg-brand-600 text-white' : 'muted')}><MessageSquare size={13} /> Mensagem para o usuário</button>
                    <button type="button" onClick={() => setMode('INTERNAL')} className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium', mode === 'INTERNAL' ? 'bg-amber-500 text-white' : 'muted')}><Lock size={13} /> Nota interna</button>
                  </div>
                )}
                <textarea className={clsx('input min-h-[90px]', mode === 'INTERNAL' && 'border-amber-500/60 bg-amber-500/5 focus:border-amber-500 focus:ring-amber-500/30')}
                  placeholder={mode === 'INTERNAL' ? 'Nota visível apenas para a equipe de atendimento...' : 'Escreva sua mensagem...'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} />
                {mode === 'INTERNAL' && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><Lock size={12} /> O solicitante nunca verá esta nota.</p>}
                {files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-ink-800">{f.name}<button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={12} /></button></span>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {c.attach ? (
                    <label className="btn-ghost btn-sm cursor-pointer"><Paperclip size={14} /> Anexar<input type="file" multiple className="hidden" onChange={(e) => { setFiles([...files, ...Array.from(e.target.files)].slice(0, 10)); e.target.value = ''; }} /></label>
                  ) : <span />}
                  <button className={mode === 'INTERNAL' ? 'btn bg-amber-500 text-white hover:bg-amber-400' : 'btn-primary'} disabled={sending || (!body.trim() && !files.length)}>
                    {sending ? <Spinner className="text-white" /> : <Send size={15} />} {mode === 'INTERNAL' ? 'Salvar nota' : 'Enviar'}
                  </button>
                </div>
              </form>
            ) : (
              <p className="border-t border-slate-200 p-4 text-center text-sm muted dark:border-slate-800">Este chamado está {statusLabel(t.status).toLowerCase()} e não aceita novas mensagens.</p>
            )}
          </div>
        </div>

        {/* Painel lateral */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="card-title mb-1">Detalhes</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label="Número">{t.code}</InfoRow>
              <InfoRow label="Status"><StatusBadge status={t.status} /></InfoRow>
              <InfoRow label="Prioridade"><PriorityBadge priority={t.priority} /></InfoRow>
              <InfoRow label="Categoria">{t.category?.name}{t.subcategory ? ` / ${t.subcategory.name}` : ''}</InfoRow>
              <InfoRow label="Solicitante">{t.requester?.name}</InfoRow>
              <InfoRow label="Departamento">{t.department}</InfoRow>
              <InfoRow label="Local">{t.location}</InfoRow>
              <InfoRow label="Atendente">{t.assignee?.name || 'Sem responsável'}</InfoRow>
              <InfoRow label="Equipe">{t.team?.name}</InfoRow>
              <InfoRow label="Abertura">{fmtDateTime(t.createdAt)}</InfoRow>
              <InfoRow label="Atualização">{fmtRelative(t.updatedAt)}</InfoRow>
              {t.rating && <InfoRow label="Avaliação"><span className="inline-flex items-center gap-1"><Star size={14} className="fill-amber-400 text-amber-400" />{t.rating}/5</span></InfoRow>}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="card-title mb-3">SLA</h3>
            <SlaBadge sla={t.sla} showTime />
            <div className="mt-3"><SlaBar sla={t.sla} /></div>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow label="1ª resposta até">{fmtDateTime(t.firstResponseDueAt)}</InfoRow>
              <InfoRow label="1ª resposta em">{t.firstRespondedAt ? <span className={t.sla.firstResponse?.breached ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}>{fmtDateTime(t.firstRespondedAt)}</span> : 'Pendente'}</InfoRow>
              <InfoRow label="Resolução até">{fmtDateTime(t.resolutionDueAt)}</InfoRow>
              {t.resolvedAt && <InfoRow label="Resolvido em">{fmtDateTime(t.resolvedAt)}</InfoRow>}
              {t.closedAt && <InfoRow label="Encerrado em">{fmtDateTime(t.closedAt)}</InfoRow>}
            </div>
            {t.status === 'WAITING_USER' && <p className="mt-2 text-xs muted">O SLA fica pausado enquanto aguarda o usuário.</p>}
          </div>

          {t.attachments.length > 0 && (
            <div className="card p-4">
              <h3 className="card-title mb-3">Anexos ({t.attachments.length})</h3>
              <div className="flex flex-col items-start gap-1.5">{t.attachments.map((a) => <AttachmentChip key={a.id} ticketId={t.id} a={a} />)}</div>
            </div>
          )}

          {t.aiMetadata && (
            <div className="card p-4 text-xs">
              <h3 className="card-title mb-2">Triagem por IA</h3>
              <p className="muted">Provedor: {t.aiMetadata.provider} · confiança {Math.round((t.aiMetadata.confidence || 0) * 100)}%</p>
              <p className="mt-1">{t.aiMetadata.summary}</p>
            </div>
          )}
        </aside>
      </div>

      {action && <ActionModal action={action} ticket={t} onClose={() => setAction(null)} onDone={() => { setAction(null); refresh(); }} />}
    </div>
  );
}
