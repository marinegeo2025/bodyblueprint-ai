require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("./"));

const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is not set in environment variables!");
}

let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log("✅ OpenAI client initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize OpenAI client:", error);
}

app.get("/api/debug", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running correctly",
    env: {
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    },
  });
});

app.post("/api/analyze-meal", async (req, res) => {
  console.log("🍽️ Meal analysis request received:", req.body);
  try {
    const { meal, goal, targetCalories, activityLevel, previousMeals } = req.body;
    if (!meal) {
      return res.status(400).json({ error: "Meal description is required" });
    }
    if (!openai) {
      return res.status(500).json({ error: "AI service not available" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an elite sports scientist and nutrition expert. Analyze the given meal and estimate calories & protein. Provide a recommendation and an overall summary of the user's intake today. Return a valid JSON object: {\"calories\": <num>, \"protein\": <num>, \"recommendation\": \"<string>\", \"summary\": \"<string>\"}. No extra text.",
        },
        {
          role: "user",
          content: `Meal: ${meal}. Goal: ${goal}. Target Calories: ${targetCalories}. Activity Level: ${activityLevel}. Previous Meals: ${previousMeals}. Return JSON.`,
        },
      ],
    });

    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 OpenAI Response:", responseText);

    let nutritionData;
    try {
      nutritionData = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        error: "Invalid response format from AI service",
        rawResponse: responseText,
      });
    }

    if (
      typeof nutritionData.calories !== "number" ||
      typeof nutritionData.protein !== "number" ||
      typeof nutritionData.recommendation !== "string" ||
      typeof nutritionData.summary !== "string"
    ) {
      return res.status(500).json({
        error: "Invalid nutrition data format",
        data: nutritionData,
      });
    }

    res.json(nutritionData);
  } catch (error) {
    console.error("❌ Error analyzing meal:", error.message);
    res.status(500).json({
      error: "Failed to analyze meal",
      message: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
