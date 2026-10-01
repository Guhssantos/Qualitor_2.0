import { prisma } from './prisma.js';
import { DEFAULT_SETTINGS } from './constants.js';

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const map = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
}

export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key];
}
