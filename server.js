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
          For example:
          If user says “2 eggs and bread”:
          - Approx ~230 kcal, ~14g protein

          2️⃣ **For the Daily Summary**:
          - Summarize **total calories, protein, carbs, and fats** consumed today.
          - Identify **any deficiencies** in macros or micronutrients. 
          - 🚫 **No vague “eat balanced.”** 
          - For each deficiency: name it, suggest foods, explain scientifically.

          3️⃣ **Latest Science-Backed Optimization Tips**  
          - Provide 1-2 advanced performance tips. 
          - Explain why each helps performance, recovery, metabolism, or muscle growth.

          4️⃣ **Weight Trend Analysis** (NEW ADDITION)  
          - If weight trends are available, analyze actual vs. expected weight change.
          - If cut is too slow, suggest improvements; if bulk is too slow, adjust. 
          - Keep it short & precise.

          5️⃣ **Motivational Ending**
          - End with a short, powerful statement.

          🔹 **Rules** 🔹
          - No “daily_summary” left blank.
          - Don’t say “eat healthier” generically.
          - Must follow JSON format strictly:

          {
            "calories": <num>,
            "protein": <num>,
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

          ✅ Provide a concise insight about weight changes, 
             and return valid JSON only, no triple backticks.
          `
        }
      ]
    });

    // ✅ Output for debugging
    const responseText = completion.choices[0].message.content.trim();
    console.log("🤖 AI Response:", responseText);

    // ✅ If GPT encloses the JSON in triple backticks, remove them
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
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `
          You are Alex, an elite fitness trainer built on evidence-based, science-backed AI.
          Provide clear, concise, practical and actionable advice for training, meal prep, and supplementation.
          Speak in a friendly, motivational tone. Include one super positive and zen sentence at the end. 
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
