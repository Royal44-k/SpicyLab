import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const fields = ['monthlyActive','paidShare','price','refundRate','feeRate','variableCostPerActive','fixedMonthlyCost','acquisitionSpend','newPaidCustomers'];
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateScenario(s) {
  if (!s || typeof s.name !== 'string' || !s.name.trim()) throw new Error('scenario.name is required');
  for (const key of fields) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < 0) throw new Error(`${s.name}: ${key} must be a finite non-negative number`);
  }
  for (const key of ['paidShare','refundRate','feeRate']) if (s[key] > 1) throw new Error(`${s.name}: ${key} must be between 0 and 1`);
  const payers = s.monthlyActive * s.paidShare;
  const gross = payers * s.price;
  const net = gross * (1 - s.refundRate);
  const fee = net * s.feeRate;
  const variable = s.monthlyActive * s.variableCostPerActive;
  const contribution = net - fee - variable;
  const costFixedAndAcquisition = s.fixedMonthlyCost + s.acquisitionSpend;
  const contributionPerActive = s.paidShare * s.price * (1-s.refundRate) * (1-s.feeRate) - s.variableCostPerActive;
  const contributionPerPayer = payers > 0 ? contribution / payers : null;
  const cac = s.newPaidCustomers > 0 ? s.acquisitionSpend / s.newPaidCustomers : null;
  return {
    name:s.name, expectedPayingUsers:money(payers), grossSubscriptionRevenue:money(gross), netSubscriptionRevenue:money(net),
    paymentFees:money(fee), variableServiceCost:money(variable), contribution:money(contribution),
    operatingResultBeforeTax:money(contribution - costFixedAndAcquisition),
    breakEvenMonthlyActive:contributionPerActive > 0 ? Math.ceil(costFixedAndAcquisition / contributionPerActive) : null,
    cac:cac === null ? null : money(cac),
    contributionPerPayer:contributionPerPayer === null ? null : money(contributionPerPayer),
    paybackMonths:cac !== null && contributionPerPayer > 0 ? money(cac / contributionPerPayer) : null,
    note:'Conditional monthly model; no forecast, taxes, cash-timing, cohort retention or regulatory conclusion. Null means undefined or not recoverable under these assumptions.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node business-model.mjs scenarios.json');
    const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    if (input.currency !== 'CNY' || input.period !== 'month' || !Array.isArray(input.scenarios) || !input.scenarios.length) throw new Error('Require currency=CNY, period=month and nonempty scenarios');
    console.log(JSON.stringify({currency:input.currency,period:input.period,evidenceType:input.evidenceType ?? 'unspecified',results:input.scenarios.map(calculateScenario)},null,2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
