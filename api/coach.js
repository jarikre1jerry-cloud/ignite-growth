export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const GEMINI_KEY = "AIzaSyD6dd-a4ZLgpbpzkab1p6O04A-KVvpXnMk";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  try {
    const { prompt } = req.body;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}