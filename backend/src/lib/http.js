/** Utilitários de paginação e serialização. */
export function pagination(query, { defaultSize = 20, maxSize = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, parseInt(query.pageSize, 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paged(items, total, { page, pageSize }) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const publicUser = {
  id: true, name: true, email: true, department: true, jobTitle: true,
};

export function formatTicketNumber(n) {
  return `SD-${String(n).padStart(6, '0')}`;
}
