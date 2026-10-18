const fs = require('fs');
const path = require('path');

// Delete conflicting files
const filesToDelete = [
  path.join(__dirname, 'app', '(app)', 'books', '[bookId]', 'page.tsx'),
  path.join(__dirname, 'app', '(app)', 'books', '[bookId]', 'placeholder.ts'),
];

filesToDelete.forEach(f => {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log('Deleted:', f);
  } else {
    console.log('Not found:', f);
  }
});

// Try to remove the empty directory
const dir = path.join(__dirname, 'app', '(app)', 'books', '[bookId]');
try {
  if (fs.existsSync(dir)) {
    fs.rmdirSync(dir);
    console.log('Removed dir:', dir);
  }
} catch (e) {
  console.log('Could not remove dir (may have other files):', e.message);
}

console.log('Done! Route conflict resolved.');
