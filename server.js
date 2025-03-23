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
// ✅ Single-call approach: parse the new meal, generate daily summary
app.post("/api/analyze-meal", async (req, res) => {
  console.log("🍽️ Meal analysis request received:", JSON.stringify(req.body, null, 2));

  try {
    // Destructure fields from request
    const { meal, previousMeals, goal, targetCalories, activityLevel, totalProtein, BMR, weightData } = req.body;

    // Enforce a non-empty meal
    if (!meal) {
      return res.status(400).json({ error: "Meal description is required" });
    }

    // Ensure the OpenAI client is loaded
    if (!openai) {
      console.error("❌ OpenAI client not initialized!");
      return res.status(500).json({ error: "AI service not available" });
    }

    console.log("🔎 Analyzing meal:", meal);

    // ✅ Build a weightSummary for the AI prompt if >=10 days of data
    let weightSummary = "No weight trend data available.";
    if (weightData && weightData.length >= 10) {
      const past10Days = weightData.slice(0, 10).reverse(); // Use last 10 entries
      const weights = past10Days.map(entry => entry.weight);
      const firstWeight = weights[0];
      const lastWeight = weights[weights.length - 1];

      // ✅ Calculate actual vs expected weight change
      const actualChange = (lastWeight - firstWeight) / 10; // kg/day
      const calorieDeficit = (BMR - targetCalories) * 10;   // kcal over 10 days
      const expectedChange = (calorieDeficit / 7700).toFixed(2); // 7700 kcal ~ 1 kg fat

      weightSummary = `
      - **Actual weight change (last 10 days):** ${actualChange.toFixed(2)} kg
      - **Expected weight change (based on calories):** ${expectedChange} kg
      - **Calories consumed daily:** ${targetCalories} kcal
      - **Protein intake daily:** ${totalProtein}g
      `.trim();
    }

    // ✅ Call OpenAI with the assembled prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `
          You are a leading sports scientist and nutritionist specializing in science-based precision-based dietary optimization. 
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

          4️⃣ **Weight Trend Analysis** (NEW ADDITION)  
          - If weight trends are available, analyze **actual vs expected weight change** based on calories consumed.
          - If weight loss is slower than expected in a cut, **suggest improvements**.
          - If weight gain is lower than expected in a bulk, **suggest dietary adjustments**.
          - **Only 1-2 sentences MAX. Keep it clear & precise.**

          5️⃣ **Final Positive and Motivational Message**  
          - End with **a short, powerful, and motivating statement** about their progress, a bit of zen flair here is cool.

          🔹 **VERY IMPORTANT RULES** 🔹
          - **DO NOT LEAVE "daily_summary" BLANK**  
          - **Every piece of advice must be SPECIFIC, ACTIONABLE, and BACKED BY SCIENCE.**  
          - **DO NOT use vague generalizations like "eat healthier."**  
          - If no deficiencies exist, still provide optimization tips for peak performance.

          ✅ **Format response as JSON**:
          {
              "calories": <number>,
              "protein": <number>,
              "micronutrients": "<string>",
              "daily_summary": "<string>"
          }
          `
        },
        {
          role: "user",
          content: `
          **MEAL DATA**:
          - Goal: ${goal}
          - Target Calories: ${targetCalories} kcal
          - Activity Level: ${activityLevel}
          - Meals Today: ${JSON.stringify(previousMeals)}

          **WEIGHT TRENDS**:
          ${weightSummary}

          ✅ Provide a **concise 1-2 sentence insight** about how weight changes align with meal trends.
          ✅ Avoid generic advice, be precise.
          ✅ Return JSON only. Do NOT include explanations, warnings, or extra text. Output must strictly follow the JSON format.
          `
        }
      ]
    });

    // ✅ Output for debugging
    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 AI Response:", responseText);

    // ✅ If GPT adds triple backticks, remove them before parse
    const cleanedResponse = responseText
      .replace(/^```(\w+)?\n?/, "")  // strip opening fences
      .replace(/```$/, "");         // strip closing fences

    let nutritionData;
    try {
      nutritionData = JSON.parse(cleanedResponse);
      nutritionData.daily_summary = nutritionData.daily_summary || "Your summary is being generated.";
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      return res.status(500).json({ error: "Invalid response format from AI." });
    }

    // ✅ Send final JSON back to client
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
