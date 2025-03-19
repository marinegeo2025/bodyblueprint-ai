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
- Return ONLY the estimated **calories and protein**.

For the Daily Summary, analyze **all meals so far** and provide:

1. **Caloric and Macronutrient Breakdown**  
   - Summarize the total **calories, protein, carbs, and fats** consumed today.
   - Compare intake to the user's goal and highlight any overages or deficiencies.

2. **Deficiencies & Adjustments (Be Specific, Do Not Use Vague Advice!)**  
   - Identify missing or insufficient **macronutrients** and **micronutrients**.
   - Suggest **exact foods** to correct deficiencies. Do NOT use vague advice like "eat more balanced meals."
   - Example: "Your **iron intake** is low today. Add **50g of spinach or 100g of lentils** to improve iron levels. Pair with **vitamin C (like an orange)** for better absorption."

3. **Latest Science-Backed Optimization Tips (Tailored to the User’s Goal)**  
   - Explain **why** the suggested changes improve **performance, recovery, energy, metabolism, or muscle growth**.
   - Example: "Your **magnesium intake** is low today. This may impact **muscle recovery and sleep quality**. Adding **30g of pumpkin seeds or a banana** can help correct this."

4. **Future Progress Prediction (Based on Current Intake Trends)**  
   - Predict **weight, muscle retention, or energy changes** if the user continues their current pattern.
   - Example: "Your current calorie intake suggests a **slower weight loss pace** than your goal. Reducing intake by **250 kcal per day** would realign with your target of losing **0.5 kg per week**."

5. Add one **awesomely positive** and zen statement that summarizes the user's progress toward their goal.
Ensure all responses are **concise, actionable, and backed by nutritional science**.

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
let nutritionData;
try {
  console.log("🔎 Raw OpenAI Response:", responseText); // Debugging
  nutritionData = JSON.parse(responseText);
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
