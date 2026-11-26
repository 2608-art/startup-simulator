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

function minimumBuyers({inputs, context}) {
  const plan = ResultsModel.demandPlan(inputs, context);
  if (!plan.known) return {reason: '영업시간 확인 필요'};
  const limit = Math.min(10000, Math.floor(plan.cap + 1e-8));
  // Buying a fresh pack can make an individual month worse at a higher volume.
  // Check consecutive counts rather than assuming monthly cash is monotonic.
  for (let count = 0; count <= limit; count++) {
    const result = ResultsModel.calculate({...inputs, dailyGuests: String(count)}, context);
    if (!result?.recurringComplete) return {reason: '비용·입력 확인 필요'};
    if (result.rows.slice(1, 13).every(month => month.change >= -1e-7)) return {count};
  }
  const atCap = ResultsModel.calculate({...inputs, dailyGuests: String(Math.min(10000, Math.ceil(plan.cap)))}, context);
  return {reason: limit === 10000 ? '입력 범위 내 달성 불가' : '처리 상한 내 달성 불가',
    cap: atCap.demand.months[0].served, averageNet: atCap.averageNet};
}

self.onmessage = ({data: {state, context}}) => {
  const scenarios = [[1, 0, 0], [.9, 0, 0], [1, 5, 0], [1, 0, 30], [.9, 5, 30]];
  self.postMessage(scenarios.map(args => minimumBuyers(conditions(state, context, ...args))));
};
