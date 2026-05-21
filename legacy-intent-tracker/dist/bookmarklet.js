(()=>{function L(c={}){let o=new Map,m=new Map,u=new Map,f="",i=c.items||{};for(let[l,g]of Object.entries(i))m.set(l,g),u.set(l,g.id);f=Object.keys(i).join(", ");function M(){return f}function v(l,g){let t=l.id;if(!t)return null;let d=(l.tags||"").split(",").map(e=>e.trim()).filter(Boolean);l.price&&d.push("price:"+l.price.trim());let s=l.group||null,_=l.name||t;return{id:t,tags:d,group:s,name:_,element:g}}function h(l){for(let[g,t]of m){let k=l.querySelector(g);if(!k)continue;let d=v(t,k);d&&o.set(d.id,d)}return o}function S(l){let g=[];return l.forEach(t=>{if(t.matches&&f&&T(t,g),t.querySelectorAll&&f)try{t.querySelectorAll(f).forEach(k=>{T(k,g)})}catch{for(let d of m.keys())try{t.querySelectorAll(d).forEach(s=>{T(s,g)})}catch{}}}),g}function T(l,g){for(let[t,k]of m){try{if(!l.matches(t))continue}catch{continue}let d=k.id,s=o.get(d);if(s)s.element!==l&&(s.element=l,g.push({...s,element:l}));else{let _=v(k,l);_&&(o.set(_.id,_),g.push(_))}break}}function b(l){return o.get(l)||null}function w(){return Array.from(o.values())}return{scanItems:h,scanNewElements:S,getItem:b,getAllItems:w,getSelector:M}}function D({catalog:c,flushInterval:o=5e3,trackViews:m=!1,onEvent:u,onFlush:f}){let i=[],M=new Map,v=new Map,h=new WeakSet,S=null,T=!1,b=m?new IntersectionObserver(s=>{s.forEach(_=>{let e=_.target.__ikId;if(e)if(_.isIntersecting)M.set(e,{start:Date.now()});else{let p=M.get(e);if(p){let I=Date.now()-p.start;M.delete(e),I>=800&&w({type:"view",timestamp:Date.now(),itemId:e,dwellMs:I,query:null})}}})},{root:null,threshold:.5}):null;function w(s){i.push(s),u&&u(s)}function l(s,_){h.has(s)||(h.add(s),s.__ikId=_,b&&b.observe(s),s.addEventListener("mouseenter",()=>{v.set(_,{start:Date.now()})}),s.addEventListener("mouseleave",()=>{let e=v.get(_);if(e){let p=Date.now()-e.start;v.delete(_),p>=1e3&&w({type:"hover",timestamp:Date.now(),itemId:_,dwellMs:p,query:null})}}),s.addEventListener("click",()=>{w({type:"click",timestamp:Date.now(),itemId:_,dwellMs:null,query:null})}))}function g(s){s.forEach(_=>{let e=c.getItem(_.__ikId||_.getAttribute(c.getSelector().slice(1,-1)));e&&l(_,e.id)})}function t(s){s.forEach(_=>{_.element&&l(_.element,_.id)})}let k=0;S=setInterval(()=>{i.length>k&&f&&(k=i.length,f([...i]))},o);function d(){M.forEach((s,_)=>{let e=Date.now()-s.start;e>=800&&i.push({type:"view",timestamp:Date.now(),itemId:_,dwellMs:e,query:null})}),i.length>0&&f&&f([...i])}return window.addEventListener("beforeunload",d),{observe:g,observeNew:t,trackClick(s){w({type:"click",timestamp:Date.now(),itemId:s,dwellMs:null,query:null})},trackSearch(s){w({type:"search",timestamp:Date.now(),itemId:null,dwellMs:null,query:s})},trackTabView(s,_=[]){w({type:"tab_view",timestamp:Date.now(),itemId:null,dwellMs:null,query:null,tabId:s,tags:_})},trackPageView(s){w({type:"page_view",timestamp:Date.now(),itemId:null,dwellMs:null,query:null,pageMeta:s})},getEvents(){return[...i]},clearBuffer(){i.length=0},destroy(){T||(T=!0,clearInterval(S),b&&b.disconnect(),window.removeEventListener("beforeunload",d))}}}var j=class{constructor(o){this.catalog=o}_eventWeight(o,m){return o==="click"?m==="tag"?2:3:o==="hover"||o==="tab_view"?m==="tag"?1.5:2:1}summarize(o){let m=[],u={},f={},i=[],M=[],v=[],h={},S=Date.now(),T=o.length>0?o[0].timestamp:S,b=Math.max(S-T,1);o.forEach(e=>{if(e.type==="page_view")return;if(e.type==="tab_view"){let a=.5+.5*((e.timestamp-T)/b);(e.tags||[]).forEach(E=>{f[E]=(f[E]||0)+this._eventWeight("tab_view","tag")*a});return}if(e.type==="search"&&e.query){v.push(e.query);return}let p=this.catalog.getItem(e.itemId);if(!p)return;e.type==="click"&&i.push(p.id),e.type==="hover"&&(M.push(p.id),p.group&&(h[p.group]||(h[p.group]=[]),h[p.group].push({itemId:p.id,hoverMs:e.dwellMs||0})));let n=.5+.5*((e.timestamp-T)/b);p.group&&(u[p.group]=(u[p.group]||0)+this._eventWeight(e.type,"group")*n),p.tags.forEach(r=>{f[r]=(f[r]||0)+this._eventWeight(e.type,"tag")*n})});let w={};o.forEach(e=>{e.itemId&&(e.type==="click"||e.type==="hover")&&(w[e.itemId]=(w[e.itemId]||0)+1)}),Object.entries(w).forEach(([e,p])=>{if(p>=2){let I=this.catalog.getItem(e);if(!I)return;let n=Math.log2(p);I.group&&(u[I.group]=(u[I.group]||0)+n),I.tags.forEach(r=>{f[r]=(f[r]||0)+n})}}),this._topEntries(u,3).forEach(([e,p])=>{if(p<3)return;let I=this._topNonGroupTag(f);m.push({id:this._id(),timestamp:Date.now(),summary:I?`Interested in ${e} \u2014 ${I[0]}`:`Exploring ${e}`,tags:[e,...I?[I[0]]:[]],confidence:Math.min(p/10,1),category:"group_interest",sourceEventCount:p})});let g={},t=0;if(Object.entries(f).forEach(([e,p])=>{e.startsWith("price:")&&(g[e]=p,t+=p)}),t>=3){let e=this._topEntry(g);if(e&&e[1]/t>=.5){let p=e[0].replace("price:","");m.push({id:this._id(),timestamp:Date.now(),summary:`Looking for ${p} options`,tags:[e[0]],confidence:Math.min(e[1]/t,1),category:"price_preference",sourceEventCount:e[1]})}}let k={};Object.entries(f).forEach(([e,p])=>{e.startsWith("price:")||(k[e]=p)});let d=Object.values(k).reduce((e,p)=>e+p,0);if(d>=3){let e=this._topEntry(k);e&&e[1]/d>=.35&&m.push({id:this._id(),timestamp:Date.now(),summary:`Interested in ${e[0]}`,tags:[e[0]],confidence:Math.min(e[1]/d,1),category:"tag_affinity",sourceEventCount:e[1]})}if(v.forEach(e=>{m.push({id:this._id(),timestamp:Date.now(),summary:`Searched for "${e}"`,tags:[e.toLowerCase()],confidence:.9,category:"search_intent",sourceEventCount:1})}),i.length>=2){let e=[...new Set(i)];if(e.length>=2&&e.length<=3){let p=e.map(I=>this.catalog.getItem(I)?.name||I);m.push({id:this._id(),timestamp:Date.now(),summary:`Comparing ${p.join(" and ")}`,tags:e.flatMap(I=>this.catalog.getItem(I)?.tags||[]),confidence:.85,category:"comparison",sourceEventCount:i.length})}}let _=[...new Set(M)].filter(e=>!i.includes(e));return _.length>=2&&Object.entries(h).forEach(([e,p])=>{if([...new Set(p.filter(n=>_.includes(n.itemId)).map(n=>n.itemId))].length>=2){let n=p.reduce((a,E)=>a+E.hoverMs,0),r=this._topNonGroupTag(f);m.push({id:this._id(),timestamp:Date.now(),summary:r?`Considering ${r[0]} options in ${e}`:`Browsing ${e} with interest`,tags:[e,...r?[r[0]]:[]],confidence:Math.min(n/1e4,.9),category:"hover_interest",sourceEventCount:p.length})}}),this._dedupe(m)}_topNonGroupTag(o){return Object.entries(o).filter(([u])=>!u.startsWith("price:")).sort((u,f)=>f[1]-u[1])[0]||null}_topEntries(o,m=1){return Object.entries(o).sort((u,f)=>f[1]-u[1]).slice(0,m)}_topEntry(o){let m=this._topEntries(o,1);return m.length>0?m[0]:null}_dedupe(o){let m=new Map;return o.forEach(u=>{let f=u.category+":"+u.tags.slice().sort().join(","),i=m.get(f);(!i||u.confidence>i.confidence)&&m.set(f,u)}),Array.from(m.values())}_id(){return"intent-"+Math.random().toString(36).slice(2,10)}};var C=class{constructor(o="ik_profile"){this.storageKey=o,this.profile=this._load()}saveSessionIntents(o,m){let u=this.profile.sessions.find(i=>i.sessionId===o);u||(u={sessionId:o,startedAt:Date.now(),intents:[]},this.profile.sessions.push(u));let f=new Set(m.map(i=>i.category+":"+i.tags.slice().sort().join(",")));u.intents.forEach(i=>{let M=i.category+":"+i.tags.slice().sort().join(",");f.has(M)||(i.confidence=(i.confidence||0)*.8,i.confidence<.05&&(i.active=!1))}),m.forEach(i=>{let M=i.category+":"+i.tags.slice().sort().join(","),v=u.intents.findIndex(h=>h.category+":"+h.tags.slice().sort().join(",")===M);i.active=!0,v>=0?u.intents[v]=i:u.intents.push(i)}),this._computeTagWeights(),this._save()}getProfile(){return this.profile}clearAll(){this.profile=this._createEmpty();try{localStorage.removeItem(this.storageKey)}catch{}}_computeTagWeights(){let o={},m=this.profile.sessions.length;this.profile.sessions.forEach((u,f)=>{let i=m-1-f,M=Math.pow(.8,i);u.intents.forEach(v=>{v.active!==!1&&v.tags.forEach(h=>{o[h]=(o[h]||0)+v.confidence*M})})}),this.profile.tagWeights=o}_load(){try{let o=localStorage.getItem(this.storageKey);if(o)return JSON.parse(o)}catch{}return this._createEmpty()}_save(){try{localStorage.setItem(this.storageKey,JSON.stringify(this.profile))}catch{}}_createEmpty(){return{userId:"user-"+Math.random().toString(36).slice(2,10),sessions:[],tagWeights:{}}}};var $=class{constructor(o,{maxPerGroup:m=3}={}){this.catalog=o,this.maxPerGroup=m}recommend(o,m=6){if(!o||!o.tagWeights||Object.keys(o.tagWeights).length===0)return[];let u=o.tagWeights,i=this.catalog.getAllItems().map(h=>{let S=0,T=[];return h.tags.forEach(b=>{u[b]&&(S+=u[b],T.push({tag:b,weight:u[b]}))}),h.tags.length>0&&(S=S/Math.sqrt(h.tags.length)),T.sort((b,w)=>w.weight-b.weight),{item:h,score:S,matchedTags:T}});i.sort((h,S)=>S.score-h.score);let M={},v=[];for(let h of i){if(h.score<=0||v.length>=m)break;if(h.item.group&&(M[h.item.group]=(M[h.item.group]||0)+1,M[h.item.group]>this.maxPerGroup))continue;let S=h.matchedTags[0],T=S?`Based on your interest in ${S.tag}`:"Recommended for you";v.push({itemId:h.item.id,item:h.item,score:Math.round(h.score*100)/100,reason:T,matchedTags:h.matchedTags.map(b=>b.tag)})}return v}};var W=`
.__ik-fab {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  width: 48px; height: 48px; border-radius: 50%;
  background: #1c1c1c; color: #ff6b35; border: none;
  font-size: 1.3rem; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s, background 0.2s;
  font-family: system-ui, sans-serif;
}
.__ik-fab:hover { transform: scale(1.1); background: #2a2a2a; }

.__ik-panel {
  position: fixed; top: 0; right: -400px; width: 400px; height: 100vh;
  background: #1c1c1c; color: #e0e0e0; z-index: 100000;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.3);
  transition: right 0.3s ease;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.82rem;
}
.__ik-panel.__ik-open { right: 0; }

.__ik-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1rem; background: #111; border-bottom: 1px solid #333;
}
.__ik-title { font-weight: 700; font-size: 0.95rem; color: #ff6b35; }
.__ik-close {
  background: none; border: none; color: #888; font-size: 1.3rem;
  cursor: pointer; padding: 0.2rem;
}
.__ik-close:hover { color: white; }

.__ik-tabs {
  display: flex; background: #111; border-bottom: 1px solid #333; padding: 0 0.5rem;
}
.__ik-tab {
  background: none; border: none; color: #888; padding: 0.5rem 0.75rem;
  font-size: 0.78rem; cursor: pointer; border-bottom: 2px solid transparent;
  font-family: inherit; transition: color 0.15s, border-color 0.15s;
}
.__ik-tab:hover { color: #e0e0e0; }
.__ik-tab.__ik-active { color: #ff6b35; border-bottom-color: #ff6b35; }

.__ik-content { flex: 1; overflow-y: auto; padding: 0.75rem; }
.__ik-empty { color: #666; text-align: center; padding: 2rem 1rem; font-style: italic; }

.__ik-event {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #555; line-height: 1.4;
}
.__ik-event.__ik-click { border-left-color: #ff6b35; }
.__ik-event.__ik-hover { border-left-color: #14b8a6; }
.__ik-event.__ik-view { border-left-color: #10b981; }
.__ik-event.__ik-search { border-left-color: #a78bfa; }
.__ik-event.__ik-page_view { border-left-color: #3b82f6; }

.__ik-etype {
  font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em;
}
.__ik-etype.__ik-click { color: #ff6b35; }
.__ik-etype.__ik-hover { color: #14b8a6; }
.__ik-etype.__ik-view { color: #10b981; }
.__ik-etype.__ik-search { color: #a78bfa; }
.__ik-etype.__ik-page_view { color: #3b82f6; }
.__ik-edetail { color: #ccc; }
.__ik-etime { color: #666; font-size: 0.72rem; }

.__ik-intent {
  padding: 0.6rem 0.7rem; margin-bottom: 0.4rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #ff6b35;
}
.__ik-intent.__ik-inactive { opacity: 0.45; border-left-color: #555; background: #222; }
.__ik-isummary { color: #ffc4b0; font-weight: 600; margin-bottom: 0.2rem; }
.__ik-intent.__ik-inactive .__ik-isummary { color: #888; }
.__ik-imeta { color: #666; font-size: 0.72rem; }
.__ik-conf {
  display: inline-block; padding: 0.1rem 0.3rem; border-radius: 2px;
  font-size: 0.68rem; font-weight: 600;
}
.__ik-conf.__ik-high { background: #065f46; color: #6ee7b7; }
.__ik-conf.__ik-medium { background: #4a2c1a; color: #ffc4b0; }
.__ik-conf.__ik-low { background: #333; color: #999; }
.__ik-faded {
  font-size: 0.6rem; font-weight: 400; color: #666; background: #333;
  padding: 0.1rem 0.35rem; border-radius: 2px; margin-left: 0.4rem;
  text-transform: uppercase; letter-spacing: 0.5px;
}

.__ik-psection { margin-bottom: 1rem; }
.__ik-psection h4 {
  color: #ff6b35; font-size: 0.78rem; text-transform: uppercase;
  letter-spacing: 0.05em; margin: 0 0 0.4rem 0;
}
.__ik-tw {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.25rem 0.5rem; margin-bottom: 0.2rem; background: #2a2a2a; border-radius: 2px;
}
.__ik-tw-name { color: #e0e0e0; }
.__ik-tw-bar { flex: 1; margin: 0 0.5rem; height: 4px; background: #1c1c1c; border-radius: 2px; overflow: hidden; }
.__ik-tw-fill { height: 100%; background: #ff6b35; border-radius: 2px; }
.__ik-tw-val { color: #888; font-size: 0.72rem; min-width: 2.5rem; text-align: right; }

.__ik-rec {
  padding: 0.5rem 0.7rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981;
}
.__ik-rec-name { color: #6ee7b7; font-weight: 600; }
.__ik-rec-reason { color: #888; font-size: 0.75rem; }
.__ik-rec-score { color: #10b981; font-weight: 700; font-size: 0.72rem; }

.__ik-footer { padding: 0.6rem; background: #111; border-top: 1px solid #333; }
.__ik-clear {
  width: 100%; padding: 0.5rem; background: #991b1b; color: #fecaca;
  border: none; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; font-family: inherit; transition: background 0.15s;
}
.__ik-clear:hover { background: #b91c1c; }

.__ik-jnode {
  display: inline-block; padding: 0.25rem 0.6rem; border-radius: 2px;
  background: #2a2a2a; color: #e0e0e0; font-size: 0.78rem; font-weight: 600;
}
.__ik-jnode.__ik-current { background: #065f46; color: #6ee7b7; }
.__ik-jarrow {
  display: inline-block; color: #ff6b35; margin: 0 0.3rem;
  font-size: 0.85rem; font-weight: 700;
}
.__ik-jpath { margin-bottom: 1rem; line-height: 2; }
.__ik-jtransition {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #2a2a2a; border-left: 3px solid #a78bfa; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jtransition-label { color: #e0e0e0; }
.__ik-jtransition-count { color: #a78bfa; font-weight: 700; font-size: 0.78rem; }
.__ik-jprediction {
  padding: 0.4rem 0.6rem; margin-bottom: 0.3rem; border-radius: 2px;
  background: #1a2e1a; border-left: 3px solid #10b981; line-height: 1.4;
  display: flex; justify-content: space-between; align-items: center;
}
.__ik-jprediction-label { color: #6ee7b7; }
.__ik-jprediction-prob { color: #10b981; font-weight: 700; font-size: 0.78rem; }

@media (max-width: 768px) {
  .__ik-panel { width: 100%; right: -100%; }
}
`;function A({onClear:c,journeyTracker:o}){let m=document.createElement("style");m.textContent=W,document.head.appendChild(m);let u=document.createElement("button");u.className="__ik-fab",u.innerHTML="&#9881;",u.title="SignalTracker Debug";let f=document.createElement("div");f.className="__ik-panel",f.innerHTML=`
    <div class="__ik-header">
      <span class="__ik-title">SignalTracker Debug</span>
      <button class="__ik-close">&times;</button>
    </div>
    <div class="__ik-tabs">
      <button class="__ik-tab __ik-active" data-tab="events">Events</button>
      <button class="__ik-tab" data-tab="intents">Signals</button>
      <button class="__ik-tab" data-tab="profile">Profile</button>
      <button class="__ik-tab" data-tab="recs">Recs</button>
      <button class="__ik-tab" data-tab="journey">Journey</button>
    </div>
    <div class="__ik-content"></div>
    <div class="__ik-footer">
      <button class="__ik-clear">Clear All Data</button>
    </div>
  `,document.body.appendChild(u),document.body.appendChild(f);let i=f.querySelector(".__ik-content"),M=f.querySelectorAll(".__ik-tab"),v="events",h="__ik_debug_events",S="__ik_debug_intents",T="__ik_debug_recs";function b(n){try{let r=localStorage.getItem(n);return r?JSON.parse(r):[]}catch{return[]}}function w(n,r){try{localStorage.setItem(n,JSON.stringify(r))}catch{}}let l=b(h),g=b(S),t=null,k=b(T);u.addEventListener("click",()=>{f.classList.add("__ik-open"),u.style.display="none"}),f.querySelector(".__ik-close").addEventListener("click",()=>{f.classList.remove("__ik-open"),u.style.display="flex"}),M.forEach(n=>{n.addEventListener("click",()=>{M.forEach(r=>r.classList.remove("__ik-active")),n.classList.add("__ik-active"),v=n.dataset.tab,d()})}),f.querySelector(".__ik-clear").addEventListener("click",()=>{l.length=0,g.length=0,t=null,k=[],w(h,[]),w(S,[]),w(T,[]),c&&c(),d()});function d(){switch(v){case"events":s();break;case"intents":_();break;case"profile":e();break;case"recs":p();break;case"journey":I();break}}function s(){if(l.length===0){i.innerHTML='<div class="__ik-empty">Interact with the page to see events...</div>';return}i.innerHTML=[...l].reverse().map(n=>{let r=new Date(n.timestamp).toLocaleTimeString(),a="";switch(n.type){case"view":a=`${n.itemId} (${Math.round(n.dwellMs/100)/10}s)`;break;case"hover":a=`${n.itemId} (${Math.round(n.dwellMs/100)/10}s hover)`;break;case"click":a=n.itemId;break;case"search":a=`"${n.query}"`;break;case"tab_view":a=n.tabId+(n.tags&&n.tags.length?` [${n.tags.join(", ")}]`:"");break;case"page_view":a=n.pageMeta?n.pageMeta.name:"page";break}return`<div class="__ik-event __ik-${n.type}">
        <span class="__ik-etype __ik-${n.type}">${n.type}</span>
        <span class="__ik-edetail">${a}</span>
        <span class="__ik-etime">${r}</span>
      </div>`}).join("")}function _(){if(g.length===0){i.innerHTML='<div class="__ik-empty">No signals detected yet...</div>';return}let n=g.slice().sort((r,a)=>{let E=r.active!==!1?1:0,y=a.active!==!1?1:0;return E!==y?y-E:a.confidence-r.confidence});i.innerHTML=n.map(r=>{let a=r.confidence>=.7?"high":r.confidence>=.4?"medium":"low",E=r.active===!1;return`<div class="__ik-intent${E?" __ik-inactive":""}">
        <div class="__ik-isummary">${r.summary}${E?' <span class="__ik-faded">faded</span>':""}</div>
        <div class="__ik-imeta">
          <span class="__ik-conf __ik-${a}">${Math.round(r.confidence*100)}%</span>
          ${r.category} \xB7 ${Math.round(r.sourceEventCount)} events \xB7 [${r.tags.join(", ")}]
        </div>
      </div>`}).join("")}function e(){if(!t||Object.keys(t.tagWeights).length===0){i.innerHTML='<div class="__ik-empty">No profile data yet.</div>';return}let n=Object.entries(t.tagWeights).sort((a,E)=>E[1]-a[1]),r=n.length>0?n[0][1]:1;i.innerHTML=`
      <div class="__ik-psection"><h4>Sessions: ${t.sessions.length}</h4></div>
      <div class="__ik-psection"><h4>Tag Weights</h4>
        ${n.map(([a,E])=>`
          <div class="__ik-tw">
            <span class="__ik-tw-name">${a}</span>
            <div class="__ik-tw-bar"><div class="__ik-tw-fill" style="width:${E/r*100}%"></div></div>
            <span class="__ik-tw-val">${E.toFixed(2)}</span>
          </div>
        `).join("")}
      </div>`}function p(){if(k.length===0){i.innerHTML='<div class="__ik-empty">No recommendations yet.</div>';return}i.innerHTML=k.map(n=>`
      <div class="__ik-rec">
        <div class="__ik-rec-name">${n.item?.name||n.itemId}</div>
        <div class="__ik-rec-reason">${n.reason}</div>
        <div class="__ik-rec-score">Score: ${n.score} \xB7 Tags: [${n.matchedTags.join(", ")}]</div>
      </div>
    `).join("")}function I(){if(!o){i.innerHTML='<div class="__ik-empty">Journey tracking not enabled.</div>';return}let n=o.getCurrentPath(),r=o.getCurrentPage(),a=o.getTopTransitions(10),E=r?o.predictNextPages(r.name,3):[],y="";y+='<div class="__ik-psection"><h4>Current Path</h4>',n.length===0?y+='<div class="__ik-empty">No pages visited yet.</div>':(y+='<div class="__ik-jpath">',n.forEach((x,O)=>{let z=r&&x===r.name&&O===n.length-1;y+=`<span class="__ik-jnode${z?" __ik-current":""}">${x}</span>`,O<n.length-1&&(y+='<span class="__ik-jarrow">&rarr;</span>')}),y+="</div>"),y+="</div>",y+='<div class="__ik-psection"><h4>Top Transitions</h4>',a.length===0?y+='<div class="__ik-empty">No transitions recorded yet.</div>':a.forEach(x=>{y+=`<div class="__ik-jtransition">
          <span class="__ik-jtransition-label">${x.from} &rarr; ${x.to}</span>
          <span class="__ik-jtransition-count">${x.count}&times;</span>
        </div>`}),y+="</div>",y+='<div class="__ik-psection"><h4>Predicted Next</h4>',E.length===0?y+='<div class="__ik-empty">Not enough data for predictions.</div>':E.forEach(x=>{y+=`<div class="__ik-jprediction">
          <span class="__ik-jprediction-label">${x.page}</span>
          <span class="__ik-jprediction-prob">${Math.round(x.probability*100)}%</span>
        </div>`}),y+="</div>",i.innerHTML=y}return{logEvent(n){l.push(n),l.length>100&&l.shift(),w(h,l),v==="events"&&d()},replaceIntents(n){let r=new Set(n.map(a=>a.category+":"+a.tags.slice().sort().join(",")));g.forEach(a=>{let E=a.category+":"+a.tags.slice().sort().join(",");r.has(E)||(a.confidence=(a.confidence||0)*.8,a.confidence<.05&&(a.active=!1))}),n.forEach(a=>{let E=a.category+":"+a.tags.slice().sort().join(","),y=g.findIndex(x=>x.category+":"+x.tags.slice().sort().join(",")===E);a.active=!0,y>=0?g[y]=a:g.push(a)}),w(S,g),v==="intents"&&d()},logProfile(n){t=n,v==="profile"&&d()},logRecommendations(n){k=n,w(T,n),v==="recs"&&d()},logJourney(){v==="journey"&&d()},destroy(){u.remove(),f.remove(),m.remove()}}}var N="ik_journey";function H(){let c=o();function o(){try{let l=localStorage.getItem(N);if(l)return JSON.parse(l)}catch{}return m()}function m(){return{currentPage:null,currentPath:[],steps:[],transitionGraph:{},pageVisitCounts:{},recentPaths:[]}}function u(){try{localStorage.setItem(N,JSON.stringify(c))}catch{}}function f(){c.currentPage&&c.currentPage.enteredAt&&Date.now()-c.currentPage.enteredAt>18e5&&(c.currentPath.length>1&&(c.recentPaths.push([...c.currentPath]),c.recentPaths.length>10&&c.recentPaths.shift()),c.currentPage=null,c.currentPath=[])}function i(l){f();let g=c.currentPage,t={name:l.name,category:l.category||null,url:l.url||null,enteredAt:Date.now()};if(g){let k={from:{name:g.name,category:g.category,url:g.url},to:{name:t.name,category:t.category,url:t.url},timestamp:Date.now()};c.steps.push(k),c.steps.length>200&&(c.steps=c.steps.slice(-200));let d=g.name+"->"+t.name;c.transitionGraph[d]||(c.transitionGraph[d]={count:0,lastSeen:0}),c.transitionGraph[d].count++,c.transitionGraph[d].lastSeen=Date.now()}c.pageVisitCounts[t.name]=(c.pageVisitCounts[t.name]||0)+1,c.currentPath.push(t.name),c.currentPage=t,u()}function M(l,g=3){let t=l+"->",k=[];if(Object.entries(c.transitionGraph).forEach(([s,_])=>{if(s.startsWith(t)){let e=s.slice(t.length),I=(Date.now()-_.lastSeen)/(1e3*60*60),n=1+Math.max(0,.5-I*.02);k.push({page:e,score:_.count*n})}}),k.length===0)return[];let d=k.reduce((s,_)=>s+_.score,0);return k.sort((s,_)=>_.score-s.score).slice(0,g).map(s=>({page:s.page,probability:Math.round(s.score/d*100)/100}))}function v(l=10){return Object.entries(c.transitionGraph).sort((g,t)=>t[1].count-g[1].count).slice(0,l).map(([g,t])=>{let[k,d]=g.split("->");return{from:k,to:d,count:t.count,lastSeen:t.lastSeen}})}function h(){let l=[],g={};return Object.entries(c.pageVisitCounts).forEach(([t,k])=>{let d=c.steps.find(_=>_.to.name===t||_.from.name===t),s=null;d&&(s=d.to.name===t?d.to.category:d.from.category),!s&&c.currentPage&&c.currentPage.name===t&&(s=c.currentPage.category),s&&s!=="home"&&(g[s]=(g[s]||0)+k)}),Object.entries(g).forEach(([t,k])=>{k>=3&&l.push({id:"journey-"+t,timestamp:Date.now(),summary:`Frequently visits ${t} pages`,tags:[t],confidence:Math.min(k/10,1),category:"journey_affinity",sourceEventCount:k})}),l}function S(){return[...c.currentPath]}function T(){return c.currentPage}function b(){return{...c}}function w(){c=m();try{localStorage.removeItem(N)}catch{}}return{recordPageView:i,predictNextPages:M,getTopTransitions:v,deriveJourneyIntents:h,getCurrentPath:S,getCurrentPage:T,getState:b,clearAll:w}}function q(c={}){let{reference:o={},storageKey:m="ik_profile",flushInterval:u=5e3,debug:f=!1,root:i=document.body,pageMeta:M=null,trackViews:v=!1,onIntentsChanged:h=null,onRecommendations:S=null}=c,T="session-"+Date.now(),b=L(o),w=new C(m),l=new j(b),g=new $(b),t=null,k=[],d=H(),s=M||{name:document.title||location.pathname,category:null,url:location.pathname};d.recordPageView(s),f&&(t=A({journeyTracker:d,onClear(){w.clearAll(),e.clearBuffer(),d.clearAll(),k=[]}}));function _(r){let a=l.summarize(r);if(d.deriveJourneyIntents().forEach(y=>{a.find(x=>x.category===y.category&&x.tags.join(",")===y.tags.join(","))||a.push(y)}),t&&t.logJourney(),a.length>0){k=a,t&&t.replaceIntents(a),w.saveSessionIntents(T,a);let y=w.getProfile();t&&t.logProfile(y),h&&h(a,y);let x=g.recommend(y);t&&t.logRecommendations(x),S&&S(x)}}let e=D({catalog:b,flushInterval:u,trackViews:v,onEvent(r){t&&t.logEvent(r)},onFlush:_});b.scanItems(i);let p=b.getAllItems();e.observeNew(p);let I=new MutationObserver(r=>{let a=[];if(r.forEach(E=>{E.addedNodes.forEach(y=>{y.nodeType===1&&a.push(y)})}),a.length>0){let E=b.scanNewElements(a);E.length>0&&e.observeNew(E)}});I.observe(i,{childList:!0,subtree:!0}),e.trackPageView(s),t&&t.logJourney();let n=w.getProfile();if(n&&n.sessions.length>0){t&&t.logProfile(n);let r=g.recommend(n);r.length>0&&(t&&t.logRecommendations(r),S&&S(r))}return{trackClick(r){e.trackClick(r)},trackSearch(r){e.trackSearch(r)},trackTabView(r,a=[]){e.trackTabView(r,a)},recommend(r=6){return g.recommend(w.getProfile(),r)},getProfile(){return w.getProfile()},getIntents(){return[...k]},scan(){let r=b.getSelector();if(!r)return;let a=b.scanNewElements(Array.from(i.querySelectorAll(r)).map(E=>E));a.length>0&&e.observeNew(a)},clear(){w.clearAll(),e.clearBuffer(),d.clearAll(),k=[]},trackPageView(r){d.recordPageView(r),e.trackPageView(r),t&&t.logJourney()},getJourney(){return d.getState()},predictNext(r=3){let a=d.getCurrentPage();return a?d.predictNextPages(a.name,r):[]},destroy(){e.destroy(),I.disconnect(),t&&t.destroy()}}}var P={items:{}};try{let c=localStorage.getItem("__signal_tracker_reference");c&&(P=JSON.parse(c),console.log("[SignalTracker] Loaded reference from localStorage:",Object.keys(P.items).length,"items"))}catch(c){console.warn("[SignalTracker] Failed to parse stored reference:",c.message)}if(Object.keys(P.items).length===0){let c=prompt(`SignalTracker: No reference file found.

Paste a reference JSON (from the Site Scanner), or cancel to use an empty config.

Tip: Use the Site Scanner at http://localhost:8082 to generate one.`);if(c)try{P=JSON.parse(c),localStorage.setItem("__signal_tracker_reference",c),console.log("[SignalTracker] Reference saved:",Object.keys(P.items).length,"items")}catch(o){console.error("[SignalTracker] Invalid JSON:",o.message)}}window.__legacyIntentTracker?console.log("[SignalTracker] Already active on this page"):(window.__legacyIntentTracker=q({reference:P,root:document.body,debug:!0,trackViews:!0}),console.log("[SignalTracker] Bookmarklet injected \u2014 tracking",Object.keys(P.items).length,"elements"));})();
