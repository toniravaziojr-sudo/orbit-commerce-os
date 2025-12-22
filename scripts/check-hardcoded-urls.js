#!/usr/bin/env node

/**
 * ANTI-REGRESSION SCRIPT: Detect hardcoded URLs in storefront code
 * 
 * This script scans storefront files for prohibited URL patterns that would
 * break routing on custom domains.
 * 
 * Run: node scripts/check-hardcoded-urls.js
 * Exit code: 0 if clean, 1 if violations found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Patterns to check (with descriptions)
const PROHIBITED_PATTERNS = [
  {
    regex: /['"`]\/store\/[^'"`]*['"`]/g,
    description: 'Hardcoded /store/ path',
    severity: 'error',
  },
  {
    regex: /`\/store\/\$\{/g,
    description: 'Template string with /store/${...}',
    severity: 'error',
  },
  {
    regex: /navigate\s*\(\s*['"`]\/store\//g,
    description: 'navigate() with hardcoded /store/ path',
    severity: 'error',
  },
  {
    regex: /<Link\s+to=['"`]\/store\//g,
    description: '<Link> with hardcoded /store/ path',
    severity: 'error',
  },
  {
    regex: /['"`]app\.comandocentral\.com\.br['"`]/g,
    description: 'Hardcoded app.comandocentral.com.br',
    severity: 'error',
  },
  {
    regex: /href=['"`].*app\.comandocentral/g,
    description: 'href pointing to app.comandocentral',
    severity: 'error',
  },
];

// Directories to scan (storefront code only)
const SCAN_DIRS = [
  'src/pages/storefront',
  'src/components/storefront',
];

// File extensions to check
const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Files/patterns to ignore (false positives)
const IGNORE_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /__tests__/,
  /\.d\.ts$/,
];

function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
  const violations = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        return;
      }
      
      PROHIBITED_PATTERNS.forEach(({ regex, description, severity }) => {
        // Reset regex lastIndex for global patterns
        regex.lastIndex = 0;
        
        if (regex.test(line)) {
          violations.push({
            file: filePath,
            line: lineIndex + 1,
            content: line.trim().substring(0, 100),
            description,
            severity,
          });
        }
      });
    });
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
  }
  
  return violations;
}

function getFilesRecursively(dir) {
  const files = [];
  const fullPath = path.resolve(projectRoot, dir);
  
  if (!fs.existsSync(fullPath)) {
    return files;
  }
  
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(path.relative(projectRoot, entryPath)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (FILE_EXTENSIONS.includes(ext) && !shouldIgnore(entryPath)) {
        files.push(entryPath);
      }
    }
  }
  
  return files;
}

function main() {
  console.log('🔍 Scanning storefront code for hardcoded URLs...\n');
  
  let allViolations = [];
  
  for (const dir of SCAN_DIRS) {
    const files = getFilesRecursively(dir);
    
    for (const file of files) {
      const violations = scanFile(file);
      allViolations.push(...violations);
    }
  }
  
  if (allViolations.length === 0) {
    console.log('✅ No hardcoded URL violations found!\n');
    console.log('All storefront URLs are using domain-aware helpers (useStorefrontUrls/publicUrls).');
    process.exit(0);
  }
  
  console.log(`❌ Found ${allViolations.length} violation(s):\n`);
  
  // Group by file
  const byFile = {};
  allViolations.forEach(v => {
    if (!byFile[v.file]) byFile[v.file] = [];
    byFile[v.file].push(v);
  });
  
  Object.entries(byFile).forEach(([file, violations]) => {
    const relativePath = path.relative(projectRoot, file);
    console.log(`📄 ${relativePath}`);
    
    violations.forEach(v => {
      const icon = v.severity === 'error' ? '🔴' : '🟡';
      console.log(`   ${icon} Line ${v.line}: ${v.description}`);
      console.log(`      "${v.content}"`);
    });
    console.log('');
  });
  
  console.log('─'.repeat(60));
  console.log('\n💡 How to fix:');
  console.log('   1. Import: import { useStorefrontUrls } from "@/hooks/useStorefrontUrls";');
  console.log('   2. Use: const urls = useStorefrontUrls(tenantSlug);');
  console.log('   3. Replace hardcoded path with helper: urls.checkout(), urls.cart(), etc.\n');
  console.log('📚 See: docs/ANTI_REGRESSION_CHECKLIST.md\n');
  
  process.exit(1);
}

main();
