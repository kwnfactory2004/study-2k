export const KINDS = { g: 'ガソリン', d: 'ジーゼル', c: 'シャシ', s: '総合（旧問題まとめ）' };
// 総合は、旧制度のガソリン・ジーゼル・シャシの問題をまとめて解くための枠（令和9年からの新試験の中身はまだ未発表）
const OLD_KINDS = ['g', 'd', 'c'];
const ALL_FIELDS = ['エンジン', 'シャシ・電装', '基礎知識', '法規'];
export const sourceKinds = (kind) => (kind === 's' ? OLD_KINDS : [kind]);
// 分野は問題番号の範囲で決まる（[分野名, その分野の最後の番号]）
const FIELD_RANGES = {
  g: [['エンジン', 15], ['シャシ・電装', 30], ['基礎知識', 35], ['法規', 40]],
  d: [['エンジン', 15], ['シャシ・電装', 30], ['基礎知識', 35], ['法規', 40]],
  c: [['シャシ・電装', 20], ['基礎知識', 25], ['法規', 30]],
};
export const EXAM_INFO = { g: { questions: 40, minutes: 80 }, d: { questions: 40, minutes: 80 }, c: { questions: 30, minutes: 60 }, s: null };
export const CUTOFF = 0.7; // 合格の目安（公式には公表されていない）
const ERAS = { H: '平成', R: '令和' };
const NEWEST_OLD_EXAM = 'R02-2'; // これ以前は法改正などで今の答えと違うことがある

export const fieldsOf = (kind) => (kind === 's' ? ALL_FIELDS : FIELD_RANGES[kind].map(([name]) => name));

export function examLabel(exam) {
  const [year, round] = exam.split('-');
  const n = Number(year.slice(1));
  return `${ERAS[year[0]]}${n === 1 ? '元' : n}年度 第${round}回`;
}

export const isOldYear = (exam) => exam.localeCompare(NEWEST_OLD_EXAM) <= 0;

// 暗号化ファイルの単位は「種類＋試験回」
export const unitId = (kind, exam) => `${kind}_${exam}`;
export const parseUnit = (unit) => {
  const [kind, exam] = unit.split('_');
  return { kind, exam };
};
// 選んだ種類と試験回で開く暗号化ファイルの一覧（総合は3種類ぶんを集める）
export const unitsOf = (kind, exam, available) =>
  sourceKinds(kind).map((k) => unitId(k, exam)).filter((u) => available.includes(u));

export function fieldOf(kind, no) {
  return FIELD_RANGES[kind].find(([, last]) => no <= last)[0];
}

export function questionId(question) {
  return `${question.kind}-${question.year}-${String(question.no).padStart(2, '0')}`;
}

export function setupError({ fields, years }) {
  if (fields.length === 0) return '分野を選んでください';
  if (years.length === 0) return '試験回を選んでください';
  return '';
}

// 解説に「要確認」の印をつけた問題の一覧
export function toggleFlag(flags, id) {
  return flags.includes(id) ? flags.filter((f) => f !== id) : [...flags, id].sort();
}

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildQueue(questions, { fields, years, order, wrongOnly }, records, rng) {
  const picked = questions.filter((q) =>
    fields.includes(q.field) &&
    years.includes(q.year) &&
    (!wrongOnly || records[questionId(q)]?.last === false));
  picked.sort((a, b) => a.year.localeCompare(b.year) || a.no - b.no);
  return order === 'random' ? shuffled(picked, rng) : picked;
}

// 全員正解の問題（answer が null）は記録しない
export function recordAnswer(records, question, choice) {
  if (question.answer === null) return records;
  const id = questionId(question);
  const old = records[id] ?? { a: 0, c: 0 };
  const correct = choice === question.answer;
  return { ...records, [id]: { a: old.a + 1, c: old.c + (correct ? 1 : 0), last: correct } };
}

export function fieldStats(records, kind) {
  const stats = Object.fromEntries(fieldsOf(kind).map((f) => [f, { attempts: 0, correct: 0 }]));
  for (const [id, { a, c }] of Object.entries(records)) {
    const parts = id.split('-'); // 例: g-R07-2-05
    if (!sourceKinds(kind).includes(parts[0])) continue;
    const stat = stats[fieldOf(parts[0], Number(parts[3]))];
    stat.attempts += a;
    stat.correct += c;
  }
  for (const stat of Object.values(stats)) {
    stat.rate = stat.attempts ? stat.correct / stat.attempts : null;
    stat.belowCutoff = stat.rate !== null && stat.rate < CUTOFF;
  }
  return stats;
}
