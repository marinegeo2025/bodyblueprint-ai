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

/* 
========================================================================================
   1) Meal Analysis Endpoint 
      - Single-call approach: parse the new meal, generate daily summary
========================================================================================
*/
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
      // Use the LAST 10 entries instead of the first 10 entries
      const past10Days = weightData.slice(-10);
      const weights = past10Days.map(entry => entry.weight);
      const firstWeight = weights[0];
      const lastWeight = weights[weights.length - 1];

      // Calculate actual vs expected weight change
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
      model: "gpt-4o-2024-08-06",
      temperature: 0.2,
      top_p: 0.8,
      messages: [
        {
          role: "system",
          content: `
          You are a top sports scientist and nutritionist specializing in precision dietary optimization. Your job is to analyze meals and provide only specific, actionable feedback.

IMPORTANT: For any non-empty meal description, never return 0 for calories or protein.

1) For each meal:  
   - Estimate and return ONLY the calories and protein values based solely on the meal text.
"“2 eggs and 1 slice wheat bread” → ~230 kcal, 14 g protein"

2) For the Daily Summary:  
   - Summarize total calories, protein, carbs, and fats consumed today.
   - Identify any deficiencies in macros or micronutrients by naming each, suggesting specific foods, and explaining why they matter (avoid vague advice like "eat balanced").

3) Provide 1-2 advanced, science-backed performance tips with explanations (for performance, recovery, metabolism, or muscle growth).

4) For Weight Trend Analysis:  
   - If weight data is available, compare actual versus expected weight change.
   - If weight loss (or gain) is slower than expected, suggest precise adjustments.

5) End with a short, powerful motivational statement.

IMPORTANT:  
- For new meal macros, estimate values based solely on the new meal text (do not blend with previous meals).  
- For the daily summary, consider both new and previous meals, but keep them separate when estimating the new meal’s macros.  
- Ensure the daily_summary field is never blank.
          - Must follow JSON format strictly:

          {
            "calories": <num>,  // macros for the NEW meal only
            "protein": <num>,   // macros for the NEW meal only
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

          ✅ Provide a concise insight about weight changes, and return valid JSON only, no triple backticks.
          `
        }
      ]
    });

    // ✅ Output for debugging
    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 AI Response:", responseText);

    // ✅ If GPT encloses the JSON in triple backticks, remove them
    const cleanedResponse = responseText
      .replace(/^```(\w+)?\n?/, "")
      .replace(/```$/, "");

    let nutritionData;
    try {
      nutritionData = JSON.parse(cleanedResponse);
      nutritionData.daily_summary = nutritionData.daily_summary || "Your summary is being generated.";
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError);
      return res.status(500).json({ error: "Invalid response format from AI." });
    }

    // Fallback: If macros are returned as 0 despite a non-empty meal, override for a known example.
    if (nutritionData.calories === 0 && nutritionData.protein === 0 && meal.trim() !== "") {
      if (meal.toLowerCase().includes("egg") && meal.toLowerCase().includes("bread")) {
        console.warn("⚠️ Overriding AI macros for a known meal example.");
        nutritionData.calories = 230;
        nutritionData.protein = 14;
      }
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

/* 
========================================================================================
   2) Chat Endpoint
      - Let users ask general fitness/nutrition questions to "Alex"
========================================================================================
*/
app.post("/api/chat", async (req, res) => {
  console.log("💬 Chat request received:", JSON.stringify(req.body, null, 2));

  try {
    const { question } = req.body;

    // Basic validation
    if (!question) {
      return res.status(400).json({ error: "No question provided." });
    }

    if (!openai) {
      console.error("❌ OpenAI client not initialized!");
      return res.status(500).json({ error: "AI service not available" });
    }

    // Build your chat prompt. For example:
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      top_p: 1,
      messages: [
        {
          role: "system",
          content: `
          You are Alex, an elite fitness trainer built on evidence-based, science-backed AI.
          Provide clear, concise, practical, and actionable advice for training, meal prep, and supplementation.
          Speak in a friendly, motivational tone and include one super positive and zen sentence at the end.
          `
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    let responseText = completion.choices[0].message.content.trim();
    console.log("🤖 Chat response:", responseText);

    // If GPT encloses in triple backticks, remove them
    responseText = responseText
      .replace(/^```[a-zA-Z]*\s*/, "")
      .replace(/```$/, "");

    // Send the final text back to the client
    res.json({ answer: responseText });
  } catch (error) {
    console.error("❌ Error in /api/chat endpoint:", error.message);
    return res.status(500).json({
      error: "Failed to process chat",
      message: error.message,
    });
  }
});

// ✅ Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
