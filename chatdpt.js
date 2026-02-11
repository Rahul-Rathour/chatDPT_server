import express from "express";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { tavily } from "@tavily/core";
import cors from "cors";
import NodeCache from "node-cache";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 }); // 24 hours

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function generate(userMessage, threadId) {
    const baseMessages = [
        {
            role: "system",
            content: `You are a smart personal assistant.
                If you know the answer to a question, answer it directly in plain english.
                If the answer requires real-time, local or up-to-date information, or if you don't know the answer, use the available tools to find it.
                You have access to the following tool:
                webSearch(query: string): use this to search the internet for current or unknown information.
                Decide when to use your own knowledge and when to use the tool.
                
                Examples:
                Q: What is the capital of france?
                A: The capital of France is Paris.
                
                Q: What's the weather in mumbai right now?
                A: (use the search tool to find the latest weather)
                
                Q: Who is the prime minister of India?
                A: The current prime minister of India is Narendra Modi.
            
                Q: Tell me the latest IT news.
                A: (Use the search tool to get the latest News).
            
                current date and time: ${new Date().toUTCString()}
            `

        },
        // {
        //     role: "user",
        //     content: "What is the current weather of bareilly?"
        // }
    ];

    const messages = cache.get(threadId) ?? baseMessages;

    messages.push({
        role: "user",
        content: userMessage,
    })
    while (true) {

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "webSearch",
                        description: "search the latest information and real time data on the internet.",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "The search query to perform search on." }
                            },
                            required: ["query"]
                        }
                    }
                }
            ],
            tool_choice: 'auto',
        });

        messages.push(completion.choices[0].message);
        const toolCalls = completion.choices[0].message.tool_calls;
        if (!toolCalls) {
            // here we end the chatDPT response
            cache.set(threadId, messages);
            // console.log(cache);
            return completion.choices[0].message.content; // final response from the chatDPT
        }

        if (toolCalls) {
            for (const tool of toolCalls) {
                const functionName = tool.function.name;
                const functionParams = JSON.parse(tool.function.arguments);

                if (functionName === 'webSearch') {
                    const toolResult = await webSearch(functionParams);

                    messages.push({
                        tool_call_id: tool.id,
                        role: 'tool',
                        name: functionName,
                        content: toolResult,
                    });
                }
            }

            // Call the model again with tool results for final response
            const finalCompletion = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: messages
            });

            // console.log("Assistant Final Response:", finalCompletion.choices[0].content);
        }
    }

}



async function webSearch({ query }) {
    console.log("Calling webSearch...");

    const response = await tvly.search(query);

    // console.log("Responsee: ", response);
    const finalResult = response.results.map(result => result.content).join('\n\n');

    // console.log("Final Results: ",finalResult);

    return finalResult;
}