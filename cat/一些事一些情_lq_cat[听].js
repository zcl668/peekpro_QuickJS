import req from '../../util/req.js';
import { load } from 'cheerio';

const KEY = 'loveq';
const NAME = '一些事一些情';
const HOST = 'https://www.loveq.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_PIC = 'https://raw.githubusercontent.com/zcl668/videos-bak/main/loveq2026.jpg';
const DEXIAN_PIC = 'https://raw.githubusercontent.com/zcl668/videos-bak/main/loveq2026.jpg';
const FILTER_CATEGORIES = ['盛世乾坤', '一些事一些情', '一些事一些情精华剪辑'];

function pageOf(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function bodyOf(reqIn) {
  return reqIn?.body || {};
}

function extendOf(reqIn) {
  const body = bodyOf(reqIn);
  return body.filters || body.extend || body.ext || body.filter || {};
}

function absUrl(url, base = HOST) {
  if (!url) return '';
  const raw = String(url).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  try {
    return new URL(raw, base).toString();
  } catch {
    return raw;
  }
}

async function getText(url, params = {}, headers = {}) {
  try {
    const { data } = await req.get(url, {
      headers: { 'User-Agent': UA, Referer: HOST + '/', ...headers },
      timeout: 15000,
      responseType: 'text',
      ...(Object.keys(params).length ? { params } : {}),
    });
    return typeof data === 'string' ? data : String(data || '');
  } catch (e) {
    console.warn(`[${KEY}] 请求失败:`, e?.message || e);
    return '';
  }
}

async function init() {
  return {};
}

async function home() {
  const html = await getText(`${HOST}/program.html`);
  if (!html) {
    return { class: [], filters: {} };
  }

  const $ = load(html);
  const categories = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const title = $a.text().trim();

    const catMatch = href.match(/program-cat(\d+)-p\d+\.html/);
    if (catMatch && title && !FILTER_CATEGORIES.includes(title)) {
      const catId = catMatch[1];
      if (catId !== '0' && !seen.has(catId)) {
        seen.add(catId);
        categories.push({ type_name: title, type_id: catId });
      }
    }
  });

  categories.sort((a, b) => parseInt(a.type_id, 10) - parseInt(b.type_id, 10));

  const currentYear = new Date().getFullYear();
  const years = [{ n: '全部年份', v: '' }];
  for (let y = currentYear; y >= 2003; y--) {
    years.push({ n: String(y), v: String(y) });
  }

  const months = [{ n: '全部月份', v: '' }];
  for (let m = 1; m <= 12; m++) {
    months.push({ n: `${m}月`, v: String(m) });
  }

  const filters = {};
  for (const cat of categories) {
    filters[cat.type_id] = [
      { key: 'year', name: '年份', value: years },
      { key: 'month', name: '月份', value: months },
    ];
  }

  return { class: categories, filters };
}

async function homeVod() {
  return category({ body: { id: '1', page: '1', filters: {} } });
}

async function category(reqIn) {
  const body = bodyOf(reqIn);
  const tid = String(body.id || body.tid || '1');
  const page = pageOf(body.page);
  const extend = extendOf(reqIn);

  const params = { cat_id: tid, page };
  if (extend.year) params.year = extend.year;
  if (extend.month) params.month = extend.month;

  const html = await getText(`${HOST}/program.html`, params);
  if (!html) {
    return { list: [], page, pagecount: 0, limit: 30, total: 0 };
  }

  const $ = load(html);
  const videos = [];

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const title = $a.text().trim();

    if (!title || title.length < 2) return;

    const vidMatch = href.match(/program_download-?(\d+)\.html/);
    if (vidMatch) {
      const vid = vidMatch[1];
      let pic = DEFAULT_PIC;
      const $img = $a.find('img');
      if ($img.length && $img.attr('src')) {
        pic = absUrl($img.attr('src'));
      }

      let remark = '';
      const $parent = $a.closest('li, div.item, div.entry');
      if ($parent.length) {
        const $date = $parent.find('span.date, span.time');
        if ($date.length) {
          remark = $date.text().trim();
        }
      }

      videos.push({
        vod_id: vid,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: remark,
      });
    }
  });

  let pageCount = 1;
  const $pagination = $('div.page, div.pagination');
  if ($pagination.length) {
    let maxPage = 1;
    $pagination.find('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      const pageMatch = href.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        const pgNum = parseInt(pageMatch[1], 10);
        if (pgNum > maxPage) maxPage = pgNum;
      }
      if (/^\d+$/.test(text)) {
        const num = parseInt(text, 10);
        if (num > maxPage) maxPage = num;
      }
    });
    pageCount = maxPage;
  }

  if (pageCount <= page && videos.length > 0) {
    pageCount = page + 1;
  }

  return {
    list: videos,
    page,
    pagecount: pageCount,
    limit: 30,
    total: videos.length,
  };
}

async function detail(reqIn) {
  const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
  const list = [];

  for (const vid of ids.filter(Boolean)) {
    const html = await getText(`${HOST}/program_download-${vid}.html`);
    if (!html) continue;

    const $ = load(html);

    let originalTitle = '';
    const titleText = $('title').text();
    if (titleText) {
      originalTitle = titleText.replace(/[-|]\s*LoveQ.*$/, '').trim();
    }
    if (!originalTitle) {
      originalTitle = `节目${vid}`;
    }

    let pubDate = '';
    let content = '';

    const $pdl1 = $('ul.pdl1');
    if ($pdl1.length) {
      $pdl1.find('li').each((_, el) => {
        const liText = $(el).text().trim();

        if (liText.includes('发布日期：') || liText.includes('发布时间：')) {
          const dateMatch = liText.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
          if (dateMatch) {
            pubDate = dateMatch[1];
          } else {
            pubDate = liText.replace(/^(发布日期|发布时间)[：:]/, '').trim();
          }
        } else if (liText.includes('节目内容：') || liText.includes('内容简介：')) {
          content = liText.replace(/^(节目内容|内容简介)[：:]/, '').trim();
        }
      });
    }

    if (!content) {
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) content = metaDesc.trim();
    }

    if (!content) {
      const $contentDiv = $('div.content, div.intro, div.desc').first();
      if ($contentDiv.length) {
        content = $contentDiv.text().trim().substring(0, 500);
      }
    }

    if (content && /^\d{4}[-/]\d{2}[-/]\d{2}\s*$/.test(content)) {
      content = '暂无节目简介';
    }
    if (!content) {
      content = '暂无节目简介';
    }

    const audioLinks = [];
    const seen = new Set();

    function normalizeAudio(src) {
      if (!src) return null;
      src = src.trim();
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) src = absUrl(src);
      src = src.replace(/https?:\/\/dl1\.loveq\.cn/gi, 'https://dl2.loveq.cn');
      return src;
    }

    function extractFromContainer(containerHtml) {
      const links = [];
      if (!containerHtml) return links;
      const regex = /<(?:audio|source)[^>]*src=["']([^"']+)["']/gi;
      let m;
      while ((m = regex.exec(containerHtml)) !== null) {
        const src = normalizeAudio(m[1]);
        if (src && !seen.has(src)) {
          seen.add(src);
          links.push(src);
        }
      }
      return links;
    }

    if ($pdl1.length) {
      const pdl1Html = $.html($pdl1);
      audioLinks.push(...extractFromContainer(pdl1Html));
    }

    if (audioLinks.length === 0) {
      const fullHtml = $.html();
      const regex = /<(?:audio|source)[^>]*src=["']([^"']+)["']/gi;
      let m;
      while ((m = regex.exec(fullHtml)) !== null) {
        const src = normalizeAudio(m[1]);
        if (src && src.includes('/program/') && !seen.has(src)) {
          seen.add(src);
          audioLinks.push(src);
        }
      }
    }

    let playUrl;
    if (audioLinks.length > 0) {
      if (audioLinks.length > 1) {
        playUrl = audioLinks.map((link, i) => `LoveQ音频${i + 1}$${link}`).join('$$$');
      } else {
        playUrl = `LoveQ音频$${audioLinks[0]}`;
      }
    } else {
      playUrl = '暂无音频';
    }

    let vodPic = DEFAULT_PIC;
    if (originalTitle.includes('得闲小叙') || originalTitle.includes('得闲')) {
      vodPic = DEXIAN_PIC;
    } else {
      const $img = $('img.cover, img.poster, img.pic').first();
      if ($img.length && $img.attr('src')) {
        vodPic = absUrl($img.attr('src'));
      }
    }

    let newTitle;
    if (pubDate) {
      const formattedDate = pubDate.replace(/\//g, '-');
      const contentPreview = content.length > 50 ? content.substring(0, 50) : content;
      newTitle = `${formattedDate} - ${contentPreview}`;
    } else {
      newTitle = originalTitle;
    }

    const desc = pubDate ? `📅 发布日期：${pubDate}\n📝 ${content}` : content;

    list.push({
      vod_id: vid,
      vod_name: newTitle,
      vod_pic: vodPic,
      vod_content: desc,
      vod_play_from: '木凡的天空',
      vod_play_url: playUrl,
    });
  }

  return { list };
}

async function play(reqIn) {
  let id = String(reqIn?.body?.id || '').trim();

  if (id.includes('$$$')) {
    const firstTrack = id.split('$$$')[0];
    id = firstTrack.includes('$') ? firstTrack.split('$', 2)[1] : firstTrack;
  } else if (id.includes('$')) {
    id = id.split('$', 2)[1];
  }

  id = id.replace(/https?:\/\/dl1\.loveq\.cn/gi, 'https://dl2.loveq.cn');

  return {
    parse: 0,
    playUrl: '',
    url: id,
    header: {
      'User-Agent': UA,
      Referer: HOST + '/',
      Origin: HOST,
      Accept: 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Range: 'bytes=0-',
      Connection: 'keep-alive',
    },
  };
}

async function search(reqIn) {
  const body = bodyOf(reqIn);
  const pg = pageOf(body.page);
  const key = String(body.wd || '').trim();
  if (!key) {
    return { list: [], page: pg, pagecount: pg, limit: 30, total: 0 };
  }

  const encodedKey = encodeURIComponent(key);
  const searchUrls = [
    `${HOST}/so-${pg}-${encodedKey}.html`,
    `${HOST}/so.html?wd=${encodedKey}&page=${pg}`,
    `${HOST}/search.php?keyword=${encodedKey}&page=${pg}`,
  ];

  let html = '';
  for (const url of searchUrls) {
    html = await getText(url);
    if (html) break;
  }

  if (!html) {
    return { list: [], page: pg, pagecount: pg, limit: 30, total: 0 };
  }

  const $ = load(html);
  const results = [];
  const seenIds = new Set();

  $('a[href]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const title = $a.text().trim();

    if (!title || title.length < 2) return;

    const vidMatch = href.match(/program_download-?(\d+)\.html/);
    if (vidMatch) {
      const vid = vidMatch[1];
      if (title.toLowerCase().includes(key.toLowerCase()) || title.includes(key)) {
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
  });

  return {
    list: results,
    page: pg,
    pagecount: pg,
    limit: 30,
    total: results.length,
  };
}

export default function createSpider() {
  return {
    meta: {
      key: KEY,
      name: NAME,
      type: 3,
    },
    api: async (fastify) => {
      fastify.post('/init', init);
      fastify.post('/home', home);
      fastify.post('/homeVod', homeVod);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', play);
      fastify.post('/search', search);
    },
    check: async () => true,
  };
}
