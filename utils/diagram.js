(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PearlDiagram=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN_SCALE=0.001, MAX_SCALE=3;
  function clampScale(scale){
    return Math.min(MAX_SCALE,Math.max(MIN_SCALE,Number.isFinite(scale)?scale:1));
  }
  function fitScale(width,height,viewportWidth,viewportHeight){
    if(![width,height,viewportWidth,viewportHeight].every(v=>Number.isFinite(v)&&v>0))return null;
    const fit=Math.min(1,viewportWidth/width,viewportHeight/height);
    // Avoid a fractional-pixel overflow from floating-point multiplication.
    return fit===1?1:clampScale(fit*(1-1e-12));
  }
  function zoomScroll(left,top,viewportWidth,viewportHeight,width,height,oldScale,newScale){
    return {
      left:Math.max(0,Math.min(width*newScale-viewportWidth,(left+viewportWidth/2)/oldScale*newScale-viewportWidth/2)),
      top:Math.max(0,Math.min(height*newScale-viewportHeight,(top+viewportHeight/2)/oldScale*newScale-viewportHeight/2))
    };
  }
  // Costs are per pearl: acquisition includes its entire consumed subtree,
  // while level cost is only feeding this pearl after it was acquired at Lv1.
  function stageCosts(plan){
    const o=plan.options, rows=[];
    let synthesisGold=o.basePrice;
    for(let depth=0;depth<=plan.depth;depth++){
      const feed=depth===plan.depth?plan.finalFeed:plan.scheme[depth];
      const juling=depth===plan.depth?feed.juling:feed.julingPer;
      const experience=depth===plan.depth?feed.experience:feed.experiencePer;
      const levelGold=juling*o.jlPrice+experience/1e7*o.expPrice;
      rows.push({synthesisGold,levelGold,totalGold:synthesisGold+levelGold});
      if(depth<plan.depth)synthesisGold=2*(synthesisGold+levelGold)+plan.scheme[depth].itemYuanbao*o.yuanbaoGold;
    }
    return rows;
  }
  function inventoryLayout(plan){
    const nodes=[], merges=[], columnCounts=[];
    let leafCount=0;
    function place(node,feed,final){
      const inputs=node.merge?.inputs.map(input=>place(input.node,input.feed,false));
      const column=node.depth;
      const row=inputs?(inputs[0].row+inputs[1].row)/2:leafCount++;
      const number=(columnCounts[column]||0)+1;
      columnCounts[column]=number;
      const output={id:`${column+1}-${number}`,column,row,node,feed,final};
      nodes.push(output);
      if(inputs)merges.push({node,inputs,output});
      return output;
    }
    place(plan.tree,plan.finalFeed,true);
    return {width:columnCounts.length,height:leafCount,nodes,merges};
  }
  return {MIN_SCALE,MAX_SCALE,clampScale,fitScale,zoomScroll,stageCosts,inventoryLayout};
});
