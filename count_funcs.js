const fs = require('fs');
const path = require('path');

function getFiles(dir, files_) {
  files_ = files_ || [];
  const files = fs.readdirSync(dir);
  for (const i in files) {
    const name = path.join(dir, files[i]);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files_);
    } else {
      if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.py')) {
        files_.push(name);
      }
    }
  }
  return files_;
}

const clientFiles = getFiles(path.join(__dirname, 'client', 'src'));
const serverFiles = getFiles(path.join(__dirname, 'server')).filter(f => !f.includes('node_modules'));

function countJS(files) {
    let _functions = 0;
    for (const f of files) {
        if (f.endsWith('.py')) continue;
        let content = fs.readFileSync(f, 'utf8');
        let functionKeyword = (content.match(/function(\s+\w+)?\s*\([^)]*\)\s*\{/g) || []).length;
        let arrowFunctions = (content.match(/(?:\([^)]*\)|\w+)\s*=>\s*(\{.*?\}|[^;]+)/g) || []).length;
        // simplistic method count
        let methodDeclarations = (content.match(/^\s*(async\s+)?([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\([^)]*\)\s*\{/gm) || [])
          .filter(m => !m.match(/\b(if|for|while|switch|catch|function)\b/)).length;
        
        console.log(`${f}:\n  Functions: ${functionKeyword}\n  Arrow: ${arrowFunctions}\n  Methods: ${methodDeclarations}`);
        _functions += functionKeyword + arrowFunctions + methodDeclarations;
    }
    return _functions;
}

function countPY(files) {
    let _functions = 0;
    for (const f of files) {
        if (!f.endsWith('.py')) continue;
        let content = fs.readFileSync(f, 'utf8');
        let defKeyword = (content.match(/def\s+\w+\s*\(/g) || []).length;
        console.log(`${f}:\n  Defs: ${defKeyword}`);
        _functions += defKeyword;
    }
    return _functions;
}

let sum = countJS(clientFiles) + countJS(serverFiles) + countPY(serverFiles);
console.log(`\nAPPROX TOTAL FUNCTIONS: ${sum}`);
