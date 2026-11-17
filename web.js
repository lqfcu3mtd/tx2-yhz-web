'use strict';
const calc = PearlCalculator, planner = PearlPlanner;
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function options(el, rows, value, label) {
  el.innerHTML = rows.map(row => `<option value="${value(row)}">${esc(label(row))}</option>`).join('');
}
const schoolName = id => calc.data.schools.find(p => p.id === id).name;
options($('school'), calc.data.schools, p => p.id, p => p.name);
$('school').value = '1';
function updateSpecies() {
  options($('species'), calc.data.pearls.filter(p => p.schoolId === Number($('school').value) && p.star <= 5).sort((a,b) => a.star-b.star), p => p.id, p => `${p.name} · ${p.star}星`);
  speciesChanged();
}
function speciesChanged() {
  const p = calc.getPearl(Number($('species').value));
  $('speciesInfo').textContent = `基础总点 ${p.totalPointNum} · 星级由珠种确定`;
  $('itemMode').value = 'none';
  for (const option of $('itemMode').options) option.disabled = p.star < 3 && option.value !== 'none';
  updateEstimates();
}
$('pearlInputs').innerHTML = ['A','B'].map(side => `<div class="card"><h3>珠子 ${side}</h3><div class="form-grid">
  <label>成长值<input type="number" id="growth${side}" min="800" max="1300" step="1" value="1300" required></label>
  <label>能量等级<input type="number" id="energy${side}" min="1" max="80" step="1" value="80" required></label>
  <label>已有融合点<input type="number" id="fusion${side}" min="0" max="1500" step="1" value="0" required></label>
  </div><div class="estimate"><span>能量可分配点</span><strong id="alloc${side}">—</strong></div></div>`).join('');
function pearlInput(side) {
  return {growth:Number($('growth'+side).value),energyLevel:Number($('energy'+side).value),fusion:Number($('fusion'+side).value)};
}
function updateEstimates() {
  $('fusionResult').innerHTML = '';
  $('fusionError').textContent = '';
  const p = calc.getPearl(Number($('species').value));
  for (const side of ['A','B']) {
    try { const a = pearlInput(side); $('alloc'+side).textContent = calc.calcAllocPoints(a.growth,p.totalPointNum,a.energyLevel); }
    catch (_) { $('alloc'+side).textContent = '—'; }
  }
}
$('school').addEventListener('change',updateSpecies);
$('species').addEventListener('change',speciesChanged);
$('fusionForm').addEventListener('input',updateEstimates);
$('fusionForm').addEventListener('change',updateEstimates);
updateSpecies(); $('species').value = '3207'; speciesChanged();
$('fusionForm').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const p = calc.getPearl(Number($('species').value)), a = pearlInput('A'), b = pearlInput('B');
    const result = calc.calcFusionPoints(p.id,a,b,{allowFiveStarFusion:$('allowFiveStarFusion').checked}), mode = $('itemMode').value, cost = calc.calcItemCost(p.star,mode);
    const output = mode === 'up' ? planner.nextPearl(p) : p;
    const outcome = mode === 'none' ? '未选择保星/升星丹，产物星级不确定' : `产物：${output.name} · ${output.star}星`;
    $('fusionResult').innerHTML = `<div class="card result-grid"><div><h3>新珠融合累积点</h3><strong class="big">${result.fusionPoint}</strong><p>${esc(outcome)}</p><p>继承成长 ${result.growth}</p></div><div>
      <h3>${esc(p.name)} · ${p.star}星 · 计算明细</h3><div class="formula">A：${result.allocA} 能量点 ＋ ${a.fusion} 融合点 ＝ ${result.totalA}<br>B：${result.allocB} 能量点 ＋ ${b.fusion} 融合点 ＝ ${result.totalB}<br>⌊(${result.totalA} ＋ ${result.totalB}) ÷ 4⌋ ＝ ${result.fusionPoint}</div>
      <div class="breakdown"><span>融合丹</span><strong>${cost.fusion} 元宝</strong><span>${mode === 'up' ? '升星丹' : mode === 'keep' ? '保星丹' : '额外道具'}</span><strong>${cost.optional} 元宝</strong><span>道具费用合计</span><strong>${cost.totalYuanbao} 元宝</strong></div>
      <p class="note">仅计算数值；当前能量是否达到融合门槛、代数及道具条件，请在游戏内确认。</p></div></div>`;
    $('fusionError').textContent = '';
  } catch (error) { $('fusionResult').innerHTML = ''; $('fusionError').textContent = error.message; }
});
document.querySelectorAll('nav button').forEach(button => button.addEventListener('click',() => {
  document.querySelectorAll('nav button').forEach(b => {b.classList.toggle('active',b === button);b.setAttribute('aria-selected',String(b === button));});
  document.querySelectorAll('.panel').forEach(p => p.hidden = p.id !== button.dataset.tab);
}));
options($('baseId'),calc.data.pearls.filter(p => p.star === 3),p => p.id,p => `${schoolName(p.schoolId)} · ${p.name}`);
$('baseId').value = '3206';
const ownedList = $('ownedList'), addOwned = $('addOwned'), ownedLimit = planner.MAX_OWNED;
const ownedRows = () => Array.from(ownedList.querySelectorAll('[data-owned]'));
$('ownedLimit').textContent = ownedLimit;
function showOwnedSchool() {
  const pearl=calc.getPearl(Number($('baseId').value));
  $('ownedSchool').textContent = schoolName(pearl.schoolId);
}
$('baseId').addEventListener('change',showOwnedSchool);
showOwnedSchool();
function clearPlans() { $('planResult').innerHTML = ''; $('planError').textContent = ''; }
function updateOwnedRows() {
  const rows = ownedRows();
  for (const [index,row] of rows.entries()) {
    row.querySelector('[data-owned-label]').textContent = `已有珠 ${index+1}`;
    row.querySelector('[data-remove-owned]').setAttribute('aria-label',`移除已有珠 ${index+1}`);
  }
  addOwned.disabled = rows.length >= ownedLimit;
  clearPlans();
}
addOwned.addEventListener('click',() => {
  if (ownedRows().length >= ownedLimit) return;
  const row = $('ownedTemplate').content.firstElementChild.cloneNode(true);
  row.querySelector('[data-field="star"]').value = $('targetStar').value;
  row.querySelector('[data-field="growth"]').value = $('growth').value;
  ownedList.append(row);
  updateOwnedRows();
  row.querySelector('[data-field="star"]').focus();
});
ownedList.addEventListener('click',event => {
  const button = event.target.closest('[data-remove-owned]');
  if (!button) return;
  const row = button.closest('[data-owned]');
  const adjacent = row.nextElementSibling || row.previousElementSibling;
  row.remove();
  updateOwnedRows();
  (adjacent ? adjacent.querySelector('[data-remove-owned]') : addOwned).focus();
});
function planInput() {
  const o = {allowFiveStarFusion:$('allowFiveStarFusion').checked,targetGeneration:$('targetGeneration').value==='any'?null:Number($('targetGeneration').value)};
  for (const key of ['baseId','targetStar','targetFusion','charLevel','targetLevel','targetEnergy','maxDepth','growth','jlPrice','expPrice','basePrice','yuanbaoGold']) {
    if ($(key).value.trim() === '') throw new RangeError('请填写所有规划参数，价格可填写0');
    o[key] = Number($(key).value);
  }
  o.minLevels = {3:Number($('min3').value),4:Number($('min4').value),5:Number($('min5').value)};
  o.ownedBeads = ownedRows().map((row,index) => Object.fromEntries(Array.from(row.querySelectorAll('[data-field]'),field => {
    if (field.value === '') throw new RangeError(`请填写已有珠 ${index+1} 的全部参数，融合分配点可填写0`);
    return [field.dataset.field,Number(field.value)];
  })));
  return o;
}
$('planForm').addEventListener('input',clearPlans);
$('planForm').addEventListener('change',clearPlans);
$('allowFiveStarFusion').addEventListener('change',() => {
  updateEstimates(); clearPlans();
});
$('planForm').addEventListener('submit',event => {
  event.preventDefault();
  clearPlans();
  try {
    const input = planInput(), plans = planner.generatePlans(input);
    const hasOwned = input.ownedBeads.length > 0;
    if (!plans.length) {
      if (!hasOwned && input.targetStar===5 && !input.allowFiveStarFusion && input.targetGeneration>0) {
        $('planError').textContent = '当前服务器关闭5星融合，5星成品只能是升星得到的0代；指定的'+input.targetGeneration+'代目标无法通过当前确定性路线达成。';
        return;
      }
      const scope = hasOwned ? `直接使用或最多融合${input.maxDepth}层、使用至少一颗已有珠的路线` : `1～${input.maxDepth}层对称路线`;
      const note = hasOwned ? '补做的原料按对称配方搜索。' : '';
      $('planError').textContent = `在当前人物等级（能量上限${Math.min(80,input.charLevel+5)}）、最低融合能量和代数规则模型下，${scope}未找到达标方案。${note}可调整条件；这不代表其他路线也无法合成。`;
      return;
    }
    const scope = hasOwned
      ? `使用至少一颗已有珠，最多融合${input.maxDepth}层。补做的原料按对称配方规划，已有珠与搭配珠可以有不同成长和等级。 ★ 表示本次搜索中新增费用最低，含成品喂养。`
      : `当前搜索范围：1～${input.maxDepth}层、每层同珠种同等级、允许提前升星与目标星级保星。遍历各层允许的整数喂养等级，标记★为这些条件下费用最低的方案；总价含最终成品喂养。`;
    $('planResult').innerHTML = `<div class="card"><h3>方案比较 · 按输入价格估算</h3><p class="note">${scope}目标代数：${input.targetGeneration===null?'不限':input.targetGeneration+'代'}。</p><div class="table-scroll"><table><thead><tr><th>路线</th>${hasOwned?'<th>使用已有珠</th>':''}<th>实际融合点</th><th>成品代数</th><th>${hasOwned?'需购3星原料':'3星原料'}</th><th>聚能丹</th><th>化雪经验（万）</th><th>道具元宝</th><th>估算金币</th></tr></thead><tbody>${plans.map((p,i) => `<tr data-plan="${i}"><td><button type="button">${p.depth===0?'直接使用':p.depth+'层路线'}${i===0?' ★':''}</button></td>${hasOwned?`<td>${p.usedOwned.join('、')} 号</td>`:''}<td>${p.fusion}</td><td>${p.generation}代</td><td>${p.totals.pearls}</td><td>${fmt(p.totals.juling)}</td><td>${fmt(p.totals.experience / 1e4)}</td><td>${fmt(p.totals.yuanbao)}</td><td>${fmt(p.gold)}</td></tr>`).join('')}</tbody></table></div><div id="route"></div></div>`;
    const select = index => {
      document.querySelectorAll('[data-plan]').forEach(row => row.classList.toggle('selected',Number(row.dataset.plan)===index));
      renderRoute(plans[index]);
    };
    document.querySelectorAll('[data-plan] button').forEach((button,i) => button.addEventListener('click',() => select(i)));
    select(0);
  } catch(error) { clearPlans(); $('planError').textContent = error.message; }
});
let routeView = null;
function renderRoute(plan) {
  if (plan.depth === 0) {
    $('route').innerHTML = `<div class="route-head"><h3>直接使用已有珠 ${plan.usedOwned[0]}</h3><span class="muted">已达到融合目标，无需融合</span></div>${finalFeedSummary(plan)}`;
    return;
  }
  const view = routeView || (plan.depth > 4 ? 'list' : 'diagram');
  if (plan.tree) {
    const layout=PearlDiagram.inventoryLayout(plan);
    if (view === 'list') renderOwnedRouteList(plan,layout);
    else renderOwnedDiagram(plan,layout);
  } else if (view === 'list') renderGroupedRoute(plan);
  else renderDiagram(plan);
  $('route').insertAdjacentHTML('afterbegin', `<div class="view-switch" role="group" aria-label="合成路线显示方式"><button type="button" data-route-view="diagram" aria-pressed="${view==='diagram'}">导图</button><button type="button" data-route-view="list" aria-pressed="${view==='list'}">列表</button></div>`);
  $('route').querySelectorAll('[data-route-view]').forEach(button => button.addEventListener('click',() => {
    routeView = button.dataset.routeView;
    renderRoute(plan);
  }));
}

function renderDiagram(plan) {
  const row = 240, column = 292, nodeWidth = 200, nodeHeight = 208;
  const costs = PearlDiagram.stageCosts(plan);
  const height = Math.pow(2,plan.depth)*row, width = plan.depth*column+nodeWidth;
  const center = (depth,index) => (index+0.5)*Math.pow(2,depth)*row;
  let nodes = '', edges = '', labels = '';
  for (let depth = 0; depth <= plan.depth; depth++) {
    const count = Math.pow(2,plan.depth-depth), last = depth === plan.depth;
    const step = plan.scheme[depth], previous = plan.scheme[depth-1];
    const species = calc.getPearl(depth===0 ? plan.options.baseId : previous.outputId);
    const fusion = depth===0 ? 0 : previous.fusionOut;
    const generation = depth===0 ? 0 : previous.generationOut;
    for (let index = 0; index < count; index++) {
      const y = center(depth,index);
      nodes += `<div class="route-node ${last?'final':''}" data-depth="${depth}" data-index="${index}" style="left:${depth*column}px;top:${y-nodeHeight/2}px"><div class="node-card"><small>${depth+1}-${index+1} · ${generation}代</small><strong>${esc(species.name)} · ${species.star}星</strong><span class="points">融合 ${fusion} 点</span>${last?`<small>成品Lv${plan.finalFeed.level} · 聚能${plan.finalFeed.energy}</small>`:`<small>Lv1 → Lv${step.energyLv}</small><span>聚能 ×${fmt(step.julingPer)}</span><small>化雪经验 ${fmt(step.experiencePer / 1e4)}万</small>`}<details class="node-cost"><summary>费用明细</summary><div class="node-cost-values"><span>至此合成 ${fmt(costs[depth].synthesisGold)}金</span><span>当前等级 ${fmt(costs[depth].levelGold)}金</span></div></details></div></div>`;
      if (depth > 0) {
        const x1 = (depth-1)*column+nodeWidth, x2 = depth*column, middle = x1+28;
        const y1 = center(depth-1,index*2), y2 = center(depth-1,index*2+1);
        edges += `<path d="M${x1},${y1} H${middle} V${y} H${x2} M${x1},${y2} H${middle} V${y}" fill="none" stroke="#91a8bd" stroke-width="1.5"/>`;
        labels += `<div class="edge-label" style="left:${x1+32}px;top:${y-25}px">${previous.mode==='up'?'升星':'保星'}融合<br>${previous.itemYuanbao}元宝</div>`;
      }
    }
  }
  showDiagram(plan,width,height,nodes,edges,labels,'节点费用均按每颗珠计算：至此合成成本含原料及已消耗的子树，当前等级成本仅含本颗喂养。各列费用不可重复相加。');
}

function ownedNodeLabels(layout) {
  const labels = new Map();
  for (const [index,step] of layout.merges.entries()) labels.set(step.output.id,`步骤 ${index+1} 产物`);
  let purchased = 0;
  for (const placed of layout.nodes) {
    if (placed.node.ownedNumber != null) labels.set(placed.id,`已有珠 ${placed.node.ownedNumber}`);
    else if (!placed.node.merge) labels.set(placed.id,`购入原料 ${++purchased}`);
  }
  return labels;
}

function ownedLevelText(feed) {
  return `等级 ${feed.startLevel} → ${feed.level} · 聚能 ${feed.startEnergy} → ${feed.energy}`;
}

function renderOwnedDiagram(plan,layout) {
  const rowGap=240,columnGap=292,nodeWidth=200,nodeHeight=208;
  const height=layout.height*rowGap,width=(layout.width-1)*columnGap+nodeWidth;
  const x = p => p.column*columnGap, y = p => (p.row+.5)*rowGap;
  const names = ownedNodeLabels(layout);
  const nodes = layout.nodes.map(p => {
    const n=p.node,f=p.feed;
    return `<div class="route-node${p.final?' final':''}${n.ownedNumber!=null?' owned':''}" data-node="${esc(p.id)}" style="left:${x(p)}px;top:${y(p)-nodeHeight/2}px"><div class="node-card"><small>${names.get(p.id)} · ${n.generation}代</small><strong>${esc(n.pearl.name)} · ${n.pearl.star}星</strong><span class="points">融合 ${n.fusion} 点</span><small>成长${n.growth} · ${ownedLevelText(f)}</small>${p.final?'':`<span>聚能丹 ×${fmt(f.juling)}</span><small>化雪经验 ${fmt(f.experience/1e4)}万</small>`}<details class="node-cost"><summary>费用明细</summary><div class="node-cost-values"><span>至此新增合成 ${fmt(n.gold)}金</span><span>本颗新增喂养 ${fmt(f.gold)}金</span></div></details></div></div>`;
  }).join('');
  const edges=[],labels=[];
  for (const {node,inputs,output} of layout.merges) {
    const [a,b]=inputs,x2=x(output),mid=x2-64,cy=y(output);
    edges.push(`<path d="M${x(a)+nodeWidth},${y(a)} H${mid} V${cy} H${x2} M${x(b)+nodeWidth},${y(b)} H${mid} V${cy}" fill="none" stroke="#91a8bd" stroke-width="1.5"/>`);
    labels.push(`<div class="edge-label" style="left:${x2-60}px;top:${cy-25}px">${node.merge.mode==='up'?'升星':'保星'}融合<br>${node.merge.itemYuanbao}元宝</div>`);
  }
  showDiagram(plan,width,height,nodes,edges.join(''),labels.join(''),'按连线将两颗珠子融合。已有珠的过往投入不计费，节点费用按每颗珠子的新增消耗显示。');
}

function renderOwnedRouteList(plan,layout) {
  const names=ownedNodeLabels(layout);
  const rows=layout.merges.map(({node,inputs,output},index) => {
    const materials=inputs.map(({id,node:n,feed:f}) => `<div class="input-pair"><strong>${names.get(id)}</strong> · ${esc(n.pearl.name)} ${n.pearl.star}星 · ${n.generation}代 · 融合${n.fusion} · 成长${n.growth}<br>${ownedLevelText(f)}<br>聚能丹${fmt(f.juling)}颗 · 化雪${fmt(f.experience/1e4)}万经验</div>`).join('');
    return `<tr data-owned-step="${index+1}"><td>步骤 ${index+1}</td><td>${materials}</td><td>${node.merge.mode==='up'?'升星':'保星'}融合<br>${node.merge.itemYuanbao}元宝</td><td>${esc(node.pearl.name)} ${node.pearl.star}星 · ${node.generation}代<br>融合${node.fusion} · 成长${node.growth}<br>Lv1 · 聚能1${output.final?' · 成品':''}</td></tr>`;
  }).join('');
  $('route').innerHTML = `<div class="route-head"><h3>${plan.depth}层合成列表</h3><span class="muted">${plan.usedOwned.length}颗已有珠 · 购买${plan.totals.pearls}颗3星原料 · ${layout.merges.length}次融合</span></div><p class="note">从上到下完成各步骤；只需给每颗输入珠补齐自身等级与聚能。</p><div class="table-scroll owned-route-list"><table><thead><tr><th>顺序</th><th>输入与新增喂养</th><th>融合操作</th><th>产物</th></tr></thead><tbody>${rows}</tbody></table></div>${finalFeedSummary(plan)}`;
}

function showDiagram(plan,width,height,nodes,edges,labels,note) {
  $('route').innerHTML = `<div class="route-head"><h3>${plan.depth}层合成导图</h3><span class="muted">从左向右合成 · 可在图内拖动或滑动</span></div><div class="route-scroll" tabindex="0" aria-label="合成导图，可横向滚动"><div class="route-canvas" style="width:${width}px;height:${height}px"><svg width="${width}" height="${height}" aria-hidden="true">${edges}</svg>${labels}${nodes}</div></div>`;
  const scroll = document.querySelector('.route-scroll');
  const canvas = scroll.querySelector('.route-canvas');
  const stage = document.createElement('div');
  stage.className='diagram-stage';
  scroll.insertBefore(stage,canvas);stage.appendChild(canvas);
  scroll.style.height=Math.min(height+40,580)+'px';
  scroll.insertAdjacentHTML('beforebegin',`<div class="diagram-tools" role="group" aria-label="导图缩放"><button type="button" data-zoom="out" aria-label="缩小导图">−</button><output class="zoom-label" aria-live="polite">100%</output><button type="button" data-zoom="in" aria-label="放大导图">＋</button><button type="button" data-zoom="reset">100%</button><button type="button" data-zoom="fit">适应窗口</button></div><p class="note">${note}</p>`);
  let scale=1;
  const tools=$('route').querySelector('.diagram-tools');
  function dimensions(){return {w:Math.max(0,scroll.clientWidth-32),h:Math.max(0,scroll.clientHeight-40)};}
  function applyZoom(value,fit){
    const next=PearlDiagram.clampScale(value),view=dimensions();
    const anchor=fit?{left:0,top:0}:PearlDiagram.zoomScroll(scroll.scrollLeft,scroll.scrollTop,view.w,view.h,width,height,scale,next);
    scale=next;stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';
    canvas.style.transform=`scale(${scale})`;canvas.style.transformOrigin='0 0';
    scroll.scrollLeft=anchor.left;scroll.scrollTop=anchor.top;
    tools.querySelector('.zoom-label').textContent=fmt(scale*100)+'%';
    tools.querySelector('[data-zoom="out"]').disabled=scale<=PearlDiagram.MIN_SCALE;
    tools.querySelector('[data-zoom="in"]').disabled=scale>=PearlDiagram.MAX_SCALE;
  }
  tools.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.zoom;
    if(action==='fit'){
      const view=dimensions(),fit=PearlDiagram.fitScale(width,height,view.w,view.h);
      if(fit!==null)applyZoom(fit,true);
    }else applyZoom(action==='reset'?1:scale*(action==='in'?1.25:0.8),false);
  }));
  applyZoom(1,true);
  $('route').insertAdjacentHTML('beforeend', finalFeedSummary(plan));
  let drag = null;
  scroll.addEventListener('pointerdown',event => {if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('summary,button,a,input,select'))return;drag={x:event.clientX,y:event.clientY,left:scroll.scrollLeft,top:scroll.scrollTop};scroll.setPointerCapture(event.pointerId);scroll.classList.add('dragging');});
  scroll.addEventListener('pointermove',event => {if(drag){scroll.scrollLeft=drag.left-(event.clientX-drag.x);scroll.scrollTop=drag.top-(event.clientY-drag.y);}});
  const end = () => {drag=null;scroll.classList.remove('dragging');};
  scroll.addEventListener('pointerup',end);scroll.addEventListener('pointercancel',end);
}

function finalFeedSummary(plan) {
  const f=plan.finalFeed,t=plan.totals,o=plan.options,withOwned=Boolean(plan.tree);
  const levelText=withOwned?`成长${plan.growth} · ${ownedLevelText(f)}`:`融合后Lv1 → 目标等级${f.level}；能量1 → 聚能等级${f.energy}`;
  const resources=[
    ['精粹聚能丹',fmt(t.juling)+'颗',t.juling*o.jlPrice],
    ['化雪经验',fmt(t.experience/1e4)+'万',t.experience/1e7*o.expPrice],
    ['融合道具',fmt(t.yuanbao)+'元宝',t.yuanbao*o.yuanbaoGold],
    [withOwned?'需购3星原料':'3星原料',t.pearls+'颗',t.pearls*o.basePrice]
  ];
  return `<section class="plan-summary final-feed" aria-label="成品与费用汇总">
    <div class="summary-heading"><div><span class="summary-kicker">成品与费用汇总</span><h3>成品目标 · ${plan.pearl.star}星 · ${plan.generation}代 · 实际融合 ${plan.fusion} 点</h3><p>${levelText}</p></div><div class="summary-total"><span>${withOwned?'新增总成本':'总成本'}</span><strong>${fmt(plan.gold)}<small>金币</small></strong><em>含合成与最终成品喂养</em></div></div>
    <div class="summary-resources">${resources.map(([name,quantity,gold])=>`<div class="summary-resource"><span>${esc(name)}</span><strong>${esc(quantity)}</strong><b>${fmt(gold)} 金币</b></div>`).join('')}</div>
    <div class="summary-footer"><span>合成费用 <b>${fmt(plan.fusionGold)}</b> ＋ 成品喂养 <b>${fmt(f.gold)}</b> 金币</span><span>总可分配点 <b>${plan.finalTotalPoints}</b>（${plan.fusion}融合＋${f.alloc}能量）</span></div>
    <details class="summary-details"><summary>价格与消耗明细</summary><p>最后一颗成品喂养：聚能丹 ${fmt(f.juling)}颗，化雪 ${fmt(f.experience/1e4)}万经验，费用 ${fmt(f.gold)}金币</p><p>价格快照：聚能${o.jlPrice}金币/颗，化雪${o.expPrice}金币/1000万经验，3星原料${o.basePrice}金币/颗，1元宝＝${o.yuanbaoGold}金币。</p><p>${withOwned?'补购原料':''}成长${o.growth}；能量上限${o.maxEnergy}；最低融合能量：3星${o.minLevels[3]}、4星${o.minLevels[4]}、5星${o.minLevels[5]}。5星融合${o.allowFiveStarFusion?'开启':'关闭'}，6星不参与融合；2代及以上不可保星，升星代数归0。</p></details>
  </section>`;
}

function renderGroupedRoute(plan) {
  const t = plan.totals;
  const rows = plan.scheme.map((step,index) => {
    const input = calc.getPearl(step.inputId), output = calc.getPearl(step.outputId);
    const count = Math.pow(2,plan.depth-index);
    return `<tr data-group="${index}"><td>第${index+1}层</td><td>${esc(input.name)} ${input.star}星<br>${count}颗 · ${step.generationIn}代 · 融合${step.fusionIn}</td><td>每颗 Lv1→${step.energyLv}<br>聚能${fmt(step.julingPer)}颗<br>化雪${fmt(step.experiencePer/1e4)}万经验</td><td>${step.mode==='up'?'升星':'保星'} ×${count/2}次<br>每次${step.itemYuanbao}元宝</td><td>${esc(output.name)} ${output.star}星<br>${count/2}颗 · ${step.generationOut}代 · 融合${step.fusionOut}<br>产物Lv1</td></tr>`;
  }).join('');
  $('route').innerHTML = `<div class="route-head"><h3>${plan.depth}层合成列表</h3><span class="muted">${t.pearls}颗原料 · ${t.pearls-1}次融合</span></div><p class="note">列表按层汇总相同珠子。每行把全部输入两两融合；喂养消耗均为每颗原料所需。</p><div class="table-scroll"><table><thead><tr><th>层次</th><th>输入珠子</th><th>每颗喂养</th><th>融合操作</th><th>输出珠子</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  $('route').insertAdjacentHTML('beforeend', finalFeedSummary(plan));
}
