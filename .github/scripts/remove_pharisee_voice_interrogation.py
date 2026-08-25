from pathlib import Path
import re

p = Path('src/games/pharisee/GameView.tsx')
s = p.read_text(encoding='utf-8')

# Remove VoiceChat import and JSX usage in any formatting variant.
s = re.sub(r'^import\s+VoiceChat\s+from\s+["\']\\./VoiceChat["\'];\s*\n?', '', s, flags=re.M)
s = re.sub(r'\n?\s*<VoiceChat\b[^>]*/>\s*\n?', '\n', s)

# Remove the complete public interrogation feature block, preserving the next helper.
start = s.find('/** 낮 토론용 공개 심문')
if start != -1:
    end = s.find('/** 이름에서 아바타용 이니셜 한 글자를 뽑는다 */', start)
    if end == -1:
        raise SystemExit('Could not find end marker for interrogation block')
    s = s[:start] + s[end:]

# Remove any remaining component call and its stale conditional wrapper.
s = re.sub(r'\n?\s*\{canSpeak\s*&&\s*\n\}\s*\n?', '\n', s)
s = re.sub(r'\n?\s*<InterrogationBoard\b[^>]*/>\s*\n?', '\n', s)

p.write_text(s, encoding='utf-8')
