import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Determine dist directory path
// Railway deploys from monorepo root, so dist is at apps/web/dist
// But server.ts is in apps/web, so we need to check both locations
let distPath: string;
if (__dirname.includes('apps/web')) {
  // We're in apps/web directory
  distPath = join(__dirname, 'dist');
} else {
  // We're at monorepo root
  distPath = join(__dirname, 'apps', 'web', 'dist');
}

console.log(`🌐 Serving static files from: ${distPath}`);
console.log(`📁 Server running from: ${__dirname}`);

// Serve static files from dist directory
app.use(express.static(distPath));

// Handle client-side routing - serve index.html for all routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  console.log(`📄 Serving index.html from: ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`❌ Error serving index.html:`, err);
      res.status(404).send('File not found');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Web app serving static files on port ${PORT}`);
});

