const KEY = 'loveq';
const NAME = '一些事一些情';
const HOST = 'https://www.loveq.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_PIC = 'https://raw.githubusercontent.com/zcl668/videos-bak/main/loveq2026.jpg';
const DEXIAN_PIC = 'https://raw.githubusercontent.com/zcl668/videos-bak/main/loveq2026.jpg';
const FILTER_CATEGORIES = ['盛世乾坤', '一些事一些情', '一些事一些情精华剪辑'];

function pageOf(value) {
  const page = parseInt(value, 10);
  return isFinite(page) && page > 0 ? page : 1;
}

function absUrl(url, base) {
  if (!url) return '';
  const raw = String(url).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  try {
    return new URL(raw, base || HOST).toString();
  } catch {
    return raw;
  }
}

function buildQuery(params) {
  const pairs = [];
  for (const k in params) {
    const v = params[k];
    if (v !== undefined && v !== null && v !== '') {
      pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    }
  }
  return pairs.join('&');
}

async function fetchText(url, params) {
  try {
    const query = buildQuery(params || {});
    const fullUrl = query ? url + '?' + query : url;
    const resp = await req(fullUrl, {
      method: 'GET',
      headers: { 'User-Agent': UA, Referer: HOST + '/' },
      timeout: 15000,
    });
    if (typeof resp === 'string') return resp;
    return resp && resp.content ? resp.content : String(resp || '');
  } catch (e) {
    console.warn('[' + KEY + '] 请求失败:', e && e.message ? e.message : e);
    return '';
  }
}

function stripTags(str) {
  return String(str || '').replace(/<[^>]+>/g, '').trim();
}

function normalizeAudio(src) {
  if (!src) return null;
  src = src.trim();
  if (src.startsWith('//')) src = 'https:' + src;
  else if (src.startsWith('/')) src = absUrl(src);
  src = src.replace(/https?:\/\/dl1\.loveq\.cn/gi, 'https://dl2.loveq.cn');
  return src;
}

function extractAudioLinks(html, restrictProgramPath) {
  const links = [];
  const seen = new Set();
  const regex = /<(?:audio|source)[^>]*src=["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const src = normalizeAudio(m[1]);
    if (src && !seen.has(src)) {
      if (restrictProgramPath && !src.includes('/program/')) continue;
      seen.add(src);
      links.push(src);
    }
  }
  return links;
}

async function init(cfg) {
  return {};
}

async function home(filter) {
  const html = await fetchText(HOST + '/program.html');
  if (!html) {
    return JSON.stringify({ class: [], filters: {} });
  }

  const categories = [];
  const seen = new Set();
  const catRegex = /<a[^>]*href=["']program-cat(\d+)-p\d+\.html["'][^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = catRegex.exec(html)) !== null) {
    const catId = m[1];
    const title = m[2].trim();
    if (title && FILTER_CATEGORIES.indexOf(title) === -1 && catId !== '0' && !seen.has(catId)) {
      seen.add(catId);
      categories.push({ type_name: title, type_id: catId });
    }
  }

  categories.sort(function (a, b) {
    return parseInt(a.type_id, 10) - parseInt(b.type_id, 10);
  });

  const currentYear = new Date().getFullYear();
  const years = [{ n: '全部年份', v: '' }];
  for (let y = currentYear; y >= 2003; y--) {
    years.push({ n: String(y), v: String(y) });
  }

  const months = [{ n: '全部月份', v: '' }];
  for (let m = 1; m <= 12; m++) {
    months.push({ n: m + '月', v: String(m) });
  }

  const filters = {};
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    filters[cat.type_id] = [
      { key: 'year', name: '年份', value: years },
      { key: 'month', name: '月份', value: months },
    ];
  }

  return JSON.stringify({ class: categories, filters: filters });
}

async function homeVod() {
  return category('1', '1', false, {});
}

async function category(tid, pg, filter, extend) {
  const id = String(tid || '1');
  const page = pageOf(pg);
  const ext = extend || {};

  const params = { cat_id: id, page: page };
  if (ext.year) params.year = ext.year;
  if (ext.month) params.month = ext.month;

  const html = await fetchText(HOST + '/program.html', params);
  if (!html) {
    return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 30, total: 0 });
  }

  const videos = [];
  const seenIds = new Set();
  const itemRegex = /<a[^>]*href=["'][^"']*program_download-?(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const vid = m[1];
    if (seenIds.has(vid)) continue;
    seenIds.add(vid);

    const inner = m[2];
    const title = stripTags(inner);
    if (!title || title.length < 2) continue;

    let pic = DEFAULT_PIC;
    const imgMatch = inner.match(/<img[^>]*src=["']([^"']+)["']/);
    if (imgMatch) pic = absUrl(imgMatch[1]);

    let remark = '';
    const parentMatch = html.substring(Math.max(0, m.index - 500), m.index).match(/<li[^>]*>[\s\S]*$/);
    if (parentMatch) {
      const dateMatch = parentMatch[0].match(/<span[^>]*(?:date|time)[^>]*>([^<]+)<\/span>/);
      if (dateMatch) remark = dateMatch[1].trim();
    }

    videos.push({
      vod_id: vid,
      vod_name: title,
      vod_pic: pic,
      vod_remarks: remark,
    });
  }

  let pageCount = 1;
  const pageMatches = html.matchAll(/[?&]page=(\d+)/g);
  if (pageMatches) {
    const nums = [];
    for (const pm of pageMatches) nums.push(parseInt(pm[1], 10));
    if (nums.length) pageCount = Math.max.apply(null, nums);
  }

  const paginationMatch = html.match(/<div[^>]*class=["'][^"']*(?:page|pagination)[^"']*["'][^>]*>([\s\S]*?)<\/div>/);
  if (paginationMatch) {
    const numMatches = paginationMatch[1].matchAll(/>(\d+)</g);
    const nums = [];
    for (const nm of numMatches) nums.push(parseInt(nm[1], 10));
    if (nums.length) {
      const maxNum = Math.max.apply(null, nums);
      if (maxNum > pageCount) pageCount = maxNum;
    }
  }

  if (pageCount <= page && videos.length > 0) {
    pageCount = page + 1;
  }

  return JSON.stringify({
    list: videos,
    page: page,
    pagecount: pageCount,
    limit: 30,
    total: videos.length,
  });
}

async function detail(ids) {
  const idList = Array.isArray(ids) ? ids : [ids];
  const result = [];

  for (let idx = 0; idx < idList.length; idx++) {
    const vid = idList[idx];
    if (!vid) continue;

    const html = await fetchText(HOST + '/program_download-' + vid + '.html');
    if (!html) continue;

    let originalTitle = '';
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      originalTitle = titleMatch[1].replace(/[-|]\s*LoveQ.*$/, '').trim();
    }
    if (!originalTitle) originalTitle = '节目' + vid;

    let pubDate = '';
    let content = '';

    const pdl1Match = html.match(/<ul[^>]*class=["']pdl1["'][^>]*>([\s\S]*?)<\/ul>/i);
    if (pdl1Match) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
      let liM;
      while ((liM = liRegex.exec(pdl1Match[1])) !== null) {
        const liText = stripTags(liM[1]);

        if (liText.indexOf('发布日期：') !== -1 || liText.indexOf('发布时间：') !== -1) {
          const dateMatch = liText.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          } else {
            pubDate = liText.replace(/^(发布日期|发布时间)[：:]/, '').trim();
          }
        } else if (liText.indexOf('节目内容：') !== -1 || liText.indexOf('内容简介：') !== -1) {
          content = liText.replace(/^(节目内容|内容简介)[：:]/, '').trim();
        }
      }
    }

    if (!content) {
      const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (metaMatch) content = metaMatch[1].trim();
    }

    if (!content) {
      const contentMatch = html.match(/<div[^>]*class=["'][^"']*(?:content|intro|desc)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      if (contentMatch) content = stripTags(contentMatch[1]).substring(0, 500);
    }

    if (content && /^\d{4}[-/]\d{2}[-/]\d{2}\s*$/.test(content)) {
      content = '暂无节目简介';
    }
    if (!content) content = '暂无节目简介';

    let audioLinks = [];
    if (pdl1Match) {
      audioLinks = extractAudioLinks(pdl1Match[1], false);
    }

    if (audioLinks.length === 0) {
      audioLinks = extractAudioLinks(html, true);
    }

    let playUrl;
    if (audioLinks.length > 0) {
      if (audioLinks.length > 1) {
        playUrl = audioLinks.map(function (link, i) {
          return 'LoveQ音频' + (i + 1) + '$' + link;
        }).join('$$$');
      } else {
        playUrl = 'LoveQ音频$' + audioLinks[0];
      }
    } else {
      playUrl = '暂无音频';
    }

    let vodPic = DEFAULT_PIC;
    if (originalTitle.indexOf('得闲小叙') !== -1 || originalTitle.indexOf('得闲') !== -1) {
      vodPic = DEXIAN_PIC;
    } else {
      const imgMatch = html.match(/<img[^>]*class=["'][^"']*(?:cover|poster|pic)[^"']*["'][^>]*src=["']([^"']+)["']/i);
      if (imgMatch) vodPic = absUrl(imgMatch[1]);
    }

    let newTitle;
    if (pubDate) {
      const formattedDate = pubDate.replace(/\//g, '-');
      const contentPreview = content.length > 50 ? content.substring(0, 50) : content;
      newTitle = formattedDate + ' - ' + contentPreview;
    } else {
      newTitle = originalTitle;
    }

    const desc = pubDate ? '📅 发布日期：' + pubDate + '\n📝 ' + content : content;

    result.push({
      vod_id: vid,
      vod_name: newTitle,
      vod_pic: vodPic,
      vod_content: desc,
      vod_play_from: '木凡的天空',
      vod_play_url: playUrl,
    });
  }

  return JSON.stringify({ list: result });
}

async function play(flag, id, vipFlags) {
  let audioUrl = String(id || '').trim();

  if (audioUrl.indexOf('$$$') !== -1) {
    const firstTrack = audioUrl.split('$$$')[0];
    audioUrl = firstTrack.indexOf('$') !== -1 ? firstTrack.split('$', 2)[1] : firstTrack;
  } else if (audioUrl.indexOf('$') !== -1) {
    audioUrl = audioUrl.split('$', 2)[1];
  }

  audioUrl = audioUrl.replace(/https?:\/\/dl1\.loveq\.cn/gi, 'https://dl2.loveq.cn');

  return JSON.stringify({
    parse: 0,
    playUrl: '',
    url: audioUrl,
    header: {
      'User-Agent': UA,
      Referer: HOST + '/',
      Origin: HOST,
      Accept: 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Range: 'bytes=0-',
      Connection: 'keep-alive',
    },
  });
}

async function search(wd, quick) {
  const key = String(wd || '').trim();
  const pg = 1;
  if (!key) {
    return JSON.stringify({ list: [], page: pg, pagecount: pg, limit: 30, total: 0 });
  }

  const encodedKey = encodeURIComponent(key);
  const searchUrls = [
    HOST + '/so-' + pg + '-' + encodedKey + '.html',
    HOST + '/so.html?wd=' + encodedKey + '&page=' + pg,
    HOST + '/search.php?keyword=' + encodedKey + '&page=' + pg,
  ];

  let html = '';
  for (let i = 0; i < searchUrls.length; i++) {
    html = await fetchText(searchUrls[i]);
    if (html) break;
  }

  if (!html) {
    return JSON.stringify({ list: [], page: pg, pagecount: pg, limit: 30, total: 0 });
  }

  const results = [];
  const seenIds = new Set();
  const itemRegex = /<a[^>]*href=["'][^"']*program_download-?(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const vid = m[1];
    const title = stripTags(m[2]);
    if (!title || title.length < 2) continue;

    if (title.toLowerCase().indexOf(key.toLowerCase()) !== -1 || title.indexOf(key) !== -1) {
      if (!seenIds.has(vid)) {
        seenIds.add(vid);
        results.push({
          vod_id: vid,
          vod_name: title,
          vod_pic: DEFAULT_PIC,
          vod_remarks: '搜索结果',
        });
      }
    }
  }

  return JSON.stringify({
    list: results,
    page: pg,
    pagecount: pg,
    limit: 30,
    total: results.length,
  });
}

async function check() {
  return true;
}

const spider = {
  meta: { key: KEY, name: NAME, type: 3 },
  init: init,
  home: home,
  homeVod: homeVod,
  category: category,
  detail: detail,
  play: play,
  search: search,
  check: check,
};

export default spider;
