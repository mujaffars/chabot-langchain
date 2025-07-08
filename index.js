// index.js
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { RetrievalQAChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import { getRetriever } from './retriever.js';

dotenv.config();

const app = express();
const sessions = {};

app.use(bodyParser.json());

const model = new ChatOpenAI({ temperature: 0 });

let chain;

app.post('/ask', async (req, res) => {

  const secret = req.headers['x-chatbot-secret'];

  if (secret !== process.env.CHATBOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const question = req.body.question;

    if (!chain) {
      const retriever = await getRetriever(); // May fail
      chain = await RetrievalQAChain.fromLLM(model, retriever); // May fail
    }

    const response = await chain.call({ query: question }); // May fail
    res.json({ answer: response.text });
  } catch (err) {
    console.error("❌ ERROR:", err);  // <--- ADD THIS
    res.status(500).json({ error: "Error processing request" });
  }
});

app.post('/asksteps', async (req, res) => {
  const secret = req.headers['x-chatbot-secret'];
  if (secret !== process.env.CHATBOT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sessionId = req.body.sessionId || 'default';
  const userInput = (req.body.question || "").trim();

  if (!userInput) {
    return res.status(400).json({ answer: "Please enter something." });
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      step: 1,
      data: {},
      flowComplete: false,
    };
  }

  const session = sessions[sessionId];

  try {
    // Step-by-step structured flow
    if (!session.flowComplete) {
      const { step, data } = session;

      switch (step) {
        case 1:
          session.step++;
          return res.json({ answer: "Step 1️⃣: What is your total compensation from your employer? (e.g., 80000)" });
        case 2:
          if (isNaN(userInput)) return res.json({ answer: "❌ Please enter a number for compensation." });
          data.compensation = parseFloat(userInput);
          session.step++;
          return res.json({ answer: "Step 2️⃣: What is your Plan Premium? (e.g., 5000)" });
        case 3:
          if (isNaN(userInput)) return res.json({ answer: "❌ Please enter a number for premium." });
          data.premium = parseFloat(userInput);
          session.step++;
          return res.json({ answer: "Step 3️⃣: Estimate your Healthcare Expenses (e.g., 2000)" });
        case 4:
          if (isNaN(userInput)) return res.json({ answer: "❌ Please enter a number for expenses." });
          data.expenses = parseFloat(userInput);
          session.step++;
          return res.json({
            answer: `Step 4️⃣: Pick your Filing Status:\n1️⃣ Single\n2️⃣ Head of Household\n3️⃣ Married Filing Jointly\n4️⃣ Married Filing Separately`
          });
        case 5:
          const statusMap = {
            1: "Single",
            2: "Head of Household",
            3: "Married Filing Jointly",
            4: "Married Filing Separately"
          };
          const status = parseInt(userInput);
          if (![1, 2, 3, 4].includes(status)) return res.json({ answer: "❌ Please enter a valid filing status (1-4)." });
          data.filingStatus = status;

          session.flowComplete = true;

          const adjusted = data.compensation - data.premium - data.expenses;

          return res.json({
            answer: `✅ Thank you! Here's what we collected:\n
💼 Compensation: $${data.compensation}
💳 Premium: $${data.premium}
🩺 Expenses: $${data.expenses}
📄 Filing Status: ${statusMap[status]}
📊 Adjusted Amount: $${adjusted}\n
You can now ask me any question! 🤖`
          });
      }
    }

    // Once flow is complete: Langchain Q&A
    if (!chain) {
      const retriever = await getRetriever();
      chain = await RetrievalQAChain.fromLLM(model, retriever);
    }

    const response = await chain.call({ query: userInput });
    return res.json({ answer: response.text });

  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.status(500).json({ error: "Error processing request" });
  }
});

app.listen(3001, '127.0.0.1', () => {
  console.log("Server running on http://localhost:3001");
});
