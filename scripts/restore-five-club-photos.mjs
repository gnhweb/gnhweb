const WORKER_BASE = 'https://gnhweb-storage-migrate.gemini19840314.workers.dev/v1/legacy-public/';

const photoKeys = [
  'club-photos/cheonhwarae_cheongmyeong-066621c6-3910-438b-b93e-23df702fdcd6.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-8851c1f9-eab4-4590-ac24-2290890e9bbe.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-a4b1f17e-b8c5-4936-a379-df5652e32eff.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-b175109f-75ab-45bd-b360-69c46c402125.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-c39d2943-a36a-4df2-9226-334697a75c49.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-d119e73d-f0a5-4f77-8e94-515591396c15.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-d916d3c3-54bd-4cbe-ae3e-fe58099532a5.jpeg',
  'club-photos/cheonhwarae_cheongmyeong-dd5e89d4-df27-430f-85d8-00b36e3ee197.jpeg',
  'club-photos/cheonjihu-1785402306099-ue6qar.jpg',
  'club-photos/cheonjihu-1785402563202-y4glbs.jpg',
  'club-photos/cheonjihu-1785402569417-kfhh8l.jpg',
  'club-photos/cheonjihu-1785402573381-dkedck.jpg',
  'club-photos/cheonjihu-1785402576574-io0dq6.jpg',
  'club-photos/cheonjihu-1785402581512-weyfjw.jpg',
  'club-photos/cheonjihu-1785402587959-6u29rl.jpg',
  'club-photos/cheonjihu-1785402591966-9tm7tl.jpg',
  'club-photos/cheonjihu-1785402595929-l9y228.jpg',
  'club-photos/cheonjihu-1785402600597-he6vz5.jpg',
  'club-photos/cheonjihu-1785402605204-lxucre.jpg',
  'club-photos/cheonjipoong-1785401583676-onkm7o.png',
  'club-photos/cheonjipoong-1785401583677-gqdfgh.png',
  'club-photos/cheonjipoong-1785401583677-kejwys.png',
  'club-photos/cheonjipoong-1785401583677-o1phzl.png',
  'club-photos/cheonjipoong-1785401583677-rqh8ie.png',
  'club-photos/munhwabu-1785223698980.JPG',
  'club-photos/munhwabu-1785223703341.JPG',
  'club-photos/munhwabu-1785223708010.JPG',
  'club-photos/munhwabu-1785223711822.JPG',
  'club-photos/munhwabu-1785223717027.JPG',
  'club-photos/munhwabu-1785223721116.JPG',
  'club-photos/munhwabu-1785223726057.JPG',
  'club-photos/munhwabu-1785225335925.jpg',
  'club-photos/munhwabu-1785225339495.jpg',
  'club-photos/munhwabu-1785225342591.jpg',
  'club-photos/munhwabu-1786003499242-8q8ymh.jpg',
  'club-photos/munhwabu-1786003647275-fs3nwd.jpg',
  'club-photos/munhwabu-1786003647275-fuls91.jpg',
  'club-photos/saeullim-1786975604959-36qwg3.jpeg',
  'club-photos/saeullim-1786975694658-2ya09t.jpeg',
  'club-photos/saeullim-1786975694658-kai1v5.jpeg',
  'club-photos/saeullim-1786975899052-05y64t.jpeg',
  'club-photos/saeullim-1786975899052-0wy1ak.jpeg',
  'club-photos/saeullim-1786975899052-flc93u.jpeg',
  'club-photos/saeullim-1786975899052-vpc288.jpeg',
  'club-photos/saeullim-1786976017569-idc16t.jpeg',
];

const batchSize = 5;
let restored = 0;
const failures = [];

for (let offset = 0; offset < photoKeys.length; offset += batchSize) {
  const batch = photoKeys.slice(offset, offset + batchSize);
  const results = await Promise.all(batch.map(async (key) => {
    try {
      const response = await fetch(`${WORKER_BASE}${key.split('/').map(encodeURIComponent).join('/')}`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.startsWith('image/')) {
        const body = (await response.text()).slice(0, 300);
        const detail = `${response.status} ${contentType} ${body}`.trim();
        failures.push({ key, detail });
        console.error(`restore failed: ${key} -> ${detail}`);
        return false;
      }
      await response.arrayBuffer();
      console.log(`restored: ${key}`);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push({ key, detail });
      console.error(`restore error: ${key} -> ${detail}`);
      return false;
    }
  }));
  restored += results.filter(Boolean).length;
  console.log(`progress=${restored}/${photoKeys.length}`);
}

console.log(JSON.stringify({ total: photoKeys.length, restored, failed: failures.length, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
