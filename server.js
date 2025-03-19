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
    
    // ✅ OpenAI API call with structured prompt for meal AND daily summary
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a leading sports scientist and life coach.
          
         For each meal:
- Return ONLY **calories and protein** estimates.

  2️⃣ **For the Daily Summary**:
     - Summarize **total calories, protein, carbs, and fats** consumed today.
     - Identify **micronutrient deficiencies** (iron, calcium, omega-3, fiber, vitamins).
     - Recommend **specific foods** to correct deficiencies.
     - Give **a science-based optimization tip** tailored to their fitness goal.
     - Predict **how their current intake affects future progress**.
     - Always end with a **motivational, positive message**.

  ⚠️ **IMPORTANT**:  
  - DO NOT leave "recommendation" or "daily_summary" fields empty.  
  - If no adjustments are needed, still provide encouragement and guidance.
  
          Format the response as JSON:
          {
            "calories": <num>,
            "protein": <num>,
            "carbs": <num>,
            "fats": <num>,
            "micronutrients": "<string>",
            "recommendation": "<string>",
            "daily_summary": "<string>"
          }`,
        },
        {
          role: "user",
          content: `Meal: ${meal}
          Previous Meals: ${JSON.stringify(previousMeals)}
          Goal: ${goal}
          Target Calories: ${targetCalories}
          Activity Level: ${activityLevel}
          Return JSON.`,
        },
      ],
    });

    // ✅ Extract AI Response
    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 OpenAI Response:", responseText);

   // ✅ Ensure OpenAI Response is Valid JSON
// ✅ Ensure OpenAI Response is Valid JSON
let nutritionData;
try {
  console.log("🔎 Raw OpenAI Response:", responseText);
  nutritionData = JSON.parse(responseText);

  // Log if AI response is empty
  if (!nutritionData.recommendation || !nutritionData.daily_summary) {
    console.warn("⚠️ AI response missing recommendation or daily summary!");
  }

} catch (parseError) {
  console.error("❌ JSON Parse Error:", parseError, "\nRaw Response:", responseText);
  return res.status(500).json({
    error: "Invalid response format from AI service",
    rawResponse: responseText,
  });
}


    // ✅ Validate response format
    if (
      typeof nutritionData.calories !== "number" ||
      typeof nutritionData.protein !== "number" ||
      typeof nutritionData.carbs !== "number" ||
      typeof nutritionData.fats !== "number" ||
      typeof nutritionData.micronutrients !== "string" ||
      typeof nutritionData.recommendation !== "string" ||
      typeof nutritionData.daily_summary !== "string"
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
