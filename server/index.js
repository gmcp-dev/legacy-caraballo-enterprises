const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');
const farmRoutes = require('./farmRoutes');
const memberRoutes = require('./memberRoutes');
const bankRoutes = require('./bankRoutes');

const app = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV === 'development';
const distPath = path.resolve(process.env.DIST_PATH || path.join(__dirname, '..', 'dist'));

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LEGACY Caraballo Enterprises API' });
});

app.use('/api', routes);
app.use('/api', farmRoutes);
app.use('/api', memberRoutes);
app.use('/api', bankRoutes);

if (!isDev) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`LEGACY API running on port ${PORT}`);
});
