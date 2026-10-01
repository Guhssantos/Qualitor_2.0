import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSlaMinutes, slaState } from '../src/modules/sla/sla.service.js';

test('addSlaMinutes em dias corridos', () => {
  const start = new Date(2026, 9, 2, 10, 0); // sexta
  assert.equal(addSlaMinutes(start, 120).getTime(), new Date(2026, 9, 2, 12, 0).getTime());
});

test('addSlaMinutes em dias úteis ignora fim de semana', () => {
  const start = new Date(2026, 9, 2, 10, 0); // sexta 10h
  const due = addSlaMinutes(start, 2 * 1440, true); // 2 dias úteis
  assert.equal(due.getTime(), new Date(2026, 9, 6, 10, 0).getTime()); // terça 10h
});

test('slaState: dentro do prazo, próximo do vencimento, vencido e pausado', () => {
  const now = new Date(2026, 9, 1, 12, 0);
  const base = { status: 'IN_PROGRESS', createdAt: new Date(2026, 9, 1, 10, 0), firstRespondedAt: new Date(2026, 9, 1, 10, 5), firstResponseDueAt: new Date(2026, 9, 1, 10, 30) };
  assert.equal(slaState({ ...base, resolutionDueAt: new Date(2026, 9, 1, 18, 0) }, 75, now).status, 'OK');
  assert.equal(slaState({ ...base, resolutionDueAt: new Date(2026, 9, 1, 12, 30) }, 75, now).status, 'WARNING');
  assert.equal(slaState({ ...base, resolutionDueAt: new Date(2026, 9, 1, 11, 30) }, 75, now).status, 'BREACHED');
  assert.equal(slaState({ ...base, resolutionDueAt: new Date(2026, 9, 1, 18, 0), slaPausedAt: new Date(2026, 9, 1, 11, 0) }, 75, now).status, 'PAUSED');
  assert.equal(slaState({ ...base, resolutionDueAt: new Date(2026, 9, 1, 18, 0), resolvedAt: new Date(2026, 9, 1, 11, 0) }, 75, now).status, 'MET');
});

test('slaState: primeira resposta vencida marca SLA como vencido', () => {
  const now = new Date(2026, 9, 1, 12, 0);
  const t = { status: 'OPEN', createdAt: new Date(2026, 9, 1, 11, 0), firstResponseDueAt: new Date(2026, 9, 1, 11, 15), resolutionDueAt: new Date(2026, 9, 1, 19, 0) };
  assert.equal(slaState(t, 75, now).status, 'BREACHED');
});
