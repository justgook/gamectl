#!/usr/bin/env node

/**
 * Generate Design System Showcase HTML
 * Reads design tokens and generates a single-page showcase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateShowcaseHTML } from './templates/showcase.html.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const tokensDir = path.join(projectRoot, 'tokens');
const outputDir = path.join(projectRoot, 'build');
const outputFile = path.join(outputDir, 'index.html');

/**
 * Recursively read all token files
 */
function readTokenFiles(dir, result = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      readTokenFiles(filePath, result);
    } else if (file.endsWith('.json')) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      result.push({ file: filePath, content });
    }
  });

  return result;
}

/**
 * Flatten nested token structure
 */
function flattenTokens(obj, path = [], result = []) {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...path, key];

    if (value && typeof value === 'object' && value.$value !== undefined) {
      // This is a token
      result.push({
        name: currentPath.join('-'),
        path: currentPath,
        $value: value.$value,
        $type: value.$type,
        $description: value.$description
      });
    } else if (value && typeof value === 'object') {
      // Recurse deeper
      flattenTokens(value, currentPath, result);
    }
  }

  return result;
}

/**
 * Main generation function
 */
function generateShowcase() {
  console.log('🎨 Generating Design System Showcase...\n');

  // Read all token files
  console.log('📖 Reading token files...');
  const tokenFiles = readTokenFiles(tokensDir);
  console.log(`   Found ${tokenFiles.length} token files\n`);

  // Flatten all tokens
  console.log('🔄 Processing tokens...');
  const allTokens = [];
  tokenFiles.forEach(({ file, content }) => {
    const tokens = flattenTokens(content);
    allTokens.push(...tokens);
  });
  console.log(`   Processed ${allTokens.length} tokens\n`);

  // Generate HTML
  console.log('✨ Generating HTML...');
  const html = generateShowcaseHTML(allTokens);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output file
  fs.writeFileSync(outputFile, html, 'utf8');
  console.log(`   ✓ Generated: ${outputFile}\n`);

  // Print summary
  const stats = {
    colors: allTokens.filter(t => t.$type === 'color').length,
    spacing: allTokens.filter(t => t.$type === 'dimension' && t.path[0] === 'spacing').length,
    components: new Set(allTokens.filter(t =>
      ['button', 'file-tree', 'list', 'panel', 'select'].includes(t.path[0])
    ).map(t => t.path[0])).size
  };

  console.log('📊 Summary:');
  console.log(`   Colors:     ${stats.colors}`);
  console.log(`   Spacing:    ${stats.spacing}`);
  console.log(`   Components: ${stats.components}`);
  console.log('\n✅ Showcase generation complete!\n');
}

// Run generation
try {
  generateShowcase();
} catch (error) {
  console.error('❌ Error generating showcase:', error);
  process.exit(1);
}
