require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

if (!process.env.OPENAI_API_KEY) {
  console.error("⚠️ OPENAI_API_KEY is missing!");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log("✅ OpenAI client initialized successfully");

app.post("/api/analyze-meal", async (req, res) => {
  console.log("🍽️ Meal analysis request received:", req.body);

  const { meal, previousMeals, goal, targetCalories, activityLevel } = req.body;
  if (!meal) {
    return res.status(400).json({ error: "Meal description is required" });
  }

  try {
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are a sports nutritionist. Given the meal and daily meals, estimate the calories & protein. Return ONLY JSON: {"calories": <num>, "protein": <num>, "recommendation": "<advice>", "summary": "<daily_summary>"}`
        },
        {
          role: "user",
          content: `Meal: ${meal}. Previous meals: ${JSON.stringify(previousMeals)}. Goal: ${goal}. Target Calories: ${targetCalories}. Activity Level: ${activityLevel}.`
        },
      ],
    });

    let responseText = chatResponse.choices[0].message.content.trim();

    // Fixes issue with OpenAI returning JSON inside markdown blocks
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    let nutritionData;
    try {
      nutritionData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("❌ Failed to parse OpenAI response:", parseError);
      return res.status(500).json({
        error: "Invalid AI response format",
        rawResponse: responseText,
      });
    }

    res.json(nutritionData);
  } catch (error) {
    console.error("❌ OpenAI API Error:", error.message);
    res.status(500).json({ error: "AI request failed", message: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
