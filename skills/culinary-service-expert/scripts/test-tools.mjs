import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateScenario} from './business-model.mjs';
import {auditRecipe} from './audit-recipe.mjs';

const business=JSON.parse(fs.readFileSync(new URL('../assets/examples/business-scenarios.json',import.meta.url),'utf8'));
const recipe=JSON.parse(fs.readFileSync(new URL('../assets/examples/recipe-record.json',import.meta.url),'utf8'));
test('base model includes refund, payment fees, free-user cost and acquisition spend',()=>{
  const r=calculateScenario(business.scenarios[1]);
  assert.equal(r.expectedPayingUsers,300);assert.equal(r.netSubscriptionRevenue,5529);
  assert.equal(r.paymentFees,165.87);assert.equal(r.variableServiceCost,2000);
  assert.equal(r.operatingResultBeforeTax,-22636.87);assert.equal(r.cac,100);
  assert.equal(r.breakEvenMonthlyActive,77309);
});
test('zero paying users does not divide by zero or claim recoverability',()=>{
  const r=calculateScenario({...business.scenarios[0],paidShare:0,newPaidCustomers:0});
  assert.equal(r.cac,null);assert.equal(r.contributionPerPayer,null);assert.equal(r.paybackMonths,null);assert.equal(r.breakEvenMonthlyActive,null);
});
test('negative unit contribution is not repaired by scale',()=>{
  const r=calculateScenario({...business.scenarios[0],variableCostPerActive:100});
  assert.equal(r.breakEvenMonthlyActive,null);assert.equal(r.paybackMonths,null);
});
test('invalid percentages and nonfinite inputs are rejected',()=>{
  assert.throws(()=>calculateScenario({...business.scenarios[0],paidShare:3}));
  assert.throws(()=>calculateScenario({...business.scenarios[0],price:NaN}));
  assert.throws(()=>calculateScenario({...business.scenarios[0],monthlyActive:-1}));
});
test('recipe sample is structurally valid but never certified for publication',()=>{
  const r=auditRecipe(recipe);assert.equal(r.structureValid,true);assert.equal(r.publicationReady,false);assert.ok(r.warnings.length>=4);
});
test('unknown step ingredients and unconsumed required ingredients are found',()=>{
  const r=structuredClone(recipe);r.steps[0].ingredientIds.push('missing-salt');r.ingredients.push({...r.ingredients[0],id:'extra'});
  const result=auditRecipe(r);assert.equal(result.structureValid,false);assert.ok(result.errors.some(e=>e.includes('missing-salt')));assert.ok(result.errors.some(e=>e.includes('not used')));
});
test('duplicate IDs, negative quantities and ambiguous spoon units are rejected',()=>{
  const r=structuredClone(recipe);r.ingredients.push({...r.ingredients[0],amount:-3,unit:'spoon'});
  const result=auditRecipe(r);assert.equal(result.structureValid,false);assert.ok(result.errors.length>=3);
});
test('empty and malformed structures return actionable failures',()=>{
  assert.equal(auditRecipe(null).structureValid,false);assert.equal(auditRecipe({}).structureValid,false);
  const r=structuredClone(recipe);r.steps=[null];r.sources=[null];assert.equal(auditRecipe(r).structureValid,false);
});
