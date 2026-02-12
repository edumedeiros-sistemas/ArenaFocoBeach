/**
 * Converte objetos vindos do Firestore em JSON serializável (Timestamps → ISO string)
 * para evitar 500 ao usar res.json() no Express.
 */
export function toJSONSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toJSONSafe);
  if (typeof value === 'object' && value.constructor?.name === 'Object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJSONSafe(v);
    return out;
  }
  return value;
}
