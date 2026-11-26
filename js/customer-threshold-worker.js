'use strict';

importScripts('cost-reference.js', 'price-model.js', 'live-model.js?v=cafe-plan-2',
  'supplies-finance.js?v=cafe-plan-2', 'funding-model.js', 'results-model.js?v=cafe-plan-2');

// Compare paying customers, with the same purchase mix and quantity per buyer.
function conditions(state, context, priceFactor, addedCostPoints, addedTax) {
  const inputs = {...state, rampMode: 'steady', capacityMode: 'limit',
    unitsPerGuest: String(Math.max(1, Number(state.unitsPerGuest))),
    taxMonthly: String(Number(state.taxMonthly) + addedTax)};
  if (state.revenueMode === 'average') {
    inputs.averageTicket = String(Number(state.averageTicket) * priceFactor);
    inputs.costPercent = String(Number(state.costPercent) + addedCostPoints);
    return {inputs, context};
  }
  const prices = new Map(context.menus.map(menu => [menu.id, menu.price * priceFactor]));
  inputs.menus = state.menus.map(menu => ({...menu,
    cost: String(Number(menu.cost) * priceFactor + prices.get(menu.id) * addedCostPoints / 100)}));
  return {inputs, context: {...context, menus: context.menus.map(menu => ({...menu, price: prices.get(menu.id)}))}};
}

function firstYearCoversLivingCosts(result) {
  return result.rows.slice(1, 13).every(month => month.change >= -1e-7);
}

function minimumBuyers({inputs, context}, meetsGoal = firstYearCoversLivingCosts, summarize = () => ({})) {
  const plan = ResultsModel.demandPlan(inputs, context);
  if (!plan.known) return {reason: '영업시간 확인 필요'};
  const limit = Math.min(10000, Math.ceil(plan.cap));
  let result;
  // Stock purchases come in packs, so monthly cash need not rise monotonically.
  for (let count = 0; count <= limit; count++) {
    result = ResultsModel.calculate({...inputs, dailyGuests: String(count)}, context);
    if (!result?.recurringComplete) return {reason: '비용·입력 확인 필요'};
    if (meetsGoal(result)) return {count, ...summarize(result)};
  }
  return {reason: plan.cap > 10000 ? '입력 범위 내 달성 불가' : '처리 상한 내 달성 불가',
    atLimit: summarize(result), cap: result.demand.months[11].served, averageNet: result.averageNet,
    worstMonth: Math.min(...result.rows.slice(1, 13).map(month => month.change))};
}

function sixMonthGrowth(scenario) {
  Object.assign(scenario.inputs, {rampMode: 'gradual', rampStart: '60', rampMonths: '6'});
  return minimumBuyers(scenario, result => result.averageNet >= -1e-7, result => {
    let cumulative = 0, lowest = 0, lowMonth = 0;
    const months = result.rows.slice(1, 7).map(month => {
      cumulative += month.change;
      if (cumulative < lowest) {
        lowest = cumulative;
        lowMonth = month.month;
      }
      return {month: month.month, guests: month.guests, change: month.change, cumulative};
    });
    return {reserve: Math.ceil(-lowest), lowMonth, months, averageNet: result.averageNet};
  });
}

self.onmessage = ({data: {state, context}}) => {
  const scenarios = [[1, 0, 0], [.9, 0, 0], [1, 5, 0], [1, 0, 30], [.9, 5, 30]];
  const steady = scenarios.map(args => minimumBuyers(conditions(state, context, ...args)));
  const growthScenarios = [[1, 0, 0], [.9, 0, 0], [1, 5, 0], [.9, 5, 0]];
  const growth = growthScenarios.map(args => sixMonthGrowth(conditions(state, context, ...args)));
  self.postMessage({steady, growth});
};
