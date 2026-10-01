import { useEffect, useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { ActiveBadge, EmptyState, Field, Modal, PageLoader } from '../../components/ui';

export default function Subcategories() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ categoryId: '', name: '', description: '', active: true });

  const load = () => api.get('/subcategories', { categoryId }).then(setItems).catch((e) => toast.error(e));
  useEffect(() => { api.get('/categories').then(setCategories).catch(() => {}); }, []);
  useEffect(() => { setItems(null); load(); }, [categoryId]); // eslint-disable-line

  const open = (s) => {
    setEditing(s || {});
    setForm(s ? { categoryId: s.categoryId, name: s.name, description: s.description || '', active: s.active } : { categoryId: categoryId || categories[0]?.id || '', name: '', description: '', active: true });
  };
  const save = async (e) => {
    e?.preventDefault();
    try {
      const payload = { ...form, description: form.description || null };
      if (editing.id) await api.put(`/subcategories/${editing.id}`, payload); else await api.post('/subcategories', payload);
      toast.success('Subcategoria salva.'); setEditing(null); load();
    } catch (err) { toast.error(err); }
  };
  const toggle = async (s) => {
    try { await api.put(`/subcategories/${s.id}`, { active: !s.active }); load(); } catch (err) { toast.error(err); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Subcategorias</h1><p className="page-subtitle">Detalhamento dos tipos de atendimento de cada categoria.</p></div>
        <div className="flex gap-2">
          <select className="input w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button className="btn-primary" onClick={() => open(null)}><Plus size={16} /> Nova</button>
        </div>
      </div>
      <div className="card overflow-hidden">
        {!items ? <PageLoader /> : items.length === 0 ? <EmptyState title="Nenhuma subcategoria" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Subcategoria</th><th>Categoria</th><th>Descrição</th><th>Chamados</th><th>Status</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.category.name}</td>
                    <td className="text-sm muted">{s.description || '—'}</td>
                    <td>{s.ticketCount}</td>
                    <td><ActiveBadge active={s.active} /></td>
                    <td><div className="flex justify-end gap-1"><button className="btn-ghost btn-icon" onClick={() => open(s)} aria-label="Editar"><Pencil size={15} /></button><button className="btn-ghost btn-icon" onClick={() => toggle(s)} aria-label="Ativar/desativar"><Power size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Editar subcategoria' : 'Nova subcategoria'} size="sm"
        footer={<><button className="btn-secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Categoria *"><select className="input" required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Nome *"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Descrição"><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Status"><select className="input" value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Ativa</option><option value="false">Inativa</option></select></Field>
        </form>
      </Modal>
    </div>
  );
}
