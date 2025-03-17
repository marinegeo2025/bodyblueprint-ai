// ✅ FIXED FOR GLITCH: Backend for Meal Tracker App
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// ✅ Use OpenAI v3.2.1 (Compatible with Node.js 16)
const OpenAI = require("openai");

// Initialize Express
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("./"));

const port = process.env.PORT || 3000;

// Check if OpenAI API Key is available
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is not set in environment variables!");
}

let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Make sure .env contains this
  });
  console.log("✅ OpenAI client initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize OpenAI client:", error);
}

// ✅ Debug endpoint to check server status
app.get("/api/debug", (req, res) => {
  console.log("🛠️ Debug endpoint called");
  res.json({
    status: "ok",
    message: "Server is running correctly",
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    },
  });
});

// ✅ Meal analysis endpoint (calls OpenAI)
app.post("/api/analyze-meal", async (req, res) => {
  console.log("🍽️ Meal analysis request received:", req.body);

  try {
    const { meal } = req.body;
    if (!meal) {
      console.log("⚠️ No meal description provided!");
      return res.status(400).json({ error: "Meal description is required" });
    }

    if (!openai) {
      console.error("❌ OpenAI client not initialized!");
      return res.status(500).json({ error: "AI service not available" });
    }

    console.log("🔎 Analyzing meal:", meal);

    // ✅ OpenAI API call (Updated for v3.2.1)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a nutrition expert. Analyze the given meal and estimate calories & protein. Return ONLY a JSON object: {'calories': <num>, 'protein': <num>}. No extra text.",
        },
        {
          role: "user",
          content: `Meal: ${meal}. Return JSON.`,
        },
      ],
    });

    // ✅ Extract AI Response
    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 OpenAI Response:", responseText);

    // ✅ Parse JSON response
    let nutritionData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      nutritionData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("❌ Failed to parse OpenAI response:", parseError);
      return res.status(500).json({
        error: "Invalid response format from AI service",
        rawResponse: responseText,
      });
    }

    // ✅ Validate response format
    if (
      typeof nutritionData.calories !== "number" ||
      typeof nutritionData.protein !== "number"
    ) {
      console.error("⚠️ Invalid nutrition data format:", nutritionData);
      return res.status(500).json({
        error: "Invalid nutrition data format",
        data: nutritionData,
      });
    }

    // ✅ Send response to client
    res.json(nutritionData);
  } catch (error) {
    console.error("❌ Error analyzing meal:", error.message);
    return res.status(500).json({
      error: "Failed to analyze meal",
      message: error.message,
    });
  }
});

// ✅ Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
