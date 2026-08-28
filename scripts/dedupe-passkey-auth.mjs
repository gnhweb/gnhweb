import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'src/hooks/useAuth.tsx');
let source = fs.readFileSync(target, 'utf8');

const interfaceLine = '  signInWithPasskey: () => Promise<{ error: string | null }>;\n';
const interfaceCount = source.split(interfaceLine).length - 1;
if (interfaceCount > 1) {
  source = source.replaceAll(interfaceLine, '');
  const anchor = '  signIn: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;\n';
  source = source.replace(anchor, anchor + interfaceLine);
}

const functionBlock = `  const signInWithPasskey = useCallback(async () => {\n    if (!isPasskeySupported()) return { error: '이 기기에서 패스키 로그인을 사용할 수 없습니다.' };\n    const result = await signInWithPasskeyLib();\n    return { error: result.error?.message ?? null };\n  }, []);`;
const functionCount = source.split(functionBlock).length - 1;
if (functionCount > 1) {
  source = source.replaceAll(functionBlock, '');
  const anchor = '  const signOut = useCallback(async () => {';
  source = source.replace(anchor, functionBlock + '\n\n' + anchor);
}

fs.writeFileSync(target, source, 'utf8');
console.log(`[dedupe] interface=${interfaceCount}, function=${functionCount}`);
