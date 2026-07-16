const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const farmRoutes = require('./farmRoutes');
const memberRoutes = require('./memberRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LEGACY Caraballo Enterprises API' });
});

app.use('/api', routes);
app.use('/api', farmRoutes);
app.use('/api', memberRoutes);

app.listen(PORT, () => {
  console.log(`LEGACY API running on port ${PORT}`);
});
