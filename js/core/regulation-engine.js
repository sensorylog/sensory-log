/**
 * Sensory Log — Phase F regulation engine.
 * Maps the current derived state to a small set of regulation needs and actions.
 * Descriptive guidance only; never a diagnosis or clinical prescription.
 */
const clamp=(v,min=0,max=5)=>Math.min(max,Math.max(min,Number(v)));
const finite=v=>v===null||v===undefined||v===""?null:Number.isFinite(Number(v))?Number(v):null;

const ACTIONS=Object.freeze({
  lessInput:{id:"less-input",title:"Lower the input",summary:"Make the environment quieter, simpler, or less demanding.",mode:"sensory",actions:["Move to a quieter or visually simpler place.","Lower light, sound, notifications, or conversation if useful.","Give yourself a few minutes before taking on the next demand."]},
  lowerDemand:{id:"lower-demand",title:"Reduce the demand",summary:"Protect limited capacity instead of pushing through it.",mode:"shutdown",actions:["Pause tasks that do not need an answer right now.","Choose one tiny next action or choose rest.","Use a short message or gesture if talking feels like work."]},
  recovery:{id:"recovery",title:"Make room for recovery",summary:"Treat recovery as something to do, not something to earn.",mode:"away",actions:["Find a familiar low-demand space.","Reduce decisions and incoming requests.","Rest, hydrate, eat, or use a familiar regulating activity."]},
  social:{id:"social",title:"Create social space",summary:"Reduce social demand while your battery is low.",mode:"away",actions:["Pause conversations that can wait.","Move somewhere you can be alone or quieter.","Use a simple boundary such as “I need some quiet time.”"]},
  performance:{id:"performance",title:"Drop the performance",summary:"Reduce masking and let familiar regulation be easier to access.",mode:"shutdown",actions:["Choose the most familiar, comfortable environment available.","Stop performing a version of yourself you do not need right now.","Let a familiar movement, sound, posture, or object be enough."]},
  observe:{id:"observe",title:"Notice before changing anything",summary:"There is not one dominant signal yet.",mode:"unknown",actions:["Pause for a moment.","Notice sensory input, energy, body tension, hunger/thirst, and social demand.","Change one input at a time and notice whether it feels easier, the same, or harder."]}
});

export function deriveRegulationNeeds(state){
  if(!state) return [{id:"observe",...ACTIONS.observe,priority:0,reason:"No current state is available yet."}];
  const needs=[];
  const add=(id,priority,reason)=>needs.push({id,...ACTIONS[id],priority,reason});
  const sensory=finite(state.loads?.sensory), social=finite(state.loads?.social), masking=finite(state.loads?.masking), recovery=finite(state.loads?.recoveryNeed), capacity=finite(state.capacity);
  if(sensory!==null&&sensory>=4) add("lessInput",100,"Sensory load is high.");
  if(capacity!==null&&capacity<=2) add("lowerDemand",90,"Current capacity is low.");
  if(recovery!==null&&recovery>=4) add("recovery",80,"Recovery need is high.");
  if(social!==null&&social>=4) add("social",70,"Social battery is low.");
  if(masking!==null&&masking>=3.34) add("performance",60,"Masking load is elevated.");
  if(!needs.length) add("observe",10,"No single regulation need is dominant.");
  return needs.sort((a,b)=>b.priority-a.priority);
}

export function buildRegulationPlan(state){
  const needs=deriveRegulationNeeds(state);
  return Object.freeze({
    version:1,
    primary:needs[0],
    alternatives:needs.slice(1,3),
    stateSummary: state?.capacity==null ? "Current capacity is unknown." : `Current capacity: ${state.capacity.toFixed(1)}/5.`,
    confidence: state?.confidence ?? 0
  });
}

export { ACTIONS as REGULATION_ACTIONS };
