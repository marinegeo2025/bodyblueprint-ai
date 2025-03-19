// ✅ Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Initialize OpenAI API
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

// ✅ Analyze Meal Endpoint
app.post("/api/analyze-meal", async (req, res) => {
  try {
    const { meal, previousMeals, goal, targetCalories, activityLevel } = req.body;

    const prompt = `
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

    4️⃣ **Final Positive and Motivational Message**  
     - End with **a short, powerful, and motivating statement** about their progress, a bit of zen flair here is cool.

    🔹 **VERY IMPORTANT RULES** 🔹
     - **DO NOT LEAVE "daily_summary" BLANK!**  
     - **Every piece of advice must be SPECIFIC, ACTIONABLE, and BACKED BY SCIENCE.**  
     - **DO NOT use vague generalizations like "eat healthier."**  
     - If no deficiencies exist, still provide optimization tips for peak performance.

    ✅ **Format response as JSON**:
    {
      "calories": <num>,
      "protein": <num>,
      "carbs": <num>,
      "fats": <num>,
      "micronutrients": "<string>",
      "daily_summary": "<string>"
    }

    ----
    Meal: ${meal}
    Previous Meals: ${JSON.stringify(previousMeals)}
    Goal: ${goal}
    Target Calories: ${targetCalories}
    Activity Level: ${activityLevel}
    Return JSON.
    `;

    // ✅ Call OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Meal: ${meal}` }
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    // ✅ Extract response
    const responseText = completion.data.choices[0]?.message?.content || "{}";
    const responseData = JSON.parse(responseText);

    res.json(responseData);
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    res.status(500).json({ error: "Failed to analyze meal." });
  }
});

// ✅ Start Server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
