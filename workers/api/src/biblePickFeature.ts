type Env = Record<string, string | undefined>;

type VerseRef = { emotion: string; reference: string; book: string; chapter: number; verses: number[] };
type VerseCandidate = { ref: VerseRef; text: string; context: string; score: number };
type ConcernAnalysis = { emotions: string[]; topics: string[]; questionType: string; relationship: string; intent: string };

const AI_GATEWAY_URL = 'https://gnhweb-ai-gateway.gemini19840314.workers.dev';
const SENSITIVE_KEYWORDS = ['자살', '죽고싶', '죽고 싶', '죽어버리고', '죽어도', '자해', '극단적', '끝내고 싶', '사라지고 싶', '없어지고 싶', '살고 싶지', '살기 싫', '살기싫', '목숨'];
const DEPRESSION_KEYWORDS = ['우울', '무기력', '의미없', '공허', '아무것도', '의욕', '사는게', '사는 게'];

const VERSE_REFS: VerseRef[] = [
  { emotion: '기쁨', reference: '시편 16:11', book: 'PSA', chapter: 16, verses: [11] }, { emotion: '기쁨', reference: '시편 30:5', book: 'PSA', chapter: 30, verses: [5] }, { emotion: '기쁨', reference: '욥기 22:26', book: 'JOB', chapter: 22, verses: [26] }, { emotion: '기쁨', reference: '시편 63:5', book: 'PSA', chapter: 63, verses: [5] }, { emotion: '기쁨', reference: '빌립보서 4:4', book: 'PHP', chapter: 4, verses: [4] }, { emotion: '기쁨', reference: '느헤미야 8:10', book: 'NEH', chapter: 8, verses: [10] }, { emotion: '기쁨', reference: '시편 118:24', book: 'PSA', chapter: 118, verses: [24] }, { emotion: '기쁨', reference: '요한복음 15:11', book: 'JHN', chapter: 15, verses: [11] },
  { emotion: '감사', reference: '역대상 16:8', book: '1CH', chapter: 16, verses: [8] }, { emotion: '감사', reference: '시편 92:1-2', book: 'PSA', chapter: 92, verses: [1,2] }, { emotion: '감사', reference: '시편 107:1', book: 'PSA', chapter: 107, verses: [1] }, { emotion: '감사', reference: '시편 105:1', book: 'PSA', chapter: 105, verses: [1] }, { emotion: '감사', reference: '데살로니가전서 5:18', book: '1TH', chapter: 5, verses: [18] }, { emotion: '감사', reference: '골로새서 3:17', book: 'COL', chapter: 3, verses: [17] }, { emotion: '감사', reference: '시편 100:4', book: 'PSA', chapter: 100, verses: [4] },
  { emotion: '설렘', reference: '전도서 3:11', book: 'ECC', chapter: 3, verses: [11] }, { emotion: '설렘', reference: '이사야 42:9', book: 'ISA', chapter: 42, verses: [9] }, { emotion: '설렘', reference: '고린도후서 9:8', book: '2CO', chapter: 9, verses: [8] }, { emotion: '설렘', reference: '이사야 43:19', book: 'ISA', chapter: 43, verses: [19] }, { emotion: '설렘', reference: '예레미야 29:11', book: 'JER', chapter: 29, verses: [11] },
  { emotion: '평안', reference: '시편 4:8', book: 'PSA', chapter: 4, verses: [8] }, { emotion: '평안', reference: '잠언 16:7', book: 'PRO', chapter: 16, verses: [7] }, { emotion: '평안', reference: '누가복음 2:14', book: 'LUK', chapter: 2, verses: [14] }, { emotion: '평안', reference: '빌립보서 4:7', book: 'PHP', chapter: 4, verses: [7] }, { emotion: '평안', reference: '요한복음 14:27', book: 'JHN', chapter: 14, verses: [27] }, { emotion: '평안', reference: '시편 23:1-2', book: 'PSA', chapter: 23, verses: [1,2] }, { emotion: '평안', reference: '이사야 26:3', book: 'ISA', chapter: 26, verses: [3] },
  { emotion: '슬픔', reference: '고린도후서 1:3-4', book: '2CO', chapter: 1, verses: [3,4] }, { emotion: '슬픔', reference: '시편 42:11', book: 'PSA', chapter: 42, verses: [11] }, { emotion: '슬픔', reference: '고린도후서 7:10', book: '2CO', chapter: 7, verses: [10] }, { emotion: '슬픔', reference: '누가복음 1:78-79', book: 'LUK', chapter: 1, verses: [78,79] }, { emotion: '슬픔', reference: '요한계시록 21:4', book: 'REV', chapter: 21, verses: [4] }, { emotion: '슬픔', reference: '시편 34:18', book: 'PSA', chapter: 34, verses: [18] }, { emotion: '슬픔', reference: '마태복음 5:4', book: 'MAT', chapter: 5, verses: [4] },
  { emotion: '불안', reference: '시편 56:3-4', book: 'PSA', chapter: 56, verses: [3,4] }, { emotion: '불안', reference: '마태복음 6:34', book: 'MAT', chapter: 6, verses: [34] }, { emotion: '불안', reference: '누가복음 12:22', book: 'LUK', chapter: 12, verses: [22] }, { emotion: '불안', reference: '시편 139:23-24', book: 'PSA', chapter: 139, verses: [23,24] }, { emotion: '불안', reference: '빌립보서 4:6-7', book: 'PHP', chapter: 4, verses: [6,7] }, { emotion: '불안', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] },
  { emotion: '걱정', reference: '시편 37:5', book: 'PSA', chapter: 37, verses: [5] }, { emotion: '걱정', reference: '시편 55:22', book: 'PSA', chapter: 55, verses: [22] }, { emotion: '걱정', reference: '베드로전서 5:7', book: '1PE', chapter: 5, verses: [7] }, { emotion: '걱정', reference: '누가복음 10:41-42', book: 'LUK', chapter: 10, verses: [41,42] }, { emotion: '걱정', reference: '잠언 3:5-6', book: 'PRO', chapter: 3, verses: [5,6] },
  { emotion: '두려움', reference: '시편 91:5-6', book: 'PSA', chapter: 91, verses: [5,6] }, { emotion: '두려움', reference: '디모데후서 1:7', book: '2TI', chapter: 1, verses: [7] }, { emotion: '두려움', reference: '누가복음 1:50', book: 'LUK', chapter: 1, verses: [50] }, { emotion: '두려움', reference: '욥기 5:19', book: 'JOB', chapter: 5, verses: [19] }, { emotion: '두려움', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] }, { emotion: '두려움', reference: '여호수아 1:9', book: 'JOS', chapter: 1, verses: [9] },
  { emotion: '답답함', reference: '예레미야 33:3', book: 'JER', chapter: 33, verses: [3] }, { emotion: '답답함', reference: '이사야 55:8-9', book: 'ISA', chapter: 55, verses: [8,9] }, { emotion: '답답함', reference: '전도서 3:1', book: 'ECC', chapter: 3, verses: [1] }, { emotion: '답답함', reference: '누가복음 18:1', book: 'LUK', chapter: 18, verses: [1] }, { emotion: '답답함', reference: '로마서 8:26', book: 'ROM', chapter: 8, verses: [26] },
  { emotion: '화남', reference: '잠언 19:11', book: 'PRO', chapter: 19, verses: [11] }, { emotion: '화남', reference: '잠언 25:28', book: 'PRO', chapter: 25, verses: [28] }, { emotion: '화남', reference: '마태복음 5:23-24', book: 'MAT', chapter: 5, verses: [23,24] }, { emotion: '화남', reference: '잠언 20:3', book: 'PRO', chapter: 20, verses: [3] }, { emotion: '화남', reference: '에베소서 4:26', book: 'EPH', chapter: 4, verses: [26] }, { emotion: '화남', reference: '야고보서 1:19-20', book: 'JAS', chapter: 1, verses: [19,20] },
  { emotion: '지침', reference: '시편 127:2', book: 'PSA', chapter: 127, verses: [2] }, { emotion: '지침', reference: '이사야 30:15', book: 'ISA', chapter: 30, verses: [15] }, { emotion: '지침', reference: '시편 68:9', book: 'PSA', chapter: 68, verses: [9] }, { emotion: '지침', reference: '고린도후서 4:16', book: '2CO', chapter: 4, verses: [16] }, { emotion: '지침', reference: '마태복음 11:28-29', book: 'MAT', chapter: 11, verses: [28,29] }, { emotion: '지침', reference: '이사야 40:31', book: 'ISA', chapter: 40, verses: [31] },
  { emotion: '외로움', reference: '시편 25:16', book: 'PSA', chapter: 25, verses: [16] }, { emotion: '외로움', reference: '시편 68:6', book: 'PSA', chapter: 68, verses: [6] }, { emotion: '외로움', reference: '이사야 43:1', book: 'ISA', chapter: 43, verses: [1] }, { emotion: '외로움', reference: '히브리서 13:5', book: 'HEB', chapter: 13, verses: [5] }, { emotion: '외로움', reference: '마태복음 28:20', book: 'MAT', chapter: 28, verses: [20] },
  { emotion: '무기력', reference: '누가복음 1:37', book: 'LUK', chapter: 1, verses: [37] }, { emotion: '무기력', reference: '시편 71:16', book: 'PSA', chapter: 71, verses: [16] }, { emotion: '무기력', reference: '사도행전 20:24', book: 'ACT', chapter: 20, verses: [24] }, { emotion: '무기력', reference: '누가복음 18:27', book: 'LUK', chapter: 18, verses: [27] }, { emotion: '무기력', reference: '갈라디아서 6:9', book: 'GAL', chapter: 6, verses: [9] },
  { emotion: '혼란', reference: '시편 25:4-5', book: 'PSA', chapter: 25, verses: [4,5] }, { emotion: '혼란', reference: '시편 119:105', book: 'PSA', chapter: 119, verses: [105] }, { emotion: '혼란', reference: '야고보서 1:5', book: 'JAS', chapter: 1, verses: [5] }, { emotion: '혼란', reference: '잠언 3:13', book: 'PRO', chapter: 3, verses: [13] }, { emotion: '혼란', reference: '잠언 16:9', book: 'PRO', chapter: 16, verses: [9] },
  { emotion: '후회', reference: '시편 51:17', book: 'PSA', chapter: 51, verses: [17] }, { emotion: '후회', reference: '누가복음 15:7', book: 'LUK', chapter: 15, verses: [7] }, { emotion: '후회', reference: '요한일서 1:9', book: '1JN', chapter: 1, verses: [9] }, { emotion: '후회', reference: '에베소서 2:4', book: 'EPH', chapter: 2, verses: [4] }, { emotion: '후회', reference: '이사야 1:18', book: 'ISA', chapter: 1, verses: [18] },
  { emotion: '미안함', reference: '시편 32:1-2', book: 'PSA', chapter: 32, verses: [1,2] }, { emotion: '미안함', reference: '누가복음 7:47', book: 'LUK', chapter: 7, verses: [47] }, { emotion: '미안함', reference: '빌립보서 3:13', book: 'PHP', chapter: 3, verses: [13] },
  { emotion: '희망', reference: '로마서 15:13', book: 'ROM', chapter: 15, verses: [13] }, { emotion: '희망', reference: '예레미야 29:11', book: 'JER', chapter: 29, verses: [11] }, { emotion: '희망', reference: '시편 42:5', book: 'PSA', chapter: 42, verses: [5] }, { emotion: '희망', reference: '이사야 40:31', book: 'ISA', chapter: 40, verses: [31] }, { emotion: '희망', reference: '로마서 8:28', book: 'ROM', chapter: 8, verses: [28] },
  { emotion: '좌절', reference: '시편 73:26', book: 'PSA', chapter: 73, verses: [26] }, { emotion: '좌절', reference: '미가 7:8', book: 'MIC', chapter: 7, verses: [8] }, { emotion: '좌절', reference: '고린도후서 4:8-9', book: '2CO', chapter: 4, verses: [8,9] }, { emotion: '좌절', reference: '로마서 5:3-4', book: 'ROM', chapter: 5, verses: [3,4] }, { emotion: '좌절', reference: '갈라디아서 6:9', book: 'GAL', chapter: 6, verses: [9] },
  { emotion: '용기', reference: '신명기 31:6', book: 'DEU', chapter: 31, verses: [6] }, { emotion: '용기', reference: '디모데후서 1:7', book: '2TI', chapter: 1, verses: [7] }, { emotion: '용기', reference: '여호수아 1:9', book: 'JOS', chapter: 1, verses: [9] }, { emotion: '용기', reference: '이사야 41:10', book: 'ISA', chapter: 41, verses: [10] },
  { emotion: '두려움', reference: '시편 27:1', book: 'PSA', chapter: 27, verses: [1] }, { emotion: '불안', reference: '시편 46:1', book: 'PSA', chapter: 46, verses: [1] }, { emotion: '화남', reference: '잠언 15:1', book: 'PRO', chapter: 15, verses: [1] }, { emotion: '화남', reference: '로마서 12:18', book: 'ROM', chapter: 12, verses: [18] }, { emotion: '미안함', reference: '에베소서 4:32', book: 'EPH', chapter: 4, verses: [32] }, { emotion: '걱정', reference: '잠언 16:3', book: 'PRO', chapter: 16, verses: [3] }, { emotion: '평안', reference: '시편 121:1-2', book: 'PSA', chapter: 121, verses: [1,2] }, { emotion: '용기', reference: '빌립보서 2:3-4', book: 'PHP', chapter: 2, verses: [3,4] }, { emotion: '희망', reference: '로마서 12:12', book: 'ROM', chapter: 12, verses: [12] }, { emotion: '지침', reference: '시편 121:3-4', book: 'PSA', chapter: 121, verses: [3,4] },

];

const KEYWORD_MAP: Record<string, string> = { '행복':'기쁨','좋':'기쁨','신나':'설렘','재미':'기쁨','감사':'감사','고마':'감사','덕분':'감사','슬프':'슬픔','눈물':'슬픔','속상':'슬픔','아프':'슬픔','불안':'불안','떨리':'불안','긴장':'불안','걱정':'걱정','고민':'걱정','스트레스':'걱정','무서':'두려움','겁나':'두려움','답답':'답답함','막막':'답답함','화':'화남','짜증':'화남','열받':'화남','힘들':'지침','지쳤':'지침','피곤':'지침','외로':'외로움','혼자':'외로움','의미':'무기력','아무':'무기력','혼란':'혼란','모르겠':'혼란','후회':'후회','미안':'미안함','죄송':'미안함','희망':'희망','기대':'희망','설레':'설렘','우울':'우울','우울증':'우울','좌절':'좌절','실패':'좌절','용기':'용기','할수있':'용기','도전':'용기' };

const TOPIC_REFERENCE_HINTS: Record<string,string[]>={
'친구·관계':['마태복음 5:23-24','잠언 19:11','잠언 20:3','야고보서 1:19-20','시편 68:6'],
'가족·집':['마태복음 5:23-24','야고보서 1:19-20','잠언 19:11','시편 68:6'],
'학교·시험':['마태복음 6:34','빌립보서 4:6-7','이사야 41:10','시편 56:3-4','잠언 3:5-6'],
'진로·미래':['잠언 3:5-6','잠언 16:9','시편 25:4-5','예레미야 29:11','야고보서 1:5'],
'선택·결정':['야고보서 1:5','잠언 3:5-6','잠언 16:9','시편 25:4-5'],
'실패·비교':['고린도후서 4:8-9','로마서 5:3-4','갈라디아서 6:9','시편 73:26','미가 7:8'],
'용서·회복':['마태복음 5:23-24','요한일서 1:9','시편 51:17','시편 32:1-2','이사야 1:18'],
'신앙·의심':['야고보서 1:5','시편 119:105','시편 25:4-5','로마서 8:26'],
'리더십·책임':['갈라디아서 6:9','잠언 19:11','야고보서 1:19-20','마태복음 5:23-24'],
'외로움·소속':['히브리서 13:5','마태복음 28:20','시편 68:6','시편 25:16'],
'감사·기쁨':['시편 100:4','빌립보서 4:4','데살로니가전서 5:18','요한복음 15:11'],
'불안·걱정':['마태복음 6:34','빌립보서 4:6-7','시편 55:22','베드로전서 5:7','시편 56:3-4'],
'분노·갈등':['야고보서 1:19-20','잠언 19:11','잠언 25:28','에베소서 4:26','마태복음 5:23-24'],
'지침·번아웃':['마태복음 11:28-29','이사야 40:31','시편 127:2','이사야 30:15','고린도후서 4:16'],
'자기·정체성':['시편 139:23-24','이사야 43:1','히브리서 13:5','시편 73:26']
};
const CONTEXT_CAUTION_REFERENCES=new Set(['예레미야 29:11','로마서 8:28','이사야 41:10','여호수아 1:9']);
const stableHash=(value:string)=>{let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
function analyzeConcern(text:string):ConcernAnalysis{const lower=text.toLowerCase();const emotions=[...new Set(Object.entries(KEYWORD_MAP).filter(([k])=>lower.includes(k)).map(([,v])=>v))].slice(0,4);const patterns:Array<[string,RegExp]>=[['친구·관계',/친구|친한|절친|무시|싸웠|싸움|관계|서운|배신|갈등|화해|사과|손절|연락이 없|친구가/],['가족·집',/부모|엄마|아빠|아버지|어머니|형제|자매|가족|집에서/],['학교·시험',/학교|시험|성적|공부|발표|입시|수업|숙제|내신|모의고사|시험기간/],['진로·미래',/진로|꿈|미래|직업|대학|진학|취업|전공|어디로 가야/],['선택·결정',/선택|결정|정해야|어떻게 해야|어느 쪽|해야 할지|무엇을 해야|결정하기/],['실패·비교',/실패|좌절|비교|열등|못했|떨어|뒤처|나만 못|남들은/],['용서·회복',/용서|사과|잘못|죄|회개|후회|미안|죄책감|상처|화해/],['신앙·의심',/하나님|기도|신앙|믿음|성경|말씀|예배|의심|하나님이 계신지|믿어야/],['리더십·책임',/리더|회장|부장|사명자|학생회|동아리|책임|팀원|이끌|따라주지|말을 안 들어/],['외로움·소속',/외로|혼자|소속|고립|친구가 없|어울리지 못/],['감사·기쁨',/감사|고마|행복|기쁘|즐거/],['불안·걱정',/불안|걱정|스트레스|긴장|두렵|무서|떨려|압박/],['분노·갈등',/화가|화나|짜증|열받|분노|억울|참기|화가 나/],['지침·번아웃',/지쳤|지침|피곤|번아웃|번아웃|너무 힘들|쉬고 싶|소진/],['자기·정체성',/나는 누구|내가 가치|자존감|자신감|나 자신|내가 싫|내가 부족|정체성/]];const topics=patterns.filter(([,p])=>p.test(text)).map(([t])=>t);const questionType=topics.includes('용서·회복')?'회복·용서':topics.includes('리더십·책임')?'리더십':topics.includes('신앙·의심')?'신앙':topics.includes('선택·결정')||topics.includes('진로·미래')?'선택':topics.includes('친구·관계')?'관계':topics.includes('실패·비교')?'실패·불안':topics.includes('감사·기쁨')?'감사·기쁨':emotions.some(e=>['슬픔','외로움','지침','무기력'].includes(e))?'위로':'기타';return{emotions:emotions.length?emotions:['평안','희망','혼란'],topics,questionType,relationship:topics.includes('친구·관계')?'친구':topics.includes('학교·시험')?'학교':topics.includes('리더십·책임')?'학생회':topics.includes('신앙·의심')?'하나님':'자기 자신',intent:/어떻게|해야|할지|방법/.test(text)?'행동':/왜|이유/.test(text)?'이해':'방향'};}
function scoreCandidate(candidate:VerseCandidate,analysis:ConcernAnalysis){let score=analysis.emotions.includes(candidate.ref.emotion)?1:0;for(const topic of analysis.topics)if(TOPIC_REFERENCE_HINTS[topic]?.includes(candidate.ref.reference))score+=12;if(analysis.questionType==='선택'&&['야고보서 1:5','잠언 3:5-6','잠언 16:9'].includes(candidate.ref.reference))score+=6;if(analysis.questionType==='회복·용서'&&['마태복음 5:23-24','요한일서 1:9','시편 51:17'].includes(candidate.ref.reference))score+=6;if(analysis.questionType==='관계'&&['마태복음 5:23-24','야고보서 1:19-20','잠언 19:11'].includes(candidate.ref.reference))score+=6;if(analysis.questionType==='리더십'&&['갈라디아서 6:9','잠언 19:11','야고보서 1:19-20'].includes(candidate.ref.reference))score+=6;if(analysis.questionType==='신앙'&&['야고보서 1:5','시편 119:105','시편 25:4-5'].includes(candidate.ref.reference))score+=6;if(analysis.questionType==='실패·불안'&&['고린도후서 4:8-9','로마서 5:3-4','갈라디아서 6:9'].includes(candidate.ref.reference))score+=6;if(CONTEXT_CAUTION_REFERENCES.has(candidate.ref.reference))score-=1;return score;}
const CORS_HEADERS = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS_HEADERS });
const sensitive = (text: string) => { const lower=text.toLowerCase(); return { isCrisis:SENSITIVE_KEYWORDS.some(k=>lower.includes(k)), isDepression:DEPRESSION_KEYWORDS.some(k=>lower.includes(k))&&!SENSITIVE_KEYWORDS.some(k=>lower.includes(k)) }; };
const KRV_CRISIS_VERSE='여호와는 마음이 상한 자에게 가까이 하시고 중심에 통회하는 자를 구원하시는도다';

const KRV_BOOK_IDS: Record<string,number> = {
  DEU:5, JOS:6, '1CH':13, NEH:16, JOB:18, PSA:19, PRO:20, ECC:21,
  ISA:23, JER:24, MIC:33, MAT:40, LUK:42, JHN:43, ACT:44, ROM:45,
  '2CO':47, GAL:48, EPH:49, PHP:50, COL:51, '1TH':52, '2TI':55,
  HEB:58, JAS:59, '1PE':60, REV:66,
};

type KrvChapter = {
  book?: number;
  chapter?: number;
  verses?: Array<{verse?: number;text?: string}>;
};

const krvChapterCache=new Map<string,Promise<KrvChapter>>();
const CANDIDATE_POOL_SIZE=100;
// Keep the broad 100-reference ranking, but send only the strongest candidates
// to the model so provider payload/rate limits do not turn a good shortlist into
// a 413 before the model can reason about it.
const AI_CANDIDATE_LIMIT=12;

function fetchKrvChapter(book:string,chapter:number):Promise<KrvChapter>{
  const key=`${book}:${chapter}`;
  const cached=krvChapterCache.get(key);
  if(cached)return cached;
  const bookId=KRV_BOOK_IDS[book];
  if(!bookId)throw new Error(`개역한글 책 코드 매핑이 없습니다: ${book}`);
  const request=fetch(`https://bolls.life/get-chapter/KRV/${bookId}/${chapter}/`,{headers:{Accept:'application/json'}})
    .then(async response=>{
      if(!response.ok)throw new Error(`개역한글(KRV) 본문 로딩 실패 (HTTP ${response.status})`);
      return await response.json() as KrvChapter[];
    })
    .then(data=>Array.isArray(data)?{book:bookId,chapter,verses:data.map(item=>({verse:item.verse,text:item.text}))}:data as unknown as KrvChapter);
  krvChapterCache.set(key,request);
  return request;
}

async function fetchVerseText(ref: VerseRef): Promise<{text:string;context:string}> {
  const data=await fetchKrvChapter(ref.book,ref.chapter);
  const verses=(data.verses||[])
    .filter(item=>typeof item.verse==='number'&&typeof item.text==='string'&&item.text.trim())
    .map(item=>({number:item.verse as number,text:(item.text as string).replace(/\\s+/g,' ').trim()}));
  const selected=verses.filter(item=>ref.verses.includes(item.number));
  const text=selected.map(item=>item.text).join(' ').trim();
  if(!text)throw new Error(`개역한글(KRV)에서 해당 구절을 찾지 못했습니다: ${ref.reference}`);
  const minVerse=Math.min(...ref.verses);
  const maxVerse=Math.max(...ref.verses);
  const surrounding=verses.filter(item=>item.number>=Math.max(1,minVerse-2)&&item.number<=maxVerse+2);
  const context=surrounding.map(item=>`[${item.number}] ${item.text}`).join(' ');
  return {text,context};
}

async function collectCandidates(text:string,analysis:ConcernAnalysis,count:number):Promise<VerseCandidate[]>{const ranked=VERSE_REFS.map(ref=>({ref,score:scoreCandidate({ref,text:'',context:'',score:0},analysis)})).sort((a,b)=>b.score-a.score||stableHash(text+a.ref.reference)-stableHash(text+b.ref.reference));const uniqueTargets=ranked.filter((item,index,array)=>array.findIndex(candidate=>candidate.ref.reference===item.ref.reference)===index).slice(0,count);const aiTargets=uniqueTargets.slice(0,AI_CANDIDATE_LIMIT);const fetched=await Promise.allSettled(aiTargets.map(async(item)=>{const verse=await fetchVerseText(item.ref);return {ref:item.ref,text:verse.text,context:verse.context,score:item.score};}));return fetched.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);}
const extractJson=(content:string):Record<string,unknown>|null=>{try{return JSON.parse(content) as Record<string,unknown>}catch{}const fenced=content.match(/```(?:json)?\s*([\s\S]*?)```/);if(fenced)try{return JSON.parse(fenced[1].trim()) as Record<string,unknown>}catch{}const object=content.match(/\{[\s\S]*\}/);if(object)try{return JSON.parse(object[0]) as Record<string,unknown>}catch{}return null;};
const sanitize=(text:string)=>text.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/g,'').replace(/[\u2018\u2019\u201C\u201D]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();

export async function handleBiblePick(request:Request,_env:Env):Promise<Response>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:CORS_HEADERS});
  if(request.method!=='POST')return json({error:'POST only'},405);
  try{
    const body=await request.json() as {userText?:unknown}; const text=typeof body?.userText==='string'?body.userText.trim():'';
    if(!text)return json({error:'고민이나 질문을 입력해주세요.'},400);
    const state=sensitive(text); const analysis=analyzeConcern(text); const analyzed=analysis.emotions;
    if(state.isCrisis){
      const crisisRef=VERSE_REFS.find((ref)=>ref.reference==='시편 34:18');
      if(!crisisRef)return json({error:'위기 안내를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);
      let crisisVerse='';
      try{crisisVerse=(await fetchVerseText(crisisRef)).text;}catch(error){console.error('[bible-pick] crisis verse fetch failed; using verified KRV fallback',error);crisisVerse=KRV_CRISIS_VERSE;}
      const crisisMessage='지금 많이 힘들다면 혼자 견디지 않아도 돼요. 믿을 수 있는 어른이나 선생님에게 지금 상태를 바로 알려주세요. 급하게 자신을 해칠 것 같다면 즉시 119 또는 112에 도움을 요청하세요.';
      return json({verse:crisisVerse,reference:crisisRef.reference,answer:'지금은 고민에 맞는 말씀을 고르는 것보다 네 안전과 곁에 있는 사람에게 도움을 요청하는 것이 먼저예요.',recommendation:'시편 34편은 고통받는 사람 가까이에 계시는 하나님을 말해요. 이 말씀을 혼자 견뎌야 한다는 뜻으로 사용하지 말고, 지금 곁의 사람에게 도움을 요청하는 것과 함께 읽어 주세요.',practice:'지금 믿을 수 있는 어른이나 선생님 한 사람에게 현재 상태를 그대로 알려주세요.',prayers:['아버지, 지금 제가 혼자 버티지 않게 하시고 곁에 도움을 요청할 용기를 주세요.'],understanding:'지금 네가 적어준 말에는 혼자 감당하기 어려운 고통이 담겨 있는 것 같아요. 이런 순간에는 말씀 한 구절만으로 버티려고 하지 않아도 돼요.',whyThisVerse:'시편 34:18은 마음이 상한 사람과 가까이 계시는 하나님을 말해요. 지금의 고통을 가볍게 여기지 않으면서, 혼자 견디지 않고 도움을 요청하는 것과 함께 읽어 주세요.',nextStep:'지금 바로 믿을 수 있는 어른이나 선생님 한 사람에게 “지금 내가 많이 힘들고 혼자 있으면 위험할 것 같다”고 알려주세요.',takeaway:'지금은 혼자 버티는 것보다 사람에게 도움을 요청하는 것이 한 걸음이에요.',prayer:'아버지, 지금 제가 혼자 버티지 않게 하시고 곁에 도움을 요청할 용기를 주세요.',analyzedEmotions:['슬픔'],primaryEmotion:'슬픔',questionType:'위기',relationship:'자기 자신',topics:[],contextCaution:false,crisisMessage});
    }
    const candidates=await collectCandidates(text,analysis,CANDIDATE_POOL_SIZE);
    if(!candidates.length)return json({error:'말씀 본문을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);
    const auth=request.headers.get('Authorization');const debugGateway=request.headers.get('X-Debug-Bible-Pick')==='1';let gatewayDebug:unknown;let gatewayMeta:unknown;let chosenIndex=0,answer='',recommendation='',practice='',prayers:string[]=[],understanding='',whyThisVerse='',nextStep='',takeaway='',prayer='';
    try{const candidateList=candidates.map((c,i)=>`${i}. [${c.ref.reference}]\n선택 구절: ${c.text}\n앞뒤 문맥: ${c.context}`).join('\n\n');const systemPrompt=\`당신은 교회 청소년에게 성경 말씀을 건네는 신앙 멘토입니다.
학생의 고민을 충분히 이해한 뒤, 후보 말씀의 실제 의미와 앞뒤 문맥을 비교해서 가장 잘 맞는 한 구절을 고르세요.

[최우선 원칙]
- 감정 단어가 겹친다는 이유만으로 고르지 말고 학생의 실제 질문, 상황, 관계와 본문의 의미를 비교하세요.
- 제공된 앞뒤 문맥을 반드시 함께 읽고 문맥 전체의 의미를 우선하세요.
- 특정 인물·시대에 한정된 말씀을 학생에게 직접 주어진 예언이나 개인적 약속처럼 말하지 마세요.
- '하나님이 너에게 이렇게 말씀하신다', '하나님이 반드시 이렇게 하실 거다'처럼 개인의 미래나 하나님의 의도를 단정하지 마세요.
- 성경 본문에 없는 내용을 성경의 뜻인 것처럼 만들지 마세요.
- 성경이 말하는 내용과 학생의 상황에 적용해볼 수 있는 방향을 구분하세요.
- 상담 보고서나 분석 결과처럼 쓰지 말고, 교회 선생님이 학생에게 조용히 이야기하듯 자연스러운 해요체로 쓰세요.
- 빈 위로를 반복하지 말고 학생이 실제로 쓴 상황이나 단어를 자연스럽게 반영하세요.
- 화면에 표시되는 다섯 부분 각각이 실제로 유용하도록 작성하세요.

[화면에 표시될 결과는 정확히 이 다섯 부분입니다]
1. analyzedEmotions: 학생 글에서 드러난 감정 1~3개
2. recommendation: '왜 이 말씀일까요?'
3. practice: '오늘의 실천 방법'
4. prayers: '자기 전 기도' 1~2개
5. verse/reference: 위 판단에 가장 잘 맞는 후보 말씀 하나

[recommendation]
- 2~4문장.
- 첫 문장은 학생의 고민에서 실제로 걸리는 지점을 짚으세요.
- 이어서 선택한 말씀의 문맥과 핵심 의미를 설명하고 왜 지금 이 고민을 바라보는 데 도움이 되는지 연결하세요.
- '힘들 때 위로가 되는 말씀'처럼 감정과 구절을 피상적으로 연결하지 마세요.
- 본문에 없는 하나님의 약속이나 결과를 추가하지 마세요.
- 성경 구절 원문을 길게 다시 쓰지 마세요.

[practice]
- 학생이 오늘 실제로 할 수 있는 행동 하나를 제안하세요.
- '기도하세요', '말씀을 읽으세요', '긍정적으로 생각하세요'처럼 추상적인 행동만 제시하지 마세요.
- 관계 문제면 누구에게 무엇을 확인할지, 선택 문제면 어떤 기준으로 무엇을 정리할지, 시험·불안이면 오늘 무엇을 준비하고 무엇을 내려놓을지처럼 구체화하세요.
- 학생이 잘못한 부분이 있다면 책임 있는 행동을 제안하고, 상대의 행동을 근거 없이 단정하지 마세요.
- 1~3문장, 너무 많은 할 일은 금지합니다.

[prayers]
- 1~2개만 작성하세요.
- 학생의 실제 고민과 선택된 말씀을 반영한 짧은 기도여야 합니다.
- 자기 전에 실제로 읽을 수 있는 길이로 작성하고 설교문처럼 길게 쓰지 마세요.
- 하나님이 반드시 어떤 결과를 주실 것이라고 선언하지 마세요.

[analyzedEmotions]
- 다음 감정 표현 중 학생 글에 실제로 드러난 것을 우선 사용하세요: 기쁨, 감사, 설렘, 평안, 슬픔, 불안, 걱정, 두려움, 답답함, 화남, 지침, 외로움, 무기력, 혼란, 후회, 미안함, 희망, 좌절, 용기
- 명확하지 않다면 억지로 새 감정을 만들지 말고 후보 분석 정보의 감정을 사용하세요.

[호환 필드]
answer는 기존 호환용으로 2~4개의 짧은 문단으로 작성하세요. 다섯 부분을 단순 복사해 이어붙이지 마세요.
understanding, whyThisVerse, nextStep, takeaway, prayer도 작성하되 recommendation/practice/prayers와 같은 문장을 반복하지 마세요.

JSON 이외의 텍스트는 출력하지 마세요.
형식: {"chosenIndex":0,"analyzedEmotions":[""],"recommendation":"","practice":"","prayers":[""],"answer":"","understanding":"","whyThisVerse":"","nextStep":"","takeaway":"","prayer":""}\`const response=await fetch(`${AI_GATEWAY_URL}/`,{method:'POST',headers:{...(auth?{Authorization:auth}:{}),'Content-Type':'application/json'},body:JSON.stringify({task:'bible-pick',model:'google/gemma-4-31b-it',messages:[{role:'system',content:systemPrompt},{role:'user',content:`학생의 질문과 상황:\n${text}\n\n분석 참고 정보(정답이 아니라 보조 힌트):\n- 감정: ${analysis.emotions.join(", ")}\n- 주제: ${analysis.topics.join(", ") || "명확하지 않음"}\n- 질문 유형: ${analysis.questionType}\n- 의도: ${analysis.intent}\n- 관계: ${analysis.relationship}\n\n후보 말씀(100개 후보 풀에서 상황·주제 점수로 추린 상위 후보입니다. 제공된 후보들을 비교할 때 감정 단어보다 본문 의미와 문맥을 우선):\n${candidateList}` }],temperature:.55,max_tokens:3200})});if(!response.ok){const errorBody=await response.text().catch(()=> '');console.error('[bible-pick] AI gateway HTTP failure',response.status,errorBody.slice(0,1000));if(debugGateway){try{gatewayDebug=JSON.parse(errorBody);}catch{gatewayDebug={status:response.status,body:errorBody.slice(0,1000)};}}}else{const data=await response.json() as {choices?:Array<{message?:{content?:unknown}}>;_meta?:unknown};gatewayMeta=data._meta;const content=data.choices?.[0]?.message?.content;if(typeof content==='string'){const parsed=extractJson(content);if(parsed){const index=Number(parsed.chosenIndex);if(Number.isInteger(index)&&index>=0&&index<candidates.length)chosenIndex=index;const allowedEmotions=new Set(['기쁨','감사','설렘','평안','슬픔','불안','걱정','두려움','답답함','화남','지침','외로움','무기력','혼란','후회','미안함','희망','좌절','용기']);const aiEmotions=Array.isArray(parsed.analyzedEmotions)?parsed.analyzedEmotions.filter((v):v is string=>typeof v==='string'&&allowedEmotions.has(v)).slice(0,3):[];if(aiEmotions.length)analysis.emotions.splice(0,analysis.emotions.length,...aiEmotions);understanding=typeof parsed.understanding==='string'?sanitize(parsed.understanding):'';whyThisVerse=typeof parsed.whyThisVerse==='string'?sanitize(parsed.whyThisVerse):'';nextStep=typeof parsed.nextStep==='string'?sanitize(parsed.nextStep):'';takeaway=typeof parsed.takeaway==='string'?sanitize(parsed.takeaway):'';prayer=typeof parsed.prayer==='string'?sanitize(parsed.prayer):'';answer=typeof parsed.answer==='string'?sanitize(parsed.answer):'';recommendation=typeof parsed.recommendation==='string'?sanitize(parsed.recommendation):'';practice=typeof parsed.practice==='string'?sanitize(parsed.practice):'';prayers=(Array.isArray(parsed.prayers)?parsed.prayers:[]).filter((v):v is string=>typeof v==='string'&&v.trim()).map(v=>sanitize(v).replace(/^하나님,\s*/,'아버지, ')).slice(0,2);}}}}catch(error){console.error('[bible-pick] AI gateway failed',error);}
    const chosen=candidates[chosenIndex];const primary=chosen.ref.emotion;if(!understanding)understanding=analysis.topics.length?'지금 너에게는 '+analysis.topics.join(', ')+'와 관련된 고민이 가장 크게 걸려 있는 것 같아요.':'지금 상황에서 무엇을 어떻게 해야 할지 답을 찾고 있는 것 같아요.';if(!whyThisVerse)whyThisVerse='이 말씀은 단순히 '+primary+'이라는 감정을 달래는 데서 끝나지 않고, 지금 고민에서 취할 수 있는 방향을 보여줘요.';if(!nextStep)nextStep=analysis.questionType==='관계'?'감정이 가장 올라온 상태에서는 결론을 내리지 말고, 상대에게 확인하고 싶은 사실 한 가지를 먼저 적어보세요.':analysis.questionType==='선택'?'선택지를 두 개로 줄이고 각각에서 내가 책임질 수 있는 다음 행동 하나씩을 적어보세요.':'오늘 이 말씀을 천천히 읽고 지금 할 수 있는 가장 작은 행동 하나를 정해보세요.';if(!takeaway)takeaway='말씀을 아는 것에서 멈추지 않고, 오늘 할 수 있는 한 걸음으로 옮겨보자.';if(!prayer)prayer='아버지, 제가 지금 겪는 일을 솔직하게 내려놓습니다. 제게 필요한 지혜와 힘을 주세요.';if(!recommendation)recommendation='이 말씀은 지금 네가 겪는 '+(analysis.topics[0]||'고민')+'을 단순히 감정으로만 넘기지 않고, 말씀의 뜻 안에서 어떻게 바라볼지 생각하게 해줘요.';if(!practice)practice=analysis.questionType==='관계'?'오늘 바로 결론내리지 말고, 상대에게 확인하고 싶은 사실 한 가지를 먼저 정리한 뒤 차분하게 물어보세요.':analysis.questionType==='선택'?'지금 고민하는 선택지를 적고, 각각에서 내가 중요하게 생각하는 기준 한 가지씩만 적어보세요.':'오늘 이 말씀을 한 번 천천히 읽고, 지금 내 상황에서 실제로 옮길 수 있는 행동 하나를 정해보세요.';if(!prayer)prayer='아버지, 제가 지금 겪는 일을 숨기지 않고 내려놓습니다. 제게 필요한 지혜와 용기를 주세요.';if(!prayers.length)prayers=[prayer];if(!answer)answer=recommendation+'\n\n'+practice;let crisisMessage:string|undefined;if(state.isDepression)crisisMessage='요즘 마음이 오래 가라앉아 있다면 혼자 버티지 않아도 돼요. 가까운 어른이나 선생님에게 지금의 상태를 이야기하고 함께 도움을 찾아보세요.';
    return json({verse:chosen.text,reference:chosen.ref.reference,answer,recommendation,practice,prayers,understanding,whyThisVerse,nextStep,takeaway,prayer,analyzedEmotions:[primary,...analyzed.filter(e=>e!==primary)].slice(0,3),primaryEmotion:primary,questionType:analysis.questionType,relationship:analysis.relationship,topics:analysis.topics,contextCaution:CONTEXT_CAUTION_REFERENCES.has(chosen.ref.reference),crisisMessage,...(debugGateway?{_debugGateway:gatewayDebug??gatewayMeta}: {})});
  }catch(error){console.error('[bible-pick]',error);return json({error:'말씀을 준비하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'},503);}
}
