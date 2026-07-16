const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const farmRoutes = require('./farmRoutes');
const memberRoutes = require('./memberRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV === 'development';

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LEGACY Caraballo Enterprises API' });
});

app.use('/api', routes);
app.use('/api', farmRoutes);
app.use('/api', memberRoutes);

if (!isDev) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`LEGACY API running on port ${PORT}`);
});
