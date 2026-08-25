from pathlib import Path

path = Path('src/games/pharisee/GameView.tsx')
text = path.read_text(encoding='utf-8')

old_import = 'import LegendLayer from "./LegendLayer";\n'
new_import = 'import LegendLayer from "./LegendLayer";\nimport VoiceChat from "./VoiceChat";\n'
if 'import VoiceChat from "./VoiceChat";' not in text:
    if old_import not in text:
        raise SystemExit('LegendLayer import anchor not found')
    text = text.replace(old_import, new_import, 1)

old_render = '      {phase === "day-lastwords-vote" && <FinalWordsVoteView gm={gm} />}\n      <LegendLayer gm={gm} />'
new_render = '      {phase === "day-lastwords-vote" && <FinalWordsVoteView gm={gm} />}\n      <VoiceChat gm={gm} />\n      <LegendLayer gm={gm} />'
if '      <VoiceChat gm={gm} />' not in text:
    if old_render not in text:
        raise SystemExit('RoomView render anchor not found')
    text = text.replace(old_render, new_render, 1)

path.write_text(text, encoding='utf-8')
