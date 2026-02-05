import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import cors from "cors";
import { generate } from "./chatdpt.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("welcome")
})

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  console.log("message: ", message);
  
  const result = await generate(message);
  res.json({
    status: true,
    message: result
  });
  // console.log("Output: ",result);
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
