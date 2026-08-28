import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'src/hooks/useAuth.tsx');
let source = fs.readFileSync(target, 'utf8');

const functionStart = '  const signInWithPasskey = useCallback(async () => {';
const functionEnd = '  }, []);';
const first = source.indexOf(functionStart);
if (first >= 0) {
  const blockEnd = source.indexOf(functionEnd, first);
  if (blockEnd >= 0) {
    const block = source.slice(first, blockEnd + functionEnd.length);
    let rest = source.slice(0, first) + source.slice(blockEnd + functionEnd.length);
    while (true) {
      const duplicate = rest.indexOf(functionStart);
      if (duplicate < 0) break;
      const end = rest.indexOf(functionEnd, duplicate);
      if (end < 0) break;
      rest = rest.slice(0, duplicate) + rest.slice(end + functionEnd.length);
    }
    const insertionPoint = rest.indexOf('  const signOut = useCallback(async () => {');
    if (insertionPoint >= 0) {
      source = rest.slice(0, insertionPoint) + block + '\n\n' + rest.slice(insertionPoint);
    } else {
      source = rest;
    }
  }
}

fs.writeFileSync(target, source, 'utf8');
