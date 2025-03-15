// server.js - Backend for Meal Tracker App
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('./'));  // Serve files from root directory instead of 'public'

// Check if OpenAI API key exists
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
}

// Setup OpenAI with better error handling
let openai;
try {
  const { Configuration, OpenAIApi } = require('openai');
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  openai = new OpenAIApi(configuration);
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
}

// Debug endpoint to check server status
app.get('/api/debug', (req, res) => {
  console.log('Debug endpoint called');
  res.json({ 
    status: 'ok', 
    message: 'Server is running correctly',
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    }
  });
});

// Meal analysis endpoint
app.post('/api/analyze-meal', async (req, res) => {
  console.log('Meal analysis endpoint called with body:', req.body);
  
  try {
    const { meal } = req.body;
    
    if (!meal) {
      console.log('No meal provided in request');
      return res.status(400).json({ error: 'Meal description is required' });
    }
    
    if (!openai) {
      console.error('OpenAI client not initialized');
      return res.status(500).json({ error: 'AI service not available' });
    }
    
    console.log('Analyzing meal:', meal);
    
    // Call OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a nutrition expert. Analyze the given meal and provide an accurate estimate of calories and protein content. Return ONLY a JSON object with 'calories' and 'protein' fields, both as numbers. Don't include any explanations or additional text."
        },
        {
          role: "user",
          content: `Analyze this meal and estimate calories and protein: ${meal}`
        }
      ]
    });
    
    // Extract the response
    const responseText = completion.data.choices[0].message.content.trim();
    console.log('OpenAI response:', responseText);
    
    // Try to parse as JSON
    let nutritionData;
    try {
      // Sometimes OpenAI returns extra text, so try to extract just the JSON part
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      nutritionData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      return res.status(500).json({ 
        error: 'Invalid response format from AI service',
        rawResponse: responseText
      });
    }
    
    // Validate the data
    if (typeof nutritionData.calories !== 'number' || typeof nutritionData.protein !== 'number') {
      console.error('Invalid nutrition data format:', nutritionData);
      return res.status(500).json({ 
        error: 'Invalid nutrition data format',
        data: nutritionData
      });
    }
    
    // Return the nutrition data
    res.json(nutritionData);
    
  } catch (error) {
    console.error('Error analyzing meal:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to analyze meal', 
      message: error.message 
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});