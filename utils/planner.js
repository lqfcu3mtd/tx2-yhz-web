(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reference-calculator'));
  else root.PearlPlanner = factory(root.PearlCalculator);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (calc) {
  'use strict';
  const energyIndex = calc.data.props.findIndex(p => p.type === 1);
  const minimums = { 3: 27, 4: 37, 5: 42 };
  const MAX_OWNED = 4;
  const emptyTotals = () => ({juling:0,experience:0,pearls:0,yuanbao:0});
  function number(value, min, max, name, integral) {
    if (!Number.isFinite(value) || value < min || value > max || (integral && !Number.isInteger(value))) {
      throw new RangeError(name + '须为' + min + '～' + max + (integral ? '的整数' : '的数字'));
    }
    return value;
  }
  function nextPearl(pearl) {
    const next = calc.data.pearls.find(p => p.id === pearl.upgradeId);
    if (!next || next.star !== pearl.star + 1 || next.schoolId !== pearl.schoolId) {
      throw new RangeError('珠种升级数据异常，请更换珠种或核对数据');
    }
    return next;
  }
  function settings(input) {
    const o = Object.assign({ maxDepth: 8, targetGeneration: null, targetLevel: 1, targetEnergy: 1, allowFiveStarFusion: false, minLevels: minimums, ownedBeads: [] }, input);
    if (typeof o.allowFiveStarFusion !== 'boolean') throw new RangeError('5星融合开关须为布尔值');
    number(o.baseId, 1, 99999, '原料珠种', true);
    if (calc.getPearl(o.baseId).star !== 3) throw new RangeError('规划原料须为3星珠');
    number(o.targetStar, 3, 5, '目标星级', true);
    if (o.targetGeneration !== null) number(o.targetGeneration, 0, 2, '目标代数', true);
    number(o.targetFusion, 1, 1500, '目标融合点', true);
    number(o.growth, 800, 1300, '成长', true);
    number(o.charLevel, 1, 80, '人物等级', true);
    number(o.maxDepth, 1, 8, '融合层数', true);
    for (const [key,label] of [['jlPrice','聚能丹单价'],['expPrice','每1000万经验金币价格'],['basePrice','原料单价'],['yuanbaoGold','元宝折算金币']]) number(o[key], 0, 1e9, label, false);
    for (const star of [3,4,5]) number(o.minLevels[star], 1, 80, star + '星最低融合能量', true);
    o.maxEnergy = Math.min(80, o.charLevel + 5);
    number(o.targetLevel, 1, o.maxEnergy, '成品目标等级', true);
    number(o.targetEnergy, 1, o.targetLevel, '成品聚能等级（不能高于目标等级）', true);
    if (!Array.isArray(o.ownedBeads) || o.ownedBeads.length > MAX_OWNED) throw new RangeError('最多可录入'+MAX_OWNED+'颗已有元魂珠');
    o.ownedBeads = Array.from(o.ownedBeads,(bead,index) => {
      const name = '已有珠 #'+(index+1)+' 的';
      if (!bead || typeof bead !== 'object') throw new RangeError(name+'信息不完整');
      const {star,generation,growth,fusionPoints,level,energyLevel} = bead;
      number(star, 3, 5, name+'星级', true);
      number(generation, 0, 99, name+'代数', true);
      number(growth, 800, 1300, name+'成长', true);
      number(fusionPoints, 0, 1500, name+'融合点', true);
      number(level, 1, 80, name+'等级', true);
      number(energyLevel, 1, level, name+'聚能等级（不能高于当前等级）', true);
      return {star,generation,growth,fusionPoints,level,energyLevel};
    });
    return o;
  }
  function totalGold(t, o) {
    return t.juling * o.jlPrice + t.experience / 1e7 * o.expPrice + t.pearls * o.basePrice + t.yuanbao * o.yuanbaoGold;
  }
  function feeding(o) {
    const tables = new Map();
    const resource = [null];
    for(let level=1;level<=80;level++) resource[level] = {
      experience:calc.calcExperience(1,level),
      energy:calc.calcConsumption(1,level,energyIndex).required
    };
    const perPill = calc.data.props[energyIndex].experience;
    function alloc(p,growth,level) {
      const key = p.id+':'+growth;
      if (!tables.has(key)) {
        const rows = [];
        for(let n=1;n<=80;n++) rows[n]=calc.calcAllocPoints(growth,p.totalPointNum,n);
        tables.set(key,rows);
      }
      return tables.get(key)[level];
    }
    return (node,level,energy) => {
      const startLevel = node.level || 1, startEnergy = node.energyLevel || 1;
      const juling = Math.ceil((resource[energy].energy-resource[startEnergy].energy)/perPill);
      const experience = resource[level].experience-resource[startLevel].experience;
      return {startLevel,startEnergy,level,energy,juling,experience,alloc:alloc(node.pearl,node.growth,energy),gold:juling*o.jlPrice+experience/1e7*o.expPrice};
    };
  }
  function reaches(state,o) {
    return state.pearl.star===o.targetStar && state.fusion>=o.targetFusion &&
      (o.targetGeneration===null || state.generation===o.targetGeneration);
  }
  function finish(state,depth,o,feed,usedOwned,tree) {
    const finalFeed=feed(state,Math.max(o.targetLevel,state.level||1),Math.max(o.targetEnergy,state.energyLevel||1));
    const totals=Object.assign({},state.totals,{
      juling:state.totals.juling+finalFeed.juling,
      experience:state.totals.experience+finalFeed.experience
    });
    return Object.assign({},state,{
      depth,options:o,usedOwned,tree,finalFeed,finalTotalPoints:state.fusion+finalFeed.alloc,
      fusionTotals:state.totals,fusionGold:state.gold,totals,gold:totalGold(totals,o)
    });
  }
  // All-fresh recipes remain symmetric. Keep the exact levels and fusion points
  // so the original route display and the inventory search can both use them.
  function symmetricLayers(o,base,feed) {
    const layers = [[{pearl:base,fusion:0,generation:0,growth:o.growth,totals:{...emptyTotals(),pearls:1},gold:o.basePrice,scheme:[]}]];
    const tables = new Map();
    function table(p) {
      if (!tables.has(p.id)) {
        const rows = [];
        for (let level = 1; level <= o.maxEnergy; level++) rows[level]=feed({pearl:p,growth:o.growth},level,level);
        tables.set(p.id, rows);
      }
      return tables.get(p.id);
    }
    for (let depth = 1; depth <= o.maxDepth; depth++) {
      const winners = new Map();
      for (const child of layers[depth-1]) {
        const p = child.pearl;
        if (!calc.canFuse(p.id, o.allowFiveStarFusion)) continue;
        const modes = [];
        // User-confirmed rule: no keep item at input generation >= 2.
        // Do not confuse this item limit with a global fusion-depth limit.
        if (child.generation < 2) modes.push({mode:'keep',out:p,generation:child.generation+1});
        if (p.star < o.targetStar) modes.push({mode:'up',out:nextPearl(p),generation:0});
        for (let level = o.minLevels[p.star]; level <= o.maxEnergy; level++) {
          const feed = table(p)[level];
          const fusion = Math.floor((feed.alloc + child.fusion) / 2);
          for (const m of modes) {
            const cost = calc.calcItemCost(p.star, m.mode);
            const t = {
              juling:2*(child.totals.juling+feed.juling),
              experience:2*(child.totals.experience+feed.experience),
              pearls:2*child.totals.pearls,
              yuanbao:2*child.totals.yuanbao+cost.totalYuanbao
            };
            const gold = totalGold(t, o), key = [m.out.id,fusion,m.generation].join(':');
            const old = winners.get(key);
            if (old && old.gold <= gold) continue;
            winners.set(key, {
              pearl:m.out, fusion, generation:m.generation, growth:o.growth, totals:t, gold,
              scheme:child.scheme.concat({
                inputId:p.id, outputId:m.out.id, starIn:p.star, starOut:m.out.star,
                fusionIn:child.fusion, fusionOut:fusion, generationIn:child.generation,
                generationOut:m.generation, energyLv:level, mode:m.mode,
                julingPer:feed.juling, experiencePer:feed.experience,
                itemYuanbao:cost.totalYuanbao
              })
            });
          }
        }
      }
      if (!winners.size) break;
      layers.push(Array.from(winners.values()));
    }
    return layers;
  }

  function leaf(pearl,growth,fusion,generation,level,energyLevel,ownedNumber,o) {
    const totals={...emptyTotals(),pearls:ownedNumber===null?1:0};
    return {pearl,growth,fusion,generation,level,energyLevel,ownedNumber,depth:0,totals,gold:totalGold(totals,o),merge:null};
  }
  function merge(pearl,growth,generation,fusion,mode,itemYuanbao,inputs,o) {
    const totals={...emptyTotals(),yuanbao:itemYuanbao};
    for(const {node,feed} of inputs) {
      totals.pearls+=node.totals.pearls;
      totals.juling+=node.totals.juling+feed.juling;
      totals.experience+=node.totals.experience+feed.experience;
      totals.yuanbao+=node.totals.yuanbao;
    }
    return {pearl,growth,generation,fusion,level:1,energyLevel:1,ownedNumber:null,
      depth:1+Math.max(inputs[0].node.depth,inputs[1].node.depth),totals,gold:totalGold(totals,o),merge:{mode,itemYuanbao,inputs}};
  }
  // An inventory entry is a unique bit. Only disjoint branches can be paired.
  // Subtrees consuming no inventory use the original symmetric recipes.
  function inventoryPlans(o,base,feed,layers) {
    const species={3:base};
    function pearlAt(star) {
      if(!species[star])species[star]=nextPearl(pearlAt(star-1));
      return species[star];
    }
    const initial=o.ownedBeads.map((b,i) => ({mask:1<<i,node:leaf(pearlAt(b.star),b.growth,b.fusionPoints,b.generation,b.level,b.energyLevel,i+1,o)}));
    const trees=new WeakMap(),items=new Map(),feeds=new Map();
    function freshTree(state) {
      if(trees.has(state))return trees.get(state);
      let node=leaf(base,o.growth,0,0,1,1,null,o);
      for(const step of state.scheme) {
        const input={node,feed:feed(node,step.energyLv,step.energyLv)};
        node=merge(pearlAt(step.starOut),o.growth,step.generationOut,step.fusionOut,step.mode,step.itemYuanbao,[input,input],o);
      }
      trees.set(state,node);
      return node;
    }
    function itemCost(star,mode) {
      const key=star+':'+mode;
      if(!items.has(key))items.set(key,calc.calcItemCost(star,mode).totalYuanbao);
      return items.get(key);
    }
    const keyOf = (mask,p,growth,generation) => [mask,p.id,growth,generation].join(':');
    function group(groups,mask,pearl,growth,generation) {
      const key=keyOf(mask,pearl,growth,generation);
      if(!groups.has(key))groups.set(key,{mask,pearl,growth,generation,offers:[]});
      return groups.get(key);
    }
    // Greater input score is always at least as useful for a minimum-point
    // target. Within identical rule state, keep only useful price/score pairs.
    function frontier(offers) {
      const keeps=[];
      let lowest=Infinity;
      for(let score=offers.length-1;score>=0;score--) {
        const offer=offers[score];
        if(offer && offer.gold<lowest) {keeps.push(offer);lowest=offer.gold;}
      }
      return keeps;
    }
    function addFeeding(groups,mask,node) {
      const p=node.pearl,star=p.star;
      if(star>o.targetStar || !calc.canFuse(p.id,o.allowFiveStarFusion) || (star===o.targetStar && node.generation>=2))return;
      const startLevel=node.level||1,startEnergy=node.energyLevel||1;
      const key=[p.id,node.growth,startLevel,startEnergy].join(':');
      if(!feeds.has(key)) {
        const options=[];
        for(let energy=Math.max(o.minLevels[star],startEnergy);energy<=Math.max(o.maxEnergy,startEnergy);energy++) {
          options.push(feed(node,Math.max(energy,startLevel),energy));
        }
        feeds.set(key,options);
      }
      const options=feeds.get(key);
      if(!options.length)return;
      const {offers}=group(groups,mask,p,node.growth,node.generation);
      for(const extra of options) {
        const score=node.fusion+extra.alloc, gold=node.gold+extra.gold;
        if(!offers[score] || gold<offers[score].gold) offers[score]={score,gold,node,feed:extra};
      }
    }
    function fusionBuckets(offers) {
      // With A fixed, multiple B scores can give the same floored result.
      // A's score mod 4 determines those bins. Keep the cheapest B per bin.
      return [0,1,2,3].map(remainder => {
        const bins=[];
        let last=-1;
        for(const offer of offers) {
          const bin=Math.floor((offer.score+remainder)/4);
          if(bin===last)bins[bins.length-1]={bin,offer};
          else bins.push({bin,offer});
          last=bin;
        }
        return bins;
      });
    }
    function bestAtDepth(entries,depth,plans) {
      let best=null;
      for(const {mask,node} of entries) {
        if(!reaches(node,o))continue;
        const usedOwned=[];
        for(let i=0;i<o.ownedBeads.length;i++)if(mask & (1<<i))usedOwned.push(i+1);
        const plan=finish(node,depth,o,feed,usedOwned,node);
        if(!best || plan.gold<best.gold)best=plan;
      }
      if(best)plans.push(best);
    }
    const plans=[], allFeeding=new Map();
    let previous=initial;
    bestAtDepth(previous,0,plans);
    for(let depth=1;depth<=o.maxDepth;depth++) {
      const exact=new Map();
      for(const state of layers[depth-1]||[])addFeeding(exact,0,state);
      for(const {mask,node} of previous)addFeeding(exact,mask,node);
      if(!exact.size)break;
      for(const g of exact.values()) {
        const any=group(allFeeding,g.mask,g.pearl,g.growth,g.generation);
        const options=frontier(g.offers);
        for(const a of options)if(!any.offers[a.score] || a.gold<any.offers[a.score].gold)any.offers[a.score]=a;
        any.buckets=fusionBuckets(frontier(any.offers));
        g.good=options;
      }
      const winners=new Map();
      // One branch uses exactly depth-1 layers, the other may be shallower.
      for(const a of exact.values())for(const b of allFeeding.values()) {
        const mask=a.mask|b.mask;
        if(!mask || (a.mask&b.mask) || a.pearl.id!==b.pearl.id)continue;
        const star=a.pearl.star,growth=Math.max(a.growth,b.growth),gen=Math.max(a.generation,b.generation);
        const modes=[];
        if(gen<2)modes.push(['keep',a.pearl,gen+1]);
        if(star<o.targetStar)modes.push(['up',pearlAt(star+1),0]);
        for(const [mode,out,generation] of modes) {
          const dst=group(winners,mask,out,growth,generation);
          const itemYuanbao=itemCost(star,mode),itemGold=itemYuanbao*o.yuanbaoGold;
          for(const x of a.good) {
            const bins=b.buckets[x.score%4],baseFusion=Math.floor(x.score/4),baseGold=x.gold+itemGold;
            for(const {bin,offer:y} of bins) {
              const fusion=baseFusion+bin,gold=baseGold+y.gold;
              if(!dst.offers[fusion] || gold<dst.offers[fusion].gold)dst.offers[fusion]={score:fusion,gold,x,y,mode,itemYuanbao};
            }
          }
        }
      }
      previous=[];
      for(const {mask,pearl,growth,generation,offers} of winners.values())for(const w of frontier(offers)) {
        const inputs=[w.x,w.y].map(x=>({node:x.node.scheme?freshTree(x.node):x.node,feed:x.feed}));
        previous.push({mask,node:merge(pearl,growth,generation,w.score,w.mode,w.itemYuanbao,inputs,o)});
      }
      bestAtDepth(previous,depth,plans);
    }
    return plans.sort((a,b)=>a.gold-b.gold||a.depth-b.depth);
  }

  function generatePlans(input) {
    const o=settings(input),base=calc.getPearl(o.baseId),feed=feeding(o),layers=symmetricLayers(o,base,feed);
    if (o.ownedBeads.length) return inventoryPlans(o,base,feed,layers);
    const plans=[];
    for(let depth=1;depth<layers.length;depth++) {
      let best = null;
      for(const state of layers[depth]) if(reaches(state,o)&&(!best||state.gold<best.gold))best=state;
      if(best)plans.push(finish(best,depth,o,feed,[],null));
    }
    return plans.sort((a,b) => a.gold-b.gold || a.depth-b.depth);
  }
  return { generatePlans, settings, nextPearl, energyIndex, minimums, totalGold, MAX_OWNED };
});
