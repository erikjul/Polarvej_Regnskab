// storage.js – autosave i browseren og gem/åbn som fil
const KEY = 'polarvej-regnskab-v2';
const KEY_V1 = 'polarvej-regnskab-v1';
export function gemLokalt(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorer */ } }
export function hentLokalt() { try { const s = localStorage.getItem(KEY) || localStorage.getItem(KEY_V1); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function sletLokalt() { try { localStorage.removeItem(KEY); } catch (e) { /* ignorer */ } }
export function downloadBlob(blob, filnavn) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filnavn; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
export function gemSomFil(samling) {
  const aktiv = samling.regnskaber ? samling.regnskaber[samling.aktivAar] : samling;
  const navn = ((aktiv.forening || {}).navn || 'regnskab').replace(/[^a-zA-Z0-9æøåÆØÅ_-]+/g, '_');
  const aar = samling.regnskaber ? Object.keys(samling.regnskaber).sort().join('-') : aktiv.aar;
  downloadBlob(new Blob([JSON.stringify(samling, null, 2)], { type: 'application/json' }), `${navn}_${aar}.json`);
}
export function laesFil(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { resolve(JSON.parse(r.result)); } catch (e) { reject(new Error('Filen er ikke gyldig JSON')); } };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
