import req from '../../util/req.js';
import { load } from 'cheerio';
import { URL } from 'url';

const KEY = 'qtfm';
const NAME = '蜻蜓FM';
const HOST = 'https://www.qtfm.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const M_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

const CLASS_NAMES = [
  '广东', '浙江', '北京', '天津', '河北', '上海', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江', '江苏', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '陕西', '甘肃', '宁夏', '新疆', '西藏', '青海',
  '资讯', '音乐', '交通', '经济', '文艺', '都市', '体育', '双语',
  '综合', '生活', '旅游', '曲艺', '方言',
];

const CLASS_IDS = [
  '217', '99', '3', '5', '7', '83', '19', '31', '44', '59', '69', '85',
  '111', '129', '139', '151', '169', '187', '202', '239', '254', '257',
  '259', '281', '291', '316', '327', '351', '357', '308', '342',
  '433', '442', '429', '439', '432', '441', '430', '431', '440',
  '438', '435', '436', '434',
];

const LIMIT = 12;

function pageOf(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function absUrl(url, base = HOST) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return 'https:' + raw;
  return new URL(raw, base).toString();
}

async function fetchHtml(url, useMobile = false) {
  const headers = {
    'User-Agent': useMobile ? M_UA : UA,
    Referer: useMobile ? 'https://m.qtfm.cn/' : 'https://www.qtfm.cn/',
  };
  const { data } = await req.get(url, {
    headers,
    timeout: 15000,
    responseType: 'text',
  });
  return String(data || '');
}

async function init() {
  return {};
}

async function home() {
  const classes = [];
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    classes.push({ type_id: CLASS_IDS[i], type_name: CLASS_NAMES[i] });
  }
  return { class: classes, filters: {}, list: [] };
}

async function category(reqIn) {
  const body = reqIn?.body || {};
  const tid = String(body.id || body.tid || '217');
  const page = pageOf(body.page);
  const url = `${HOST}/radiopage/${tid}/${page}/`;
  const html = await fetchHtml(url);

  const $ = load(html);
  const videos = [];

  $('.content-item-root.c-itemS.radio').each((_, el) => {
    const $el = $(el);
    const title =
      $el.find('.itemTitleRadio').attr('title') ||
      $el.find('span').first().text().trim() ||
      '未知电台';

    let pic = $el.find('img').first().attr('src') || '';
    pic = absUrl(pic);

    let desc = $el.find('div[class*="descRadio"]').first().html() || '';
    desc = desc.replace(/<[^>]+>/g, '').trim();

    const href = $el.find('a.link').first().attr('href') || '';
    const vodId = href ? absUrl(href) : '';

    if (vodId) {
      videos.push({
        vod_id: vodId,
        vod_name: title,
        vod_pic: pic,
        vod_remarks: desc,
      });
    }
  });

  const hasNext = html.includes('paging-item-a') && html.includes('下一页');

  return {
    page,
    pagecount: hasNext ? page + 1 : page,
    limit: LIMIT,
    total: hasNext ? 9999 : videos.length,
    list: videos,
  };
}

async function detail(reqIn) {
  const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
  const list = [];

  for (const vid of ids.filter(Boolean)) {
    const radioId = String(vid).replace(/\/$/, '').split('/').pop();
    const mUrl = `https://m.qtfm.cn/channels/${radioId}/`;
    const html = await fetchHtml(mUrl, true);

    let title = '';
    let pic = '';
    let desc = '';

    if (html) {
      const scriptMatch = html.match(/window\.__initStores=({.*?});?<\/script>/s);
      if (scriptMatch) {
        try {
          const data = JSON.parse(scriptMatch[1]);
          const basic = data?.ChannelStore?.basicInfo || {};
          title = basic.name || '';
          pic = basic.cover || '';
          desc = basic.desc || '';
        } catch (e) {
          console.warn(`[${KEY}] JSON解析失败:`, e?.message || e);
        }
      }

      if (!title) {
        const nameMatch = html.match(/"name":"([^"]+)"/);
        title = nameMatch ? nameMatch[1] : '';
      }
      if (!pic) {
        const coverMatch = html.match(/"cover":"([^"]+)"/);
        pic = coverMatch ? coverMatch[1] : '';
      }
      if (!desc) {
        const descMatch = html.match(/"desc":"([^"]+)"/);
        desc = descMatch ? descMatch[1] : '';
      }
    }

    if (pic && pic.includes('!200')) {
      pic = pic.replace('!200', '');
    }

    const playUrl = `https://lhttp.qtfm.cn/live/${radioId}/64k.mp3`;

    list.push({
      vod_id: vid,
      vod_name: title || `电台-${radioId}`,
      vod_pic: pic,
      vod_content: desc,
      vod_play_from: '蜻蜓FM',
      vod_play_url: `${title || radioId}$${playUrl}`,
    });
  }

  return { list };
}

async function play(reqIn) {
  const id = String(reqIn?.body?.id || '').trim();
  // 修复：补充 jx: 0，避免播放器尝试解析直链，减少无效 CPU 开销
  return {
    parse: 0,
    jx: 0,
    playUrl: '',
    url: id,
    header: {
      'User-Agent': UA,
      Referer: 'https://www.qtfm.cn/',
    },
  };
}

async function search(reqIn) {
  const body = reqIn?.body || {};
  const page = pageOf(body.page);
  const wd = String(body.wd || '').trim();
  if (!wd) {
    return { page, pagecount: page, limit: LIMIT, total: 0, list: [] };
  }

  const url = `${HOST}/search/${encodeURIComponent(wd)}/`;
  const html = await fetchHtml(url);
  const videos = [];

  const regex = /<a class="link" href="(\/radios\/\d+)"[^>]*>[\s\S]*?<img[^>]*src="(\/\/[^"]+)"[^>]*>[\s\S]*?<div[^>]*class="itemTitle[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const pic = match[2];
    const title = match[3].replace(/<[^>]+>/g, '').trim();

    if (href && title) {
      videos.push({
        vod_id: absUrl(href),
        vod_name: title,
        vod_pic: absUrl(pic),
        vod_remarks: '搜索',
      });
    }
  }

  return { page, pagecount: page, limit: LIMIT, total: videos.length, list: videos };
}

export default function createSpider() {
  return {
    meta: { key: KEY, name: NAME, type: 3 },
    api: async (fastify) => {
      fastify.post('/init', init);
      fastify.post('/home', home);
      fastify.post('/category', category);
      fastify.post('/detail', detail);
      fastify.post('/play', play);
      fastify.post('/search', search);
    },
  };
}
