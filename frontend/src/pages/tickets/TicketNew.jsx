import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Paperclip, Send, X, FileText, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Field, Spinner } from '../../components/ui';
import AiAssistant from '../../components/AiAssistant';
import { PRIORITIES } from '../../lib/labels';
import { fmtSize } from '../../lib/format';

export default function TicketNew() {
  const { user, meta, isStaff, priorityLabel } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill;
  const [tab, setTab] = useState(prefill ? 'form' : 'form');
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: prefill?.title || '', description: prefill?.description || '', categoryId: prefill?.categoryId || '',
    subcategoryId: prefill?.subcategoryId || '', priority: prefill?.priority || '', location: '', department: user.department || '',
  });

  useEffect(() => { api.get('/categories', { scope: 'active' }).then(setCategories).catch((e) => toast.error(e)); }, []); // eslint-disable-line
  const category = useMemo(() => categories.find((c) => c.id === form.categoryId), [categories, form.categoryId]);
  const canSetPriority = isStaff || meta?.requesterCanSetPriority;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'categoryId' ? { subcategoryId: '' } : {}) }));

  const addFiles = (list) => {
    const arr = [...files, ...Array.from(list)].slice(0, 10);
    setFiles(arr);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, subcategoryId: form.subcategoryId || null, priority: canSetPriority && form.priority ? form.priority : undefined };
      const t = await api.post('/tickets', payload);
      if (files.length) {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        try { await api.upload(`/tickets/${t.id}/attachments`, fd); } catch (err) { toast.error(`Chamado criado, mas houve erro no anexo: ${err.message}`); }
      }
      toast.success(`Chamado ${t.code} aberto com sucesso!`);
      navigate(`/tickets/view/${t.id}`);
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="page-title">Abrir chamado</h1>
        <p className="page-subtitle">Descreva sua solicitação. Número, SLA e equipe responsável são definidos automaticamente.</p>
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-ink-900">
        {[['form', 'Formulário', FileText], ['ai', 'Assistente IA', Sparkles]].map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium', tab === k ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300')}><I size={15} />{l}</button>
        ))}
      </div>

      {tab === 'ai' ? <AiAssistant /> : (
        <form onSubmit={submit} className="card space-y-4 p-4 sm:p-6">
          {prefill && <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-brand-300">Dados sugeridos pelo assistente — revise antes de enviar.</p>}
          <Field label="Título *"><input className="input" required minLength={5} maxLength={200} value={form.title} onChange={set('title')} placeholder="Resumo do problema ou solicitação" /></Field>
          <Field label="Descrição *"><textarea className="input min-h-[140px]" required minLength={10} value={form.description} onChange={set('description')} placeholder="O que aconteceu? Desde quando? Há mensagem de erro?" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria *">
              <select className="input" required value={form.categoryId} onChange={set('categoryId')}>
                <option value="">Selecione...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {category?.description && <span className="mt-1 block text-xs muted">{category.description}</span>}
            </Field>
            <Field label="Subcategoria">
              <select className="input" value={form.subcategoryId} onChange={set('subcategoryId')} disabled={!category?.subcategories?.length}>
                <option value="">Selecione...</option>
                {category?.subcategories?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Prioridade" hint={!canSetPriority ? 'Definida automaticamente pela categoria.' : category ? `Padrão da categoria: ${priorityLabel(category.defaultPriority)}` : undefined}>
              <select className="input" value={form.priority} onChange={set('priority')} disabled={!canSetPriority}>
                <option value="">Padrão da categoria</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
              </select>
            </Field>
            <Field label="Local"><input className="input" maxLength={160} value={form.location} onChange={set('location')} placeholder="Ex.: Matriz — 3º andar, sala 12" /></Field>
            <Field label="Departamento"><input className="input" maxLength={120} value={form.department} onChange={set('department')} /></Field>
          </div>

          <div>
            <span className="label">Anexos</span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-5 text-sm muted transition hover:border-brand-500 dark:border-slate-700"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
              <Paperclip size={18} />
              <span>Arraste arquivos ou <b className="text-brand-600 dark:text-brand-400">clique para selecionar</b></span>
              <span className="text-xs">Imagens, PDF, Office, TXT, ZIP · até 10 arquivos</span>
              <input type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm dark:bg-ink-850">
                    <Paperclip size={14} className="muted" /><span className="flex-1 truncate">{f.name}</span><span className="text-xs muted">{fmtSize(f.size)}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500" aria-label="Remover"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
            <button className="btn-primary" disabled={saving}>{saving ? <Spinner className="text-white" /> : <Send size={16} />} Abrir chamado</button>
          </div>
        </form>
      )}
    </div>
  );
}
