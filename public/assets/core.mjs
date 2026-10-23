/** Deterministic adult calculator. Values are estimates from a deterministic calculation. */
export function normalizeNumber(value) {
  return String(value ?? '').trim()
    .replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
    .replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
    .replace(/[٫,،]/g, '.');
}
export function parseNumber(value) {
  const normalized = normalizeNumber(value);
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) ? Number(normalized) : NaN;
}
export function calculateTarget({male, age, w, h, act, goal}) {
  if (!Number.isInteger(age) || age < 18 || age > 90) throw new RangeError('العمر يجب أن يكون عدداً صحيحاً من 18 إلى 90 سنة. الحاسبة للبالغين فقط.');
  if (!Number.isFinite(w) || w < 35 || w > 250) throw new RangeError('الوزن يجب أن يكون من 35 إلى 250 كجم.');
  if (!Number.isFinite(h) || h < 120 || h > 230) throw new RangeError('الطول يجب أن يكون من 120 إلى 230 سم.');
  if (![1.2,1.375,1.55,1.725,1.9].includes(act) || ![0.8,1,1.1].includes(goal) || typeof male !== 'boolean') throw new RangeError('اختر النشاط والهدف من الخيارات المتاحة.');
  const bmr = 10*w+6.25*h-5*age+(male?5:-161);
  const tdee = bmr*act;
  if (bmr <= 0 || tdee <= 0) throw new RangeError('هذه المدخلات لا تسمح بتقدير معقول؛ راجع مختصاً.');
  const floor = male ? 1500 : 1200;
  const kcal = Math.max(floor,tdee*goal);
  // Cap protein energy so heavy bodyweights cannot produce macros above total energy.
  const p = Math.min(2*w,kcal*0.35/4), f = kcal*0.25/9, c = (kcal-p*4-f*9)/4;
  const bmi = w/((h/100)**2);
  return {kcal,p,c,f,w,bmr,tdee,limited:kcal>tdee*goal,review:bmi<18.5||bmi>=35};
}
export const finiteNutrient = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000;
export function validEntry(entry) {
  return entry && typeof entry === 'object' && typeof entry.n === 'string' && entry.n.length <= 500 && typeof entry.u === 'string' && entry.u.length <= 120 && ['k','p','c','f'].every(k=>finiteNutrient(entry[k])) && Number.isFinite(entry.q) && entry.q>=0.001 && entry.q<=10000;
}
export function safeDiary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([date,rows])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Array.isArray(rows)).map(([date,rows])=>[date,rows.filter(validEntry).map(x=>({...x,b:[x.k/x.q,x.p/x.q,x.c/x.q,x.f/x.q]})).filter(x=>x.b.every(finiteNutrient))]));
}
export function safeWeights(value) {
  return Array.isArray(value) ? value.filter(x=>x&&typeof x.d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.d)&&Number.isFinite(x.w)&&x.w>=30&&x.w<=300) : [];
}
export function safeTarget(value) {
  if (!value || typeof value !== 'object' || !['kcal','p','c','f','w'].every(k=>Number.isFinite(value[k])&&value[k]>=0)) return null;
  const {kcal,p,c,f,w}=value;
  if(kcal<1000||kcal>15000||w<35||w>250||p<=0||f<=0||p>1000||c>3000||f>1000) return null;
  const energy=4*p+4*c+9*f;
  return Math.abs(energy-kcal)<=Math.max(10,kcal*.01) ? value : null;
}
