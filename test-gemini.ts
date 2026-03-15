import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCqsaGaq-sR07vxa5UGQdc3CUNXnCfF1fQ";
const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
  const models = ['gemini-pro-vision', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  
  for (const name of models) {
    try {
      console.log(`Testing ${name}...`);
      const model = genAI.getGenerativeModel({ model: name });
      const result = await model.generateContent("Say hi");
      console.log(`✅ ${name} SUCCESS:`, result.response.text());
    } catch (e: any) {
      console.log(`❌ ${name} ERROR:`, e.message);
    }
  }
}

testModels();
