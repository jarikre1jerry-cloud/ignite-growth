const fs = require('fs');
const file = './src/App.js';
let code = fs.readFileSync(file, 'utf8');

const newFirst = `async function callFirstResponse(struggling, improve, userName) {
  const system = COACH_SYSTEM + \`\\n\\nFor this FIRST response only, reply in this exact JSON — no markdown, no preamble:\\n{"understanding":"2-3 sentences on the root challenge. Be direct.","strategy":["Step 1 — concrete","Step 2","Step 3","Step 4"],"daily_actions":["Action 1 with timing","Action 2","Action 3"],"mindset_note":"One sharp reframe. Not a cliche.","followup":"One sharp follow-up question."}\`;
  const res = await fetch("/api/coach", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ system, messages:[{role:"user", content:"My name is "+userName+".\\n\\nWhat I am struggling with:\\n"+struggling+"\\n\\nWhat I want to improve:\\n"+improve}] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return JSON.parse((data.text || "{}").replace(/\`\`\`json|\`\`\`/g,"").trim());
}`;

const newFollow = `async function callFollowUp(messages) {
  const res = await fetch("/api/coach", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ system: COACH_SYSTEM, messages }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || "";
}`;

// Replace callFirstResponse function
code = code.replace(/async function callFirstResponse[\s\S]*?(?=\nasync function callFollowUp)/, newFirst + '\n\n');

// Replace callFollowUp function  
code = code.replace(/async function callFollowUp[\s\S]*?(?=\nfunction useToast)/, newFollow + '\n\n');

fs.writeFileSync(file, code);
console.log('Success! AI functions updated.');