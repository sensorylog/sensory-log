const root=document.querySelector(".wrap");
const legacy=document.querySelector(".card");
if(root&&legacy){
  const q=s=>document.querySelector(s);
  const click=(id,cls)=>{const el=q("#"+id+" button."+cls);if(el)el.click()};
  const selected=(id,cls)=>{const el=q("#"+id+" button."+cls);return el?el.textContent.trim():""};
  const labels={energy:["Energy","How much capacity do you have right now?"],overwhelm:["Sensory load","How full does your system feel?"],masking:["Masking","How much have you been performing, holding back, or adapting?"],body:["Body","Anything your body is telling you? You can skip this."],drains:["Drains","What has taken something out of you?"],recovery:["Recovery","How much recovery does your system seem to need?"],helped:["Help","Has anything helped so far?"]};
  const shell=document.createElement("section");shell.className="sl-checkin";shell.id="slCheckin";
  shell.innerHTML='<div class="sl-checkin-shell"><div class="sl-checkin-top"><div><div class="sl-checkin-kicker">Check in</div><h2 class="sl-checkin-title">Notice first. Explain later.</h2><p class="sl-checkin-sub">A few signals are enough. Everything else is optional.</p></div><div class="sl-checkin-progress" aria-label="Check-in progress"><i class="active"></i><i></i><i></i></div></div><div class="sl-checkin-step active" data-step="0"><p class="sl-prompt">How much capacity do you have right now?</p><p class="sl-helper">1 is depleted. 5 feels solid.</p><div class="sl-checkin-scale" id="newEnergy"></div><div class="sl-scale-caption"><span>Depleted</span><span>Solid</span></div><div class="sl-checkin-date"><span>Logging</span><input type="date" id="newDate"></div><div class="sl-checkin-nav"><button class="next" type="button">Continue</button></div></div><div class="sl-checkin-step" data-step="1"><p class="sl-prompt">What is your system noticing?</p><p class="sl-helper">Pick only what feels useful. You can leave this whole step blank.</p><div class="sl-checkin-choice" id="newContext"></div><div class="sl-checkin-summary" id="contextSummary"></div><div class="sl-checkin-nav"><button class="back" type="button">Back</button><button class="next" type="button">Continue</button></div></div><div class="sl-checkin-step" data-step="2"><p class="sl-prompt">What would support you?</p><p class="sl-helper">This is not a prescription. It is a place to notice what your own history says.</p><div class="sl-checkin-choice" id="newSupport"></div><div class="sl-checkin-summary" id="supportSummary"></div><div class="sl-checkin-nav"><button class="back" type="button">Back</button><button class="save" type="button">Save check-in</button><button class="sl-checkin-skip" id="moreDetails" type="button">Add more detail</button></div><div class="sl-checkin-message" id="newMessage"></div></div></div>';
  root.insertBefore(shell,legacy);
  legacy.style.display="none";
  q("#phoneTip")?.remove();
  const date=q("#newDate");date.value=q("#dateInput")?.value||new Date().toISOString().slice(0,10);
  date.onchange=()=>{if(q("#dateInput")){q("#dateInput").value=date.value;q("#dateInput").dispatchEvent(new Event("change"))}};
  const energy=q("#newEnergy");
  for(let i=1;i<=5;i++){const b=document.createElement("button");b.type="button";b.textContent=i;b.setAttribute("aria-label","Energy "+i+" of 5");b.onclick=()=>{click("energyScale","on-energy");const target=q("#energyScale button:nth-child("+i+")");if(target)target.click();render()};energy.appendChild(b)}
  const context=[["overwhelmScale","Sensory load","How full your system feels"],["maskingChips","Masking","How much you have been adapting"]];
  const support=[["recoveryScale","Recovery needed","How much space your system needs"],["socialScale","Social battery","Separate from overall energy"],["sleepScale","Sleep quality","Optional context"]];
  function build(list,id){
    const box=q("#"+id);box.innerHTML="";
    list.forEach(([cid,title,sub])=>{
      const wrap=document.createElement("div");wrap.style.gridColumn="1/-1";
      const p=document.createElement("p");p.className="sl-prompt";p.style.marginTop="7px";p.textContent=title;wrap.appendChild(p);
      const group=document.createElement("div");group.className="sl-checkin-choice";
      if(cid==="maskingChips"){
        ["None","1–2 h","3–5 h","6 h+"].forEach((label,i)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>{const t=q("#maskingChips button:nth-child("+(i+1)+")");if(t)t.click();render()};group.appendChild(b)});
      }else{
        for(let i=1;i<=5;i++){const b=document.createElement("button");b.type="button";b.textContent=i;b.onclick=()=>{const t=q("#"+cid+" button:nth-child("+i+")");if(t)t.click();render()};group.appendChild(b)}
      }
      wrap.appendChild(group);box.appendChild(wrap);
    });
  }
  build(context,"newContext");build(support,"newSupport");
  function render(){
    const vals={energy:selected("energyScale","on-energy"),overwhelm:selected("overwhelmScale","on-overwhelm"),masking:selected("maskingChips","active"),recovery:selected("recoveryScale","on-recovery"),social:selected("socialScale","on-social")};
    const e=q("#newEnergy").children;for(let i=0;i<e.length;i++)e[i].classList.toggle("active",!!vals.energy&&i<Number(vals.energy));
    q("#contextSummary").innerHTML=(vals.overwhelm||vals.masking)?("<strong>Noted:</strong> "+[vals.overwhelm?"sensory load "+vals.overwhelm:"",vals.masking?"masking "+vals.masking:""].filter(Boolean).join(" · ")):"Nothing selected here — that is completely fine.";
    q("#supportSummary").innerHTML=(vals.recovery||vals.social)?("<strong>Noted:</strong> "+[vals.recovery?"recovery "+vals.recovery:"",vals.social?"social battery "+vals.social:""].filter(Boolean).join(" · ")):"No support signal selected yet.";
  }
  function go(n){shell.querySelectorAll(".sl-checkin-step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===n));shell.querySelectorAll(".sl-checkin-progress i").forEach((x,i)=>x.classList.toggle("active",i<=n));render()}
  shell.querySelectorAll("[data-step='0'] .next").forEach(b=>b.onclick=()=>go(1));
  shell.querySelectorAll("[data-step='1'] .back").forEach(b=>b.onclick=()=>go(0));
  shell.querySelectorAll("[data-step='1'] .next").forEach(b=>b.onclick=()=>go(2));
  shell.querySelectorAll("[data-step='2'] .back").forEach(b=>b.onclick=()=>go(1));
  q("#moreDetails").onclick=()=>{legacy.style.display="block";q("#moreDetails").textContent="Detailed fields are open below";q("#moreDetails").disabled=true;legacy.scrollIntoView({behavior:"smooth",block:"start"})};
  shell.querySelector(".save").onclick=()=>{const hidden=q("#saveBtn");if(hidden){hidden.click();setTimeout(()=>{const err=q("#errorMsg");const msg=q("#newMessage");if(err&&err.style.display!=="none"){msg.textContent=err.textContent}else{msg.textContent="Saved. You can leave the rest for another day."}},80)}};
  render();
}
