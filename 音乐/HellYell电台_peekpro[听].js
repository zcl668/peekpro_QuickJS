const KEY = 'hellyell';
const NAME = '黑狱电台';
const HOST = 'https://radio.hellyell.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const CLASSES = [
  { type_id: 'foreign-music', type_name: '国际音乐台' },
  { type_id: 'chinese-music', type_name: '中文音乐台' },
  { type_id: 'news-comprehensive', type_name: '新闻综合台' },
  { type_id: 'huaijiu-musiclist', type_name: '怀旧电台' },
  { type_id: 'qiche-musiclist', type_name: '汽车电台' }
];

async function fetchText(url) {
  try {
    const resp = await req(url, { method: 'GET', headers: { 'User-Agent': UA }, timeout: 10000 });
    if (typeof resp === 'string') return resp;
    return resp?.content || resp?.data || resp?.body || String(resp || '');
  } catch (e) {
    console.warn(`[${KEY}] fetch failed:`, e?.message || e);
    return '';
  }
}

async function fetchJson(url) {
  try { return JSON.parse(await fetchText(url)); } catch (e) { return []; }
}

async function init(cfg) { return {}; }

async function home(filter) {
  return JSON.stringify({ class: CLASSES, list: [] });
}

async function homeVod() {
  return JSON.stringify({ list: [] });
}

async function category(tid, pg, filter, extend) {
  const classId = tid || 'chinese-music';
  const stations = await fetchJson(HOST + '/' + classId + '.json');
  const list = [];
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const stationName = s.name || '';
    const tag = s.tag || '';
    if (classId === 'huaijiu-musiclist' && stationName === 'HellYell怀旧电台') continue;
    if (classId === 'qiche-musiclist' && stationName === 'HellYell汽车电台') continue;
    let remark = '在线电台';
    if (tag && tag !== '推荐') remark = tag;
    else if (s.recommended && tag !== '推荐') remark = '精选';
    list.push({ vod_id: s.url || '', vod_name: stationName, vod_pic: HOST + '/favicon.ico', vod_remarks: remark, style: { type: 'list' } });
  }
  return JSON.stringify({ page: 1, pagecount: 1, limit: 100, total: list.length, list });
}

async function detail(ids) {
  const idList = Array.isArray(ids) ? ids : [ids];
  const playUrl = idList[0] || '';
  let name = '电台';
  if (playUrl) {
    try {
      const allClasses = ['foreign-music', 'chinese-music', 'news-comprehensive', 'huaijiu-musiclist', 'qiche-musiclist'];
      for (const c of allClasses) {
        const stations = await fetchJson(HOST + '/' + c + '.json');
        for (let i = 0; i < stations.length; i++) {
          if (playUrl === (stations[i].url || '')) { name = stations[i].name || '电台'; break; }
        }
        if (name !== '电台' && name) break;
      }
    } catch (e) { /* ignore */ }
    if (name === '电台' || !name) name = 'HellYell电台';
  }
  return JSON.stringify({
    list: [{ vod_id: playUrl, vod_name: name, vod_pic: HOST + '/favicon.ico', vod_play_from: '木头的木,平凡的凡!', vod_play_url: '直播$' + playUrl }]
  });
}

async function play(flag, id, vipFlags) {
  const playUrl = id || '';
  const playHeaders = { 'User-Agent': UA };
  if (playUrl && playUrl.includes('music.163.com')) {
    playHeaders['Referer'] = 'https://music.163.com/';
  }
  playHeaders['Accept'] = '*/*';
  playHeaders['Accept-Encoding'] = 'identity;q=1, *;q=0';
  playHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7';
  playHeaders['Connection'] = 'keep-alive';
  return JSON.stringify({ parse: 0, url: playUrl, header: playHeaders, jx: 0 });
}

async function search(wd, quick) {
  return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 100, total: 0 });
}

const spider = {
  meta: { key: KEY, name: NAME, type: 3 },
  init, home, homeVod, category, detail, play, search,
  async check() { return true; }
};

export default spider;
