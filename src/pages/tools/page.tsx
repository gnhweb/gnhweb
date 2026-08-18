import { motion } from 'framer-motion';

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-100 to-rose-100 border border-amber-200 mb-5">
              <i className="ri-tools-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-3">AI 도구 모음</h1>
            <p className="text-foreground-600 text-sm max-w-md mx-auto leading-relaxed">
              학생회 운영을 더 스마트하게 만들어주는 AI 도구들이에요.<br />
              필요한 도구는 상단 네비게이션에서 바로 이용해보세요!
            </p>
          </div>

          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
              <i className="ri-information-line text-2xl text-foreground-400"></i>
            </div>
            <p className="text-sm text-foreground-600">
              AI 도구들은 이제 상단 네비게이션의 &lsquo;사명자&rsquo; 메뉴에서 바로 이용할 수 있어요!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}