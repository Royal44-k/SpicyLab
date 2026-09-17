import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const present = v => typeof v === 'string' && v.trim().length > 0;
const allowedUnits = new Set(['g','kg','ml','l','piece']);
const allowedRoles = new Set(['main','side','aromatic','seasoning','other']);
export function auditRecipe(r) {
  const errors = [], warnings = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return {structureValid:false,publicationReady:false,errors:['Recipe must be an object'],warnings:[]};
  for (const key of ['id','version','name','cuisine']) if (!present(r[key])) errors.push(`Missing ${key}`);
  if (!Number.isFinite(r.baseServings) || r.baseServings <= 0) errors.push('baseServings must be positive');
  if (!Array.isArray(r.equipment) || !r.equipment.length || !r.equipment.every(present)) errors.push('equipment must be a nonempty string array');
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  if (!ingredients.length) errors.push('ingredients must be nonempty');
  const ids = new Set();
  for (const i of ingredients) {
    if (!i || typeof i !== 'object') {errors.push('Invalid ingredient');continue;}
    if (!present(i.id) || ids.has(i.id)) errors.push(`Missing or duplicate ingredient ID: ${i.id}`);
    ids.add(i.id);
    if (!present(i.name)) errors.push(`${i.id}: missing name`);
    if (!Number.isFinite(i.amount) || i.amount <= 0) errors.push(`${i.id}: amount must be positive`);
    if (!allowedUnits.has(i.unit)) errors.push(`${i.id}: unsupported/ambiguous unit ${i.unit}; use g/kg/ml/l/piece`);
    if (!allowedRoles.has(i.role)) errors.push(`${i.id}: invalid role`);
    if (typeof i.required !== 'boolean') errors.push(`${i.id}: required must be boolean`);
    if (!present(i.state) || !present(i.preparation)) warnings.push(`${i.id}: state/preparation needs review`);
  }
  const used = new Set(), stepIds = new Set();
  const steps = Array.isArray(r.steps) ? r.steps : [];
  if (!steps.length) errors.push('steps must be nonempty');
  for (const s of steps) {
    if (!s || typeof s !== 'object') {errors.push('Invalid step');continue;}
    if (!present(s.id) || stepIds.has(s.id)) errors.push(`Missing or duplicate step ID: ${s.id}`);
    stepIds.add(s.id);
    for (const k of ['instruction','heat','completionCue']) if (!present(s[k])) errors.push(`${s.id}: missing ${k}`);
    if (!Array.isArray(s.ingredientIds)) errors.push(`${s.id}: ingredientIds must be an array`);
    else for (const id of s.ingredientIds) {if (!ids.has(id)) errors.push(`${s.id}: unknown ingredient ${id}`);used.add(id);}
  }
  for (const i of ingredients) if (i?.required && !used.has(i.id)) errors.push(`${i.id}: required ingredient not used by any step`);
  for (const key of ['allergens','safetyNotes']) if (!Array.isArray(r[key]) || !r[key].length || !r[key].every(present)) errors.push(`${key}: provide explicit reviewed statement, including unknowns`);
  if (!Array.isArray(r.sources) || !r.sources.length) errors.push('sources must be nonempty');
  else for (const s of r.sources) {try{const u=new URL(s?.url);if (!['http:','https:'].includes(u.protocol) || !present(s.supports)) throw new Error();}catch{errors.push('Each source needs an HTTP(S) URL and supports scope');}}
  if (r.review?.status !== 'reviewed' || !present(r.review?.reviewer) || !present(r.review?.reviewedAt)) warnings.push('Human culinary/safety review not recorded');
  if (r.review?.cookTested !== true) warnings.push('No recorded cooking test');
  if (r.image?.status !== 'verified' || !present(r.image?.path)) warnings.push('Image integration not verified');
  warnings.push('This structural audit does not verify food safety, nutrition, source accuracy, image content or cooking feasibility.');
  return {structureValid:errors.length===0,publicationReady:false,errors,warnings};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node audit-recipe.mjs recipe.json');
    const report = auditRecipe(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(report,null,2));
    if (!report.structureValid) process.exitCode = 1;
  } catch (error) {console.error(error.message);process.exitCode=1;}
}
