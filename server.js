// ✅ Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// ✅ Import OpenAI (Ensure you're using a compatible version)
const OpenAI = require("openai");

// ✅ Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("./"));

const port = process.env.PORT || 3000;

// ✅ Ensure OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is missing in environment variables!");
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

// ✅ Debug endpoint to check server status
app.get("/api/debug", (req, res) => {
  console.log("🛠️ Debug endpoint called");
  res.json({
    status: "ok",
    message: "Server is running correctly",
    env: { hasOpenAiKey: !!process.env.OPENAI_API_KEY },
  });
});

// ✅ Meal analysis endpoint
// ✅ Improved AI meal analysis with better error handling
app.post("/api/analyze-meal", async (req, res) => {
    console.log("🍽️ Meal analysis request received:", req.body);

    try {
        const { meal, previousMeals, goal, targetCalories, activityLevel } = req.body;

        if (!meal) {
            console.log("⚠️ No meal description provided!");
            return res.status(400).json({ error: "Meal description is required" });
        }

        if (!openai) {
            console.error("❌ OpenAI client not initialized!");
            return res.status(500).json({ error: "AI service not available" });
        }

        console.log("🔎 Analyzing meal:", meal);

        // ✅ Request formatted to ensure AI returns structured JSON
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are a nutritionist and sports scientist.
                    Your job is to estimate calories and protein for meals.
                    Respond in strict JSON format: { "calories": <number>, "protein": <number> }`
                },
                {
                    role: "user",
                    content: `Meal: ${meal}. Return JSON response only.`
                }
            ]
        });

        // ✅ Ensure AI response is correctly formatted
        const responseText = completion.choices[0].message.content.trim();
        console.log("🤖 AI Response:", responseText);

        let nutritionData;
        try {
            nutritionData = JSON.parse(responseText);

            // ✅ Default safe values if OpenAI returns incomplete data
            nutritionData.calories = nutritionData.calories ?? 0;
            nutritionData.protein = nutritionData.protein ?? 0;

        } catch (parseError) {
            console.error("❌ JSON Parse Error:", parseError, "\nRaw Response:", responseText);
            return res.status(500).json({
                error: "Invalid response format from AI service",
                rawResponse: responseText,
            });
        }

        // ✅ Validate response format
        if (typeof nutritionData.calories !== "number" || typeof nutritionData.protein !== "number") {
            console.error("⚠️ Invalid nutrition data format:", nutritionData);
            return res.status(500).json({
                error: "Invalid nutrition data format",
                data: nutritionData,
            });
        }

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
