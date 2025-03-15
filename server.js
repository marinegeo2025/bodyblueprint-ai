// server.js - Backend for Meal Tracker App
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const https = require("https");

// Initialize Express
const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("./"));

const port = process.env.PORT || 3000;

// Check for OpenAI API key in environment
if (!process.env.OPENAI_API_KEY) {
  console.error("CRITICAL ERROR: OPENAI_API_KEY is not set in environment variables");
  process.exit(1); // Exit if no API key is present
}

// Pure Node.js HTTPS request function (works in all Node versions)
function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    // Request data
    const data = JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages
    });
    
    // Request options
    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    // Make request
    const req = https.request(options, (res) => {
      let responseBody = '';
      
      // Collect response data
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      // Process complete response
      res.on('end', () => {
        // Log full response for debugging
        console.log("Full API response:", responseBody);
        
        if (res.statusCode !== 200) {
          return reject(new Error(`OpenAI API error: ${res.statusCode} - ${responseBody}`));
        }
        
        try {
          const parsedResponse = JSON.parse(responseBody);
          resolve(parsedResponse);
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });
    
    // Handle request errors
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    // Send request
    req.write(data);
    req.end();
  });
}

// Debug endpoint to verify server is running
app.get("/api/debug", (req, res) => {
  console.log("Debug endpoint called");
  res.json({
    status: "ok",
    message: "Server is running correctly",
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      nodeVersion: process.versions.node
    }
  });
});

// Meal analysis endpoint
app.post("/api/analyze-meal", async (req, res) => {
  console.log("Meal analysis endpoint called with body:", req.body);

  try {
    const { meal } = req.body;
    if (!meal) {
      console.log("No meal provided in request");
      return res.status(400).json({ error: "Meal description is required" });
    }

    console.log("Analyzing meal:", meal);
    
    // Call OpenAI API
    const completion = await callOpenAI([
      {
        role: "system",
        content: "You are a nutrition expert. Analyze the given meal and provide an accurate estimate of calories and protein content. Return ONLY a JSON object with 'calories' and 'protein' fields, both as numbers. No extra text."
      },
      {
        role: "user",
        content: `Analyze this meal and estimate calories and protein: ${meal}`
      }
    ]);

    // Extract response text from the completion
    const responseText = completion.choices[0].message.content.trim();
    console.log("OpenAI response content:", responseText);
    
    // Parse JSON from response
    let nutritionData;
    try {
      // First try direct parsing
      nutritionData = JSON.parse(responseText);
    } catch (parseError) {
      // If that fails, try to extract JSON from the string
      console.error("Direct JSON parse failed, attempting extraction:", parseError);
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract JSON from the response");
      }
      nutritionData = JSON.parse(jsonMatch[0]);
    }
    
    // Validate the expected fields exist and are numbers
    if (
      typeof nutritionData.calories !== "number" ||
      typeof nutritionData.protein !== "number"
    ) {
      console.error("Invalid nutrition data format:", nutritionData);
      return res.status(500).json({
        error: "Invalid nutrition data format",
        data: nutritionData
      });
    }

    // Return the parsed and validated data
    res.json(nutritionData);
    
  } catch (error) {
    console.error("Error analyzing meal:", error);
    return res.status(500).json({
      error: "Failed to analyze meal",
      message: error.message
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});