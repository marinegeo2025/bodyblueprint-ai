const express = require('express');
const app = express();

// Serve static files from 'public' directory
app.use(express.static('public'));

// Simple test endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});