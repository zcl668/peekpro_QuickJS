const KEY = 'qtfm';
const NAME = '蜻蜓FM';
const HOST = 'https://www.qtfm.cn';
const MHOST = 'https://m.qtfm.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const MUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
const LIMIT = 12;

const CLASS_NAME = [
  "广东","木凡喜爱的广播","浙江","北京","天津","河北","上海","山西","内蒙古",
  "辽宁","吉林","黑龙江","江苏","安徽","福建","江西","山东",
  "河南","湖北","湖南","广西","海南","重庆","四川","贵州",
  "云南","陕西","甘肃","宁夏","新疆","西藏","青海",
  "资讯","音乐","交通","经济","文艺","都市","体育","双语",
  "综合","生活","旅游","曲艺","方言"
];

const CLASS_URL = [
  "217","mufan","99","3","5","7","83","19","31","44","59","69","85",
  "111","129","139","151","169","187","202","239","254","257",
  "259","281","291","316","327","351","357","308","342",
  "433","442","429","439","432","441","430","431","440",
  "438","435","436","434"
];

const MU_FAN_STATIONS = [
  ["雷霆881", "https://881.touch-u.fun/playlist.m3u8"],
  ["叱咤903", "https://903.touch-u.fun/playlist.m3u8"],
  ["广东珠江经济台", "https://lhttp.qtfm.cn/live/1259/64k.mp3?app_id=web"],
  ["加州星岛中文粤语台", "http://nap.casthost.net:8765/m3u8"],
  ["新城知讯台", "https://1603884249.rsc.cdn77.org/1603884249/tracks-a1/mono.ts.m3u8"],
  ["新城采讯台", "https://1946218710.rsc.cdn77.org/1946218710/tracks-a1/mono.ts.m3u8"],
  ["深圳飞扬971", "https://lhttp.qtfm.cn/live/1271/64k.mp3?app_id=web"],
  ["茂名综合广播", "https://lhttp.qtfm.cn/live/20500088/64k.mp3?app_id=web"],
  ["清晨音乐", "https://live.ximalaya.com/radio-first-page-app/live/1011/64.m3u8"],
  ["怀旧音乐", "https://live.ximalaya.com/radio-first-page-app/live/966/64.m3u8"],
  ["亚洲粤语台", "https://lhttp.qtfm.cn/live/15318569/64k.mp3||https://live.ximalaya.com/radio-first-page-app/live/999/64.m3u8"],
  ["经典", "https://live.ximalaya.com/radio-first-page-app/live/2689/64.m3u8"],
  ["亚洲热歌", "https://live.ximalaya.com/radio-first-page-app/live/1908/64.m3u8"],
  ["年代音乐", "https://live.ximalaya.com/radio-first-page-app/live/763/64.m3u8"],
  ["FM105.6", "https://live.ximalaya.com/radio-first-page-app/live/325/64.m3u8"],
  ["音悦台", "https://live.ximalaya.com/radio-first-page-app/live/2684/64.m3u8"],
  ["年代965", "https://live.ximalaya.com/radio-first-page-app/live/2878/64.m3u8"],
  ["经典调频1038", "https://live.ximalaya.com/radio-first-page-app/live/2728/64.m3u8"],
  ["化州人民广播电台", "https://lhttp.qtfm.cn/live/15318689/64k.mp3?app_id=web"],
  ["马来西亚988友声有色", "https://22243.live.streamtheworld.com/988_FMAAC.aac"],
  ["Yes933", "https://playerservices.streamtheworld.com/api/livestream-redirect/YES933_PREM.aac"],
  ["澳门fm99.5", "https://fm995.ddns.net/hls1/fm995.m3u8"]
];

function jsonStr(s) {
  if (s == null) return '""';
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
}

function urlDecode(s) {
  if (!s) return '';
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function extractStr(text, key) {
  if (!text) return '';
  const regex = new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"');
  const m = regex.exec(text);
  return m ? m[1] : '';
}

function extractBasicInfo(html) {
  const idx = html.indexOf('"basicInfo"');
  if (idx < 0) return '';
  const braceStart = html.indexOf('{', idx);
  if (braceStart < 0) return '';
  let braceCount = 0;
  let braceEnd = braceStart;
  for (let i = braceStart; i < html.length; i++) {
    const c = html.charAt(i);
    if (c === '{') braceCount++;
    else if (c === '}') {
      braceCount--;
      if (braceCount === 0) { braceEnd = i + 1; break; }
    }
  }
  return html.substring(braceStart, braceEnd);
}

function stripTags(str) {
  return String(str || '').replace(/<[^>]+>/g, '').trim();
}

async function fetchText(url, isMobile) {
  const headers = isMobile
    ? { 'User-Agent': MUA, Referer: MHOST + '/', Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'zh-CN,zh;q=0.9' }
    : { 'User-Agent': UA, Referer: HOST + '/' };
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await req(url, { method: 'GET', headers, timeout: 15000 });
      const text = typeof resp === 'string' ? resp : (resp?.content || resp?.data || resp?.body || String(resp || ''));
      return text;
    } catch (e) {
      if (i === 2) { console.warn(`[${KEY}] fetch failed:`, e?.message || e); return ''; }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return '';
}

async function init(cfg) { return {}; }

async function home(filter) {
  const classes = [];
  for (let i = 0; i < CLASS_NAME.length; i++) {
    classes.push({ type_id: CLASS_URL[i], type_name: CLASS_NAME[i], type_flag: '1' });
  }
  return JSON.stringify({ class: classes, list: [] });
}

async function homeVod() {
  return JSON.stringify({ list: [] });
}

async function category(tid, pg, filter, extend) {
  const id = String(tid || '');
  const page = parseInt(pg || '1', 10) || 1;

  if (id === 'mufan') return getMuFanContent(page);

  const url = HOST + '/radiopage/' + id + '/' + page + '/';
  const html = await fetchText(url, false);
  if (!html) {
    return JSON.stringify({ page: page, pagecount: page, limit: LIMIT, total: 0, list: [] });
  }

  const list = [];
  const itemRegex = /<div class="content-item-root c-itemS radio">([\s\S]*?)<\/div>\s*<\/div>/g;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const item = match[1];
    let title = '';
    const titleMatch = item.match(/<div class="itemTitleRadio" title="([^"]*)"/);
    if (titleMatch) title = titleMatch[1];
    if (!title) {
      const spanMatch = item.match(/<span>([^<]*)<\/span>/);
      if (spanMatch) title = spanMatch[1].trim();
    }
    if (!title) title = '未知电台';

    let pic = '';
    const picMatch = item.match(/<img[^>]*src="(\/\/[^"]+)"/);
    if (picMatch) {
      pic = picMatch[1];
      if (pic.startsWith('//')) pic = 'https:' + pic;
    }

    let desc = '';
    const descMatch = item.match(/<div class="descRadio[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (descMatch) desc = stripTags(descMatch[1]);

    let vodId = '';
    const hrefMatch = item.match(/<a class="link" href="\/radios\/(\d+)"/);
    if (hrefMatch) vodId = HOST + '/radios/' + hrefMatch[1];

    if (vodId) {
      list.push({ vod_id: vodId, vod_name: title, vod_pic: pic, vod_remarks: desc });
    }
  }

  const hasNext = html.includes('paging-item-a') && html.includes('下一页');
  const pagecount = hasNext ? page + 1 : page;
  const total = hasNext ? 9999 : 0;
  return JSON.stringify({ page, pagecount, limit: LIMIT, total, list });
}

function getMuFanContent(page) {
  const total = MU_FAN_STATIONS.length;
  const pagecount = Math.ceil(total / LIMIT);
  if (page > pagecount || page < 1) {
    return JSON.stringify({ page, pagecount, limit: LIMIT, total, list: [] });
  }
  const start = (page - 1) * LIMIT;
  const end = Math.min(start + LIMIT, total);
  const list = [];
  for (let i = start; i < end; i++) {
    list.push({ vod_id: 'mufan_' + i, vod_name: MU_FAN_STATIONS[i][0], vod_pic: '', vod_remarks: '木凡收藏' });
  }
  return JSON.stringify({ page, pagecount, limit: LIMIT, total, list });
}

async function detail(ids) {
  const idList = Array.isArray(ids) ? ids : [ids];
  const result = [];

  for (const rawVid of idList) {
    const vid = urlDecode(rawVid);
    if (vid.startsWith('mufan_')) {
      try {
        const idx = parseInt(vid.substring(6), 10);
        if (idx >= 0 && idx < MU_FAN_STATIONS.length) {
          const name = MU_FAN_STATIONS[idx][0];
          const url = MU_FAN_STATIONS[idx][1];
          if (url.includes('||')) {
            const urls = url.split('||');
            const fromArr = [], urlArr = [];
            for (let i = 0; i < urls.length; i++) {
              fromArr.push('线路' + (i + 1));
              urlArr.push(name + '$' + urls[i].trim());
            }
            result.push({ vod_id: vid, vod_name: name, vod_pic: '', vod_content: '木凡喜爱的广播', vod_play_from: fromArr.join('$$$'), vod_play_url: urlArr.join('$$$') });
          } else {
            result.push({ vod_id: vid, vod_name: name, vod_pic: '', vod_content: '木凡喜爱的广播', vod_play_from: '木头的木,平凡的凡!', vod_play_url: name + '$' + url });
          }
        }
      } catch (e) { console.warn(`[${KEY}] mufan parse error:`, e?.message); }
      continue;
    }

    let radioId = vid.replace(/\/$/, '');
    radioId = radioId.substring(radioId.lastIndexOf('/') + 1);
    const mUrl = MHOST + '/channels/' + radioId + '/';
    const html = await fetchText(mUrl, true);

    let title = '', pic = '', desc = '';
    if (html) {
      const basicInfo = extractBasicInfo(html);
      if (basicInfo) {
        title = extractStr(basicInfo, 'name');
        pic = extractStr(basicInfo, 'cover');
        desc = extractStr(basicInfo, 'desc');
      }
      if (!title) title = extractStr(html, 'name');
      if (!pic) pic = extractStr(html, 'cover');
      if (!desc) desc = extractStr(html, 'desc');
    }

    if (pic && pic.includes('!200')) pic = pic.replace('!200', '');
    if (pic && pic.startsWith('//')) pic = 'https:' + pic;

    const playUrl = 'https://lhttp.qtfm.cn/live/' + radioId + '/64k.mp3';
    const displayTitle = title || '电台-' + radioId;

    result.push({ vod_id: vid, vod_name: displayTitle, vod_pic: pic, vod_content: desc, vod_play_from: '木头的木,平凡的凡!', vod_play_url: displayTitle + '$' + playUrl });
  }
  return JSON.stringify({ list: result });
}

async function play(flag, id, vipFlags) {
  const decodedId = urlDecode(id);
  const headerObj = { 'User-Agent': UA, Referer: HOST + '/' };
  return JSON.stringify({ parse: 0, playUrl: '', url: decodedId, header: headerObj, jx: 0 });
}

async function search(wd, quick) {
  const key = String(wd || '').trim();
  const page = 1;
  if (!key) return JSON.stringify({ page, pagecount: page, limit: LIMIT, total: 0, list: [] });

  let encodedKey;
  try { encodedKey = encodeURIComponent(key); } catch (e) { encodedKey = key; }
  const searchUrl = HOST + '/search/' + encodedKey + '/';
  const html = await fetchText(searchUrl, false);

  const list = [];
  const seen = new Set();
  if (html) {
    const regex = /<a class="link" href="\/radios\/(\d+)"[^>]*>[\s\S]*?<img[^>]*src="(\/\/[^"]+)"[^>]*>[\s\S]*?<div[^>]*class="itemTitle[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const rid = match[1];
      if (seen.has(rid)) continue;
      seen.add(rid);
      const title = stripTags(match[3]);
      const picUrl = match[2].startsWith('//') ? 'https:' + match[2] : match[2];
      if (title) list.push({ vod_id: HOST + '/radios/' + rid, vod_name: title, vod_pic: picUrl, vod_remarks: '搜索' });
    }
  }
  return JSON.stringify({ page, pagecount: page, limit: LIMIT, total: 0, list });
}

const spider = {
  meta: { key: KEY, name: NAME, type: 3 },
  init, home, homeVod, category, detail, play, search,
  async check() { return true; }
};

export default spider;
