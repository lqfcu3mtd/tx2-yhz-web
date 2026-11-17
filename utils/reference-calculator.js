/** Shared archived simulator model for browser, Node and WeChat. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reference-data'));
  else root.PearlCalculator = factory(root.PearlData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
'use strict';

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    const labels = {growth:'成长',totalPointNum:'珠种基础总点',energyLevel:'能量等级',fusionA:'A珠融合点',fusionB:'B珠融合点',startLevel:'起始等级',targetLevel:'目标等级',star:'星级'};
    throw new RangeError((labels[label] || label) + '须为' + min + '～' + max + '的整数');
  }
  return value;
}

function getPearl(id) {
  const pearl = data.pearls.find(p => p.id === id);
  if (!pearl) throw new RangeError('Unknown supported pearl id: ' + id);
  return pearl;
}

// Source simulation.js ct: level 1 gives zero; sum segments 1..energyLevel-1.
// Preserve source operation order because flooring is sensitive to rounding.
function calcAllocPoints(growth, totalPointNum, energyLevel) {
  integer(growth, 800, 1300, 'growth');
  integer(totalPointNum, 1, 10000, 'totalPointNum');
  integer(energyLevel, 1, 80, 'energyLevel');
  let total = 0;
  for (let level = 1; level < energyLevel; level++) {
    const base = growth / 1300 * (totalPointNum / 100 * 0.3 + 1.8);
    const upper = Math.pow(level + 1 + 2.2, 1.45) / 2;
    const lower = Math.pow(level + 2.2, 1.45) / 2;
    total += Math.floor(base * (upper - lower));
  }
  return total;
}

// The archived simulator selects one pearl species for both input panels.
// This function calculates points only; it does not certify game eligibility.
function canFuse(pearlId, allowFiveStarFusion = false) {
  const pearl = getPearl(pearlId);
  return pearl.star < 5 || (pearl.star === 5 && allowFiveStarFusion === true);
}

function calcFusionPoints(pearlId, a, b, rules = {}) {
  const pearl = getPearl(pearlId);
  if (!canFuse(pearlId, rules.allowFiveStarFusion)) {
    throw new RangeError(pearl.star >= 6 ? '6星元魂珠不能参与融合' : '当前服务器规则不允许5星元魂珠参与融合，请核对5星融合开关');
  }
  const allocA = calcAllocPoints(a.growth, pearl.totalPointNum, a.energyLevel);
  const allocB = calcAllocPoints(b.growth, pearl.totalPointNum, b.energyLevel);
  integer(a.fusion, 0, 1500, 'fusionA');
  integer(b.fusion, 0, 1500, 'fusionB');
  return {
    allocA, allocB,
    totalA: allocA + a.fusion,
    totalB: allocB + b.fusion,
    fusionPoint: Math.floor((allocA + a.fusion + allocB + b.fusion) / 4),
    growth: Math.max(a.growth, b.growth)
  };
}

function calcRequired(startLevel, targetLevel, field) {
  integer(startLevel, 1, 80, 'startLevel');
  integer(targetLevel, startLevel, 80, 'targetLevel');
  let required = 0;
  for (let level = startLevel; level < targetLevel; level++) {
    required += data.levels[level - 1][field];
  }
  return required;
}

function calcExperience(startLevel, targetLevel) {
  return calcRequired(startLevel, targetLevel, 'experience');
}

function calcConsumption(startLevel, targetLevel, propIndex) {
  const prop = data.props[propIndex];
  if (!prop || ![0, 1].includes(prop.type) || prop.experience <= 0) {
    throw new RangeError('Select an experience or energy consumable');
  }
  const field = prop.type === 0 ? 'experience' : 'energy';
  const required = calcRequired(startLevel, targetLevel, field);
  return { required, count: Math.ceil(required / prop.experience), prop };
}

// Raw prices are yuanbao in the archived simulator, not gold market prices.
function calcItemCost(star, mode) {
  integer(star, 1, 5, 'star');
  if (!['none', 'up', 'keep'].includes(mode)) throw new RangeError('Invalid item mode');
  if (star < 3 && mode !== 'none') throw new RangeError('3星以下不使用升星丹或保星丹');
  const starName = ['一星', '二星', '三星', '四星', '五星'][star - 1];
  const fusion = data.props.find(p => p.type === 4 && p.star === starName).money;
  const optionalType = mode === 'up' ? 2 : mode === 'keep' ? 3 : null;
  const optional = optionalType === null ? 0 : data.props.find(p => p.type === optionalType && p.star === starName).money;
  return { fusion, optional, totalYuanbao: fusion + optional };
}

return { data, getPearl, canFuse, calcAllocPoints, calcFusionPoints, calcExperience, calcConsumption, calcItemCost };
});
