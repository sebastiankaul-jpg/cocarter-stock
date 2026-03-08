export const categories = [
  'Body manga larga','Body manga corta','Ajuar','Enterito','Pijama','Campera','Buzo','Pantalón','Conjuntos','Vestido','Short','Manta','Remera','Camiseta','Ranita'
];
export const sizes = ['RN','3 meses','6 meses','9 meses','12 meses','18 meses','24 meses','3 años','4 años','5 años','6 años'];

export function badgeStyle(stock) {
  if (stock === 0) return {background:'#dc2626',color:'white'};
  if (stock < 3) return {background:'#ef4444',color:'white'};
  return {background:'#e6f4f1',color:'#115e59'};
}

export function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
