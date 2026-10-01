import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDit9uEfyINrdiOlOngQ1l9TEDo45rGfdw",
  authDomain: "avantileaderboard.firebaseapp.com",
  projectId: "avantileaderboard",
  storageBucket: "avantileaderboard.firebasestorage.app",
  messagingSenderId: "124498701164",
  appId: "1:124498701164:web:c519ecbd82e27a4ef32149"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged };

// Подписка на участников в реальном времени (сама переподключается после ошибки)
export const watch = cb => {
  let unsub, timer, dead = false;
  const start = () => {
    unsub = onSnapshot(collection(db, "participants"),
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
      e => { console.error(e); if (!dead) timer = setTimeout(start, 3000); });
  };
  start();
  return () => { dead = true; clearTimeout(timer); unsub && unsub(); };
};

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

// "1:12.340" | "01:12,34" | "72.340" -> мс (или null)
export function parseTime(s) {
  const m = String(s).trim().replace(",", ".").match(/^(?:(\d{1,2}):)?(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!m || (m[1] && +m[2] >= 60)) return null;
  return (+(m[1] || 0)) * 60000 + (+m[2]) * 1000 + (+(m[3] || "0").padEnd(3, "0"));
}
export function fmt(ms) {
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 60000))}:${p(Math.floor(ms % 60000 / 1000))}.${p(ms % 1000, 3)}`;
}

const TD = "py-4 px-4 sm:px-8";
const BADGE = [["gold", "trophy"], ["silver", "medal"], ["bronze", "award"]];
const city = p => `<td class="${TD} text-zinc-300 text-sm sm:text-base"><i class="fa-solid fa-location-dot text-zinc-400 text-xs mr-2"></i>${esc(p.city)}</td>`;
const idc = p => `<td class="${TD} text-center font-mono text-zinc-400 text-sm sm:text-base">${p.seqId ?? "—"}</td>`;
const name = p => `<td class="${TD} font-medium text-white text-base sm:text-lg">${esc(p.name)}</td>`;
const time = (p, c) => `<td class="${TD} text-right font-mono font-semibold text-base sm:text-xl tracking-wide ${c}">${p.timeMs != null ? fmt(p.timeMs) : "—"}</td>`;
const acts = p => `<td class="${TD} text-right whitespace-nowrap">
  <button data-act="time" data-id="${p.id}" class="btn" title="Время"><i class="fa-regular fa-clock"></i></button>
  <button data-act="del" data-id="${p.id}" class="btn text-red-400" title="Удалить"><i class="fa-solid fa-trash"></i></button></td>`;

// Основной лидерборд: сначала участники с временем по местам, затем все без времени (прочерк)
export function boardRows(list, admin) {
  const rated = list.filter(p => p.timeMs != null).sort((a, b) => a.timeMs - b.timeMs);
  const rows = rated.map((p, i) => {
    const b = BADGE[i];
    const rank = b ? `<span class="w-8 h-8 rounded-lg rank-${b[0]} inline-flex items-center justify-center text-xs"><i class="fa-solid fa-${b[1]}"></i></span>`
      : `<span class="font-mono text-zinc-400 font-semibold">${i + 1}</span>`;
    return `<tr><td class="${TD} text-center">${rank}</td>${idc(p)}${name(p)}${city(p)}${time(p, "t-" + (i < 3 ? i + 1 : 0))}${admin ? acts(p) : ""}</tr>`;
  });
  list.filter(p => p.timeMs == null).forEach(p =>
    rows.push(`<tr><td class="${TD} text-center text-zinc-600">—</td>${idc(p)}${name(p)}${city(p)}${time(p, "t-0")}${admin ? acts(p) : ""}</tr>`));
  return rows.join("") || `<tr><td colspan="6" class="py-10 text-center text-zinc-500">Пока нет результатов</td></tr>`;
}

// Последние 5 добавленных участников
export function recentRows(list, admin, n = 5) {
  const t = p => p.createdAt?.toMillis?.() ?? Date.now();
  return [...list].sort((a, b) => t(b) - t(a)).slice(0, n)
    .map(p => `<tr>${idc(p)}${name(p)}${city(p)}${time(p, "t-0")}${admin ? acts(p) : ""}</tr>`).join("")
    || `<tr><td colspan="5" class="py-8 text-center text-zinc-500">Участников пока нет</td></tr>`;
}

// Следующий порядковый ID = максимальный существующий + 1
export const nextSeq = list => list.reduce((m, p) => Math.max(m, Number(p.seqId) || 0), 0) + 1;
