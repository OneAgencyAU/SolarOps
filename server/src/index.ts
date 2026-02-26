import express from 'express';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'SolarOps API' });
});

app.listen(PORT, () => {
  console.log(`SolarOps API running on port ${PORT}`);
});
