import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field, Modal } from './ui';

export default function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { setMustChangePassword } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('A confirmação não confere.');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Senha alterada com sucesso.');
      setMustChangePassword(false);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      onClose();
    } catch (err) { toast.error(err); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Alterar senha" size="sm"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" form="pwd-form" disabled={saving}>Salvar</button></>}>
      <form id="pwd-form" onSubmit={submit} className="space-y-3">
        <Field label="Senha atual"><input type="password" className="input" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números."><input type="password" className="input" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <Field label="Confirmar nova senha"><input type="password" className="input" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" /></Field>
      </form>
    </Modal>
  );
}
