from pathlib import Path
import re

p = Path('src/games/pharisee/GameView.tsx')
s = p.read_text(encoding='utf-8')

# Remove VoiceChat import and render call(s).
s = re.sub(r'^import VoiceChat from "\./VoiceChat";\n', '', s, flags=re.M)
s = re.sub(r'^\s*<VoiceChat\s+gm=\{gm\}\s*/>\s*\n?', '', s, flags=re.M)

# Remove the complete public interrogation feature block, preserving the next helper.
start = s.find('/** 낮 토론용 공개 심문')
if start != -1:
    end = s.find('/** 이름에서 아바타용 이니셜 한 글자를 뽑는다 */', start)
    if end == -1:
        raise SystemExit('Could not find end marker for interrogation block')
    s = s[:start] + s[end:]

# Remove any remaining direct references.
if 'InterrogationBoard' in s or 'VoiceChat' in s or 'interrogation_' in s:
    raise SystemExit('Residual interrogation/voice reference remains in GameView.tsx')

p.write_text(s, encoding='utf-8')
