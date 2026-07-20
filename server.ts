import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

// Initialize Gemini SDK lazily to prevent crashing on boot if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limit for base64 images
  app.use(express.json({ limit: "15mb" }));

  // API Health Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Endpoint to explain a spelling mistake to a 9-year-old child in friendly English
  app.post("/api/gemini/explain-mistake", async (req, res) => {
    const { word, typed, sentence, definition, childName } = req.body || {};
    try {
      if (!word) {
        return res.status(400).json({ error: "Missing correct spelling word in request." });
      }

      const ai = getGeminiClient();

      const systemInstruction = `
        You are Mr Minions, a funny, warm, and extremely supportive F1 racing spelling coach for a 9-year-old child named ${childName || "Daniel"}.
        The child's native language is English. Keep your feedback EXTREMELY short, punchy, and direct to the point (maximum 1 or 2 very short sentences). No long-winded intros or wordy chit-chat!
        
        Follow these strict guidelines:
        1. Keep it incredibly brief: 1 or 2 short sentences total. Get straight to the key point!
        2. Explain only the core visual or phonics mistake comparing correct "${word}" with child's typed answer "${typed || ""}" (e.g., "You swapped the 'a' and 'e'!").
        3. Give a super brief racing metaphor or encouragement.
        4. No dry jargon. Keep it ultra-clean, fun, and easy for a 9-year-old to read instantly. Use emojis!
      `;

      const prompt = `
        Correct word: "${word}"
        Child's typed answer: "${typed || ""}"
        Sentence context: "${sentence || ""}"
        Child-friendly dictionary definition (if available): "${definition || ""}"
        
        Please write an ultra-short, punchy 1-2 sentence tutoring explanation in English for ${childName || "Daniel"}. Keep it very brief!
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "The 9-year-old friendly explanation in English. MUST be extremely short, only 1-2 sentences max, straight to the point."
              },
              tip: {
                type: Type.STRING,
                description: "A super short spelling mnemonic tip in English, max 6 words (e.g., 'Tip: Silent 'e' at the end!')."
              }
            },
            required: ["explanation", "tip"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned empty response for explanation.");
      }

      const parsed = JSON.parse(responseText.trim());
      res.json(parsed);

    } catch (error: any) {
      console.error("Gemini Explanation Error:", error);
      // Fallback local explanation generator if Gemini is offline/errored
      res.json({
        explanation: `Whoops! So close to the finish line! 🏎️ "${word}" means "${definition || "this spelling word"}". You almost nailed it!`,
        tip: `Tip: Check the middle letters next time!`
      });
    }
  });

  // API Endpoint to parse spelling list image using Gemini
  app.post("/api/gemini/extract", async (req, res) => {
    try {
      const { image, mimeType } = req.body;

      if (!image || !mimeType) {
        return res.status(400).json({ error: "Missing image or mimeType in request body." });
      }

      const ai = getGeminiClient();

      const systemInstruction = `
        You are a supportive, high-accuracy educational AI assistant.
        Your task is to analyze an uploaded photo of a child's spelling list or worksheet and extract the spelling words and their surrounding sentences.
        
        Guidelines:
        1. Identify the list title, usually formatted as 'Week [X] - Spelling [Y]' or similar.
        2. Look for any handwritten dates or notes indicating when the test is (e.g., '7 July', '14 July', or 'Tuesday').
        3. For each numbered item:
           - Identify the main spelling word. This is usually **bolded**, <u>underlined</u>, or written separately.
           - Extract the full sentence context exactly. Do NOT blank out the spelling word in the sentence; keep it in the sentence.
        4. Be extremely careful with spelling accuracy. Double-check all letters of the extracted spelling word.
        5. If there is handwritten text or corrections, prioritize the clean printed word first, but try to accurately capture the intended content.
        6. For each target word, generate a kid-friendly dictionary definition (simple words), 2-4 easy synonyms (similar words), and 2-4 easy antonyms (opposite words) suitable for a primary school student.
      `;

      const prompt = "Please look at this spelling list image and extract the week title, any dates, and the spelling items (id, target word, and full sentence text, plus child-friendly definitions, synonyms, and antonyms).";

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: image,
        },
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, { text: prompt }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              week: {
                type: Type.STRING,
                description: "The name of the spelling list (e.g. 'Week 2 - Spelling 9')."
              },
              date: {
                type: Type.STRING,
                description: "The date of the spelling test written on the sheet, if visible (e.g. '7 July')."
              },
              items: {
                type: Type.ARRAY,
                description: "The list of spelling words and sentences with child-friendly definitions and synonyms/antonyms.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.INTEGER,
                      description: "The item number, starting from 1."
                    },
                    word: {
                      type: Type.STRING,
                      description: "The target spelling word that will be tested (bolded/underlined in text)."
                    },
                    text: {
                      type: Type.STRING,
                      description: "The full sentence containing the spelling word."
                    },
                    definition: {
                      type: Type.STRING,
                      description: "A child-friendly definition explaining what the word means using simple language."
                    },
                    synonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "2 to 4 simple synonym words or short phrases."
                    },
                    antonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "2 to 4 simple antonym words or short phrases."
                    }
                  },
                  required: ["id", "word", "text", "definition", "synonyms", "antonyms"]
                }
              }
            },
            required: ["week", "items"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      // Parse the JSON output from Gemini
      const parsedData = JSON.parse(text.trim());
      res.json(parsedData);

    } catch (error: any) {
      console.error("Gemini Extraction Error:", error);
      res.status(500).json({
        error: error.message || "Failed to extract spelling list from image.",
        details: "Ensure your GEMINI_API_KEY is configured correctly in the Secrets panel."
      });
    }
  });

  // API Endpoint to generate a spelling list from raw word list / text input
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { text, language } = req.body;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Missing word list text in request body." });
      }

      const ai = getGeminiClient();

      const systemInstruction = `
        You are a supportive, high-accuracy educational AI assistant.
        Your task is to take a raw list of spelling words (entered by a parent) and generate a complete spelling practice list for next week's practice.
        The input might be a comma-separated list of words, newlines, or a paragraph. Extract all the unique target spelling/dictation words first.
        
        Guidelines:
        1. List Week Title should be formatted as 'Next Week\'s Practice - 下周听写' or 'Weekly Spelling List'.
        2. For each identified spelling word:
           - Maintain the target word exactly.
           - Generate a natural, high-quality, primary-school-appropriate dictation sentence containing the word.
             If language is 'zh' (Chinese), write a Chinese sentence. If 'en' (English), write an English sentence.
             Do NOT blank out the spelling word in the sentence; keep it in the sentence.
           - Generate a kid-friendly dictionary definition explaining what the word means using simple language.
           - Generate 2 to 4 simple synonyms (similar meaning words) appropriate for kids.
           - Generate 2 to 4 simple antonyms (opposite meaning words) appropriate for kids.
        3. Double-check all letters of spelling words for strict correctness.
      `;

      const prompt = `Please analyze this raw list/text of spelling words and generate a structured spelling list with child-friendly sentences, definitions, synonyms, and antonyms.
      Target Language: ${language || "zh"}
      Raw Word List Input:
      ${text}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              week: {
                type: Type.STRING,
                description: "A friendly name for next week's practice list (e.g. 'Next Week\'s Practice - 下周听写练习')."
              },
              items: {
                type: Type.ARRAY,
                description: "The list of spelling words and sentences with child-friendly definitions and synonyms/antonyms.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: {
                      type: Type.INTEGER,
                      description: "The item number, starting from 1."
                    },
                    word: {
                      type: Type.STRING,
                      description: "The target spelling/dictation word."
                    },
                    text: {
                      type: Type.STRING,
                      description: "A full, natural example sentence containing the spelling word, suitable for children."
                    },
                    definition: {
                      type: Type.STRING,
                      description: "A child-friendly definition explaining what the word means using simple language."
                    },
                    synonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "2 to 4 simple synonym words or short phrases."
                    },
                    antonyms: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "2 to 4 simple antonym words or short phrases."
                    }
                  },
                  required: ["id", "word", "text", "definition", "synonyms", "antonyms"]
                }
              }
            },
            required: ["week", "items"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned an empty response.");
      }

      const parsedData = JSON.parse(responseText.trim());
      res.json(parsedData);

    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate spelling list from text.",
        details: "Ensure your GEMINI_API_KEY is configured correctly in the Secrets panel."
      });
    }
  });

  // Handle Vite middleware in development vs static file serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
