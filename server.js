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
            content: `You are a leading sports scientist and nutritionist specializing in science-based precision-based dietary optimization. 
  Your job is to analyze meals and provide **only the most specific and actionable** feedback to help users reach their goals.
  
  1️⃣ **For each meal**:  
     - Return ONLY **calories and protein** estimates.

  2️⃣ **For the Daily Summary**:
     - Summarize **total calories, protein, carbs, and fats** consumed today.
     - Identify **any deficiencies in macronutrients (protein, carbs, fats) or micronutrients (iron, calcium, fiber, omega-3, vitamins A, B12, C, D, E, magnesium, potassium, etc.).**
     - 🚫 **DO NOT say generic phrases like "eat more balanced meals."**  
     - 🔹 **FOR EVERY DEFICIENCY:**  
       - **NAME** the missing nutrient.  
       - **LIST SPECIFIC FOODS** that contain it.  
       - **EXPLAIN WHY IT MATTERS** using the latest science.  
       - Example:  
         **"Your magnesium intake is low. This may impact muscle recovery and sleep quality. Consider eating 30g of pumpkin seeds or 1 banana."**

  3️⃣ **Latest Science-Backed Optimization Tips (Based on the User’s Goal)**  
     - Provide **1-2 relevant advanced performance tips** based on the latest sports nutrition research.
     - Explain **why** each adjustment improves **performance, recovery, energy, metabolism, or muscle growth**.

  4️⃣ **Final Positive and Motivational Message**  
     - End with **a short, powerful, and motivating statement** about their progress, a bit of zen flair here is cool.

🔹 **VERY IMPORTANT RULES** 🔹
  - **DO NOT LEAVE "daily_summary" BLANK**  
  - **Every piece of advice must be SPECIFIC, ACTIONABLE, and BACKED BY SCIENCE.**  
  - **DO NOT use vague generalizations like "eat healthier."**  
  - If no deficiencies exist, still provide optimization tips for peak performance.

            JSON Format:
            {
                "calories": <number>,
                "protein": <number>,
                "daily_summary": "<string>"
            }`
        },
        {
            role: "user",
            content: `Meal: ${meal}.
            Previous Meals: ${JSON.stringify(previousMeals)}.
            Goal: ${goal}. Target Calories: ${targetCalories}.
            Activity Level: ${activityLevel}.
            Return JSON only.`
        }
    ]
});

const responseText = completion.choices[0].message.content.trim();
console.log("🤖 AI Response:", responseText);

let nutritionData;
try {
    nutritionData = JSON.parse(responseText);
    nutritionData.daily_summary = nutritionData.daily_summary || "Your summary is being generated."; // ✅ Default safe value
} catch (parseError) {
    console.error("❌ JSON Parse Error:", parseError);
    return res.status(500).json({ error: "Invalid response format from AI." });
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
