const KEY = 'loveq';
const NAME = '一些事一些情';
const HOST = 'https://www.loveq.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_PIC = 'https://d.kstore.dev/download/15565/loveq2026.jpg';

const CATEGORIES = [
  { id: '1', name: '粤语节目' },
  { id: '4', name: '得闲小叙' },
  { id: '5', name: '每周一车' },
  { id: '35', name: 'Hugo的Story Time' },
  { id: '3', name: '节目精华' },
  { id: '38', name: '节目版头' },
  { id: '2', name: '国语节目' },
];

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
  return String(str || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
  const currentYear = new Date().getFullYear();
  const years = [{ n: '全部年份', v: '' }];
  for (let y = currentYear; y >= 2002; y--) {
    years.push({ n: String(y), v: String(y) });
  }
  const months = [{ n: '全部月份', v: '' }];
  for (let m = 1; m <= 12; m++) {
    months.push({ n: m + '月', v: String(m) });
  }

  const filters = {};
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    filters[cat.id] = [
      { key: 'year', name: '年份', value: years },
      { key: 'month', name: '月份', value: months },
    ];
  }

  return JSON.stringify({
    class: CATEGORIES.map(c => ({ type_name: c.name, type_id: c.id, type_flag: '1' })),
    filters: filters,
  });
}

async function homeVod() {
  return JSON.stringify({ list: [] });
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

  // 匹配 program_download-xxx.html 链接，然后向上找 dl 提取标题
  const aRegex = /<a[^>]*href=["']program_download-(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi;
  let aMatch;
  while ((aMatch = aRegex.exec(html)) !== null) {
    const vid = aMatch[1];
    if (seenIds.has(vid)) continue;
    seenIds.add(vid);

    const aStart = aMatch.index;
    const dlStart = html.lastIndexOf('<dl', aStart);
    const dlEnd = html.indexOf('</dl>', aStart);
    if (dlStart < 0 || dlEnd < 0) continue;
    const dlHtml = html.substring(dlStart, dlEnd + 5);

    // dt 里是日期
    let dateText = '';
    const dtMatch = dlHtml.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
    if (dtMatch) {
      const aInDt = dtMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      if (aInDt) dateText = stripTags(aInDt[1]);
    }

    // 第一个 dd class="ct" 里是节目标题
    let title = '';
    const ddCtMatch = dlHtml.match(/<dd[^>]*class=["']ct["'][^>]*>([\s\S]*?)<\/dd>/i);
    if (ddCtMatch) title = stripTags(ddCtMatch[1]);

    // 第二个 dd 里是下载次数
    let downloadCount = '';
    const ddRegex = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let ddMatch;
    let ddIndex = 0;
    while ((ddMatch = ddRegex.exec(dlHtml)) !== null) {
      ddIndex++;
      if (ddIndex === 2) {
        downloadCount = stripTags(ddMatch[1]).replace(/,/g, '');
        break;
      }
    }

    if (!title || title.length < 2) {
      title = dateText || '节目' + vid;
    }

    const remarkParts = [];
    if (dateText && dateText !== title) remarkParts.push(dateText);
    if (downloadCount) remarkParts.push('下载: ' + downloadCount);

    videos.push({
      vod_id: vid,
      vod_name: title,
      vod_pic: DEFAULT_PIC,
      vod_remarks: remarkParts.join(' | '),
    });
  }

  let pageCount = 1;
  const pageDivMatch = html.match(/<div[^>]*class=["'][^"']*(?:page|pagination)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (pageDivMatch) {
    const pageDiv = pageDivMatch[1];
    const pageLinkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let plMatch;
    while ((plMatch = pageLinkRegex.exec(pageDiv)) !== null) {
      const href = plMatch[1];
      const text = stripTags(plMatch[2]);
      const pm = href.match(/[?&]page=(\d+)/);
      if (pm) {
        const pnum = parseInt(pm[1], 10);
        if (pnum > pageCount) pageCount = pnum;
      } else if (/^\d+$/.test(text)) {
        const pnum = parseInt(text, 10);
        if (pnum > pageCount) pageCount = pnum;
      }
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
    let pdl1Html = '';

    const pdl1Match = html.match(/<ul[^>]*class=["']pdl1["'][^>]*>([\s\S]*?)<\/ul>/i);
    if (pdl1Match) {
      pdl1Html = pdl1Match[1];
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
    if (pdl1Html) {
      audioLinks = extractAudioLinks(pdl1Html, false);
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

    const newTitle = pubDate
      ? originalTitle + ' (' + pubDate.replace(/\//g, '-') + ')'
      : originalTitle;
    const desc = pubDate
      ? '📅 发布日期：' + pubDate + '\n📝 ' + content
      : content;

    result.push({
      vod_id: vid,
      vod_name: newTitle,
      vod_pic: DEFAULT_PIC,
      vod_content: desc,
      vod_play_from: '木头的木,平凡的凡!',
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

  const aRegex = /<a[^>]*href=["']program_download-(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi;
  let aMatch;
  while ((aMatch = aRegex.exec(html)) !== null) {
    const vid = aMatch[1];
    if (seenIds.has(vid)) continue;
    seenIds.add(vid);

    const aStart = aMatch.index;
    const dlStart = html.lastIndexOf('<dl', aStart);
    const dlEnd = html.indexOf('</dl>', aStart);

    let title = '';
    let dateText = '';
    let downloadCount = '';

    if (dlStart >= 0 && dlEnd >= 0) {
      const dlHtml = html.substring(dlStart, dlEnd + 5);
      const dtMatch = dlHtml.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i);
      if (dtMatch) {
        const aInDt = dtMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        if (aInDt) dateText = stripTags(aInDt[1]);
      }
      const ddCtMatch = dlHtml.match(/<dd[^>]*class=["']ct["'][^>]*>([\s\S]*?)<\/dd>/i);
      if (ddCtMatch) title = stripTags(ddCtMatch[1]);
      const ddRegex = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
      let ddMatch;
      let ddIndex = 0;
      while ((ddMatch = ddRegex.exec(dlHtml)) !== null) {
        ddIndex++;
        if (ddIndex === 2) {
          downloadCount = stripTags(ddMatch[1]).replace(/,/g, '');
          break;
        }
      }
    } else {
      title = stripTags(aMatch[2]);
    }

    if (!title || title.length < 2) {
      title = dateText || '节目' + vid;
    }

    if (key.toLowerCase().indexOf(title.toLowerCase()) !== -1 || title.indexOf(key) !== -1) {
      if (!seenIds.has(vid)) {
        seenIds.add(vid);
        const remarkParts = [];
        if (dateText && dateText !== title) remarkParts.push(dateText);
        if (downloadCount) remarkParts.push('下载: ' + downloadCount);

        results.push({
          vod_id: vid,
          vod_name: title,
          vod_pic: DEFAULT_PIC,
          vod_remarks: remarkParts.join(' | ') || '搜索结果',
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
