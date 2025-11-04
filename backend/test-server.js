import express from 'express';

const app = express();
const PORT = 5001;

// Simple test routes
app.get('/', (req, res) => {
  res.send('Test server working ✅');
});

app.get('/test', (req, res) => {
  res.send('Test route working ✅');
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
