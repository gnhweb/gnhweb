from pathlib import Path
import re

ROOT = Path('.')

voice = ROOT / 'src/games/pharisee/VoiceChat.tsx'
text = voice.read_text(encoding='utf-8')

old_channel = '''    const channel = supabase.channel(voiceRoom, { config: { broadcast: { self: false } } });\n    channelRef.current = channel;\n\n    const onSignal = async ({ payload }: { payload: VoiceSignal }) => {'''
new_channel = '''    const channel = supabase.channel(voiceRoom, {\n      config: {\n        broadcast: { self: false },\n        presence: { key: gm.userId },\n      },\n    });\n    channelRef.current = channel;\n\n    const connectVisiblePeers = async () => {\n      if (!activeRef.current) return;\n      const state = channel.presenceState();\n      const peerIds = new Set(Object.keys(state).filter((id) => id !== gm.userId));\n      await Promise.all([...peerIds].map((peerId) => {\n        // One side becomes the initiator deterministically to avoid offer glare.\n        return gm.userId < peerId ? createPeer(peerId, true) : Promise.resolve();\n      }));\n    };\n\n    const onSignal = async ({ payload }: { payload: VoiceSignal }) => {'''
if old_channel not in text:
    raise SystemExit('Voice channel creation block not found')
text = text.replace(old_channel, new_channel, 1)

old_sub = '''    channel.on("broadcast", { event: "voice_signal" }, onSignal).subscribe();\n\n    return () => {'''
new_sub = '''    channel\n      .on("presence", { event: "sync" }, () => {\n        void connectVisiblePeers();\n      })\n      .on("broadcast", { event: "voice_signal" }, onSignal)\n      .subscribe(async (status) => {\n        if (status !== "SUBSCRIBED") return;\n        try {\n          await channel.track({ userId: gm.userId });\n        } catch {\n          // Presence is a discovery optimization; broadcast signaling remains available.\n        }\n        void connectVisiblePeers();\n        if (activeRef.current) {\n          void sendSignal({ kind: "hello" });\n        }\n      });\n\n    return () => {'''
if old_sub not in text:
    raise SystemExit('Voice subscription block not found')
text = text.replace(old_sub, new_sub, 1)

old_active = '''  useEffect(() => {\n    if (!active) return;\n    void sendSignal({ kind: "hello" });\n  }, [active, voiceRoom]);\n'''
new_active = '''  useEffect(() => {\n    if (!active) return;\n    void sendSignal({ kind: "hello" });\n    const channel = channelRef.current;\n    if (!channel) return;\n    void (async () => {\n      try {\n        await channel.track({ userId: gm.userId });\n      } catch {\n        // Presence may be unavailable briefly while Realtime is reconnecting.\n      }\n      const state = channel.presenceState();\n      const peerIds = Object.keys(state).filter((id) => id !== gm.userId);\n      await Promise.all(peerIds.map((peerId) => gm.userId < peerId ? createPeer(peerId, true) : Promise.resolve()));\n    })();\n    // gm identity and voice room are stable for this component instance.\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [active, voiceRoom]);\n'''
if old_active not in text:
    raise SystemExit('Voice active effect block not found')
text = text.replace(old_active, new_active, 1)
voice.write_text(text, encoding='utf-8')

view = ROOT / 'src/games/pharisee/GameView.tsx'
text = view.read_text(encoding='utf-8')

text, n = re.subn(r'\n\s*const \[proclaimed, setProclaimed\] = useState\(false\);', '', text, count=1)
if n != 1:
    raise SystemExit('proclaimed state not found')

text, n = re.subn(r'\n\s*const proclaimRevelation = \(\) => \{.*?\n\s*\};\n\n\s*const canProclaim = .*?;\n', '\n', text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('proclaimRevelation block not found')

text, n = re.subn(r'\n\s*\{canProclaim && \(\n\s*<button\n\s*onClick=\{proclaimRevelation\}\n\s*className="mb-3 w-full py-2 rounded-lg bg-amber-800/80 hover:bg-amber-700 cursor-pointer text-sm font-medium"\n\s*>\n\s*📖 계시 선포하기 \(\{gm\.investigationResult!\.targetName\}님 분별 결과 공개\)\n\s*</button>\n\s*\)\}', '', text, count=1)
if n != 1:
    raise SystemExit('proclamation button block not found')

view.write_text(text, encoding='utf-8')
print('patched')
