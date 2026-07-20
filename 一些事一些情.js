import req from '../../util/req.js';
import { jsoup } from '../../util/htmlParser.js';
import { fixUrl, stripHtmlTag, IOS_UA } from '../../util/misc.js';
import { URL } from 'url';

const KEY = 'loveq_vod';
const NAME = '木凡的天空';
const HOST = 'https://www.loveq.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const defaultPic = 'https://d.kstore.dev/download/15565/loveq2026.jpg';
const dexianPic = 'https://d.kstore.dev/download/15565/loveq2026.jpg';

// ========== 只保留这些分类 ==========
const allowedCategories = {
    '1': '粤语节目',
    '4': '得闲小叙',
    '5': '每周一车',
    '35': 'Hugo的Story Time',
    '3': '节目精华',
    '38': '节目版头',
    '2': '国语节目'
};

// 播放请求头
const playHeaders = {
    'User-Agent': UA,
    'Referer': HOST + '/',
    'Origin': HOST,
    'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Range': 'bytes=0-',
    'Connection': 'keep-alive'
};

function pq(html) {
    return new jsoup().pq(html);
}

function abs(url, base = HOST) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return 'https:' + raw;
    if (raw.startsWith('/')) return HOST + raw;
    if (raw.includes('dl2.loveq.cn')) return 'https://' + raw;
    return new URL(raw, base).toString();
}

function stripTags(str) {
    return String(str || '').replace(/<[^>]+>/g, '').trim();
}

function bodyOf(req) {
    return req?.body || {};
}

function pageOf(value) {
    const page = Number.parseInt(value, 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function extendOf(req) {
    const body = bodyOf(req);
    return body.filters || body.extend || body.ext || body.filter || {};
}

async function getHtml(url) {
    const res = await req.get(url, {
        headers: { 'User-Agent': UA, 'Referer': HOST + '/' },
        timeout: 15000,
        responseType: 'text',
        validateStatus: () => true
    });
    return typeof res.data === 'string' ? res.data : String(res.data || '');
}

// ========== 解析分类 ==========
function parseCategories(html) {
    const $ = pq(html);
    const categories = [];
    const seen = new Set();

    $('a[href*="program-cat"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const catMatch = href.match(/program-cat(\d+)-p\d+\.html/);
        if (catMatch) {
            const catId = catMatch[1];
            if (catId !== '0' && allowedCategories.hasOwnProperty(catId) && !seen.has(catId)) {
                seen.add(catId);
                categories.push({
                    type_id: catId,
                    type_name: allowedCategories[catId]
                });
            }
        }
    });

    categories.sort((a, b) => parseInt(a.type_id) - parseInt(b.type_id));
    return categories;
}

// ========== 解析列表 ==========
function parseList(html, filterText = '') {
    const $ = pq(html);
    const items = [];
    const seenIds = new Set();
    const filterLower = filterText.toLowerCase().trim();

    $('a[href*="program_download"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = stripTags($(el).text() || '');
        const img = $(el).find('img').first();
        const imgSrc = img.attr('src') || img.attr('data-src') || '';

        if (!title || title.length < 2) return;

        const vidMatch = href.match(/program_download-?(\d+)\.html/);
        if (!vidMatch) return;

        const vid = vidMatch[1];
        if (seenIds.has(vid)) return;
        seenIds.add(vid);

        // 筛选过滤
        if (filterLower && !title.toLowerCase().includes(filterLower)) return;

        // 提取日期
        let remarks = '';
        const parent = $(el).closest('li');
        if (parent.length) {
            const dateSpan = parent.find('span[class*="date"]');
            if (dateSpan.length) {
                remarks = dateSpan.text().trim();
            }
        }

        items.push({
            vod_id: vid,
            vod_name: title,
            vod_pic: abs(imgSrc) || defaultPic,
            vod_remarks: remarks
        });
    });

    return items;
}

// ========== 解析分页 ==========
function parsePageCount(html, currentPg) {
    let max = currentPg + 1;
    const $ = pq(html);

    // 从分页链接中提取
    $('.page a, .pagination a, .pager a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const pageMatch = href.match(/[?&]page=(\d+)/);
        if (pageMatch) {
            const pgNum = parseInt(pageMatch[1]);
            if (pgNum > max) max = pgNum;
        }
    });

    // 从文本中提取
    const text = $('body').text();
    const textMatch = text.match(/共(\d+)页/);
    if (textMatch) {
        const totalPages = parseInt(textMatch[1]);
        if (totalPages > max) max = totalPages;
    }

    return max;
}

// ========== 提取音频链接 ==========
function extractAudioLinks(html, baseUrl = '') {
    const links = [];
    const seen = new Set();

    // 多种正则匹配
    const patterns = [
        /https?:\/\/dl2\.loveq\.cn:8090\/live\/program\/[\d/]+[\w.]+\.(?:mp3|MP3|m4a|M4A)\?sign=[a-f0-9]+&timestamp=\d+/gi,
        /\/\/dl2\.loveq\.cn:8090\/live\/program\/[\d/]+[\w.]+\.(?:mp3|MP3|m4a|M4A)\?sign=[a-f0-9]+&timestamp=\d+/gi,
        /dl2\.loveq\.cn:8090\/live\/program\/[\d/]+[\w.]+\.(?:mp3|MP3|m4a|M4A)\?sign=[a-f0-9]+&timestamp=\d+/gi,
        /["'](https?:\/\/dl2\.loveq\.cn:8090\/live\/program\/[\d/]+[\w.]+\.(?:mp3|MP3|m4a|M4A)\?sign=[a-f0-9]+&timestamp=\d+)["']/gi,
        /(?:https?:)?\/\/dl2\.loveq\.cn:8090\/live\/program\/[^\s"'<>]+\.(?:mp3|MP3|m4a|M4A)[^\s"'<>]*/gi
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            let link = match[0] || match[1] || '';
            if (!link) continue;
            if (link.startsWith('//')) link = 'https:' + link;
            if (!link.startsWith('http')) link = 'https://' + link;
            if (!seen.has(link) && link.includes('dl2.loveq.cn') && link.includes('sign=') && link.includes('timestamp=')) {
                seen.add(link);
                links.push(link);
            }
        }
    }

    // 从 audio/source 标签提取
    const $ = pq(html);
    $('audio[src], source[src]').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (src && src.includes('dl2.loveq.cn') && /\.(mp3|m4a)/i.test(src) && src.includes('sign=')) {
            const fixed = abs(src, baseUrl);
            if (!seen.has(fixed)) {
                seen.add(fixed);
                links.push(fixed);
            }
        }
    });

    return links;
}

// ========== 接口实现 ==========

async function init() {
    return {};
}

async function home() {
    try {
        const html = await getHtml(HOST + '/program.html');
        const categories = parseCategories(html);

        // 生成年份和月份筛选器
        const currentYear = new Date().getFullYear();
        const years = [{ n: '全部年份', v: '' }];
        for (let y = currentYear; y > 2002; y--) {
            years.push({ n: String(y), v: String(y) });
        }

        const months = [{ n: '全部月份', v: '' }];
        for (let m = 1; m <= 12; m++) {
            months.push({ n: m + '月', v: String(m) });
        }

        const filters = {};
        categories.forEach(cat => {
            filters[cat.type_id] = [
                { key: 'year', name: '年份', value: years },
                { key: 'month', name: '月份', value: months }
            ];
        });

        const list = parseList(html);

        return {
            class: categories,
            filters: filters,
            list: list.slice(0, 30)
        };
    } catch (e) {
        console.warn('[loveq] home error:', e?.message || e);
        return { class: [], filters: {}, list: [] };
    }
}

async function homeVod() {
    try {
        const html = await getHtml(HOST + '/program.html');
        const list = parseList(html);
        return { list: list.slice(0, 30) };
    } catch (e) {
        console.warn('[loveq] homeVod error:', e?.message || e);
        return { list: [] };
    }
}

async function category(reqIn) {
    try {
        const body = bodyOf(reqIn);
        const tid = String(body.id || body.tid || '1');
        const page = pageOf(body.page || body.pg);
        const ext = extendOf(reqIn);

        let url = HOST + '/program.html';
        const params = [];
        params.push(`cat_id=${tid}`);
        params.push(`page=${page}`);

        if (ext.year && ext.year !== '') {
            params.push(`year=${ext.year}`);
        }
        if (ext.month && ext.month !== '') {
            params.push(`month=${ext.month}`);
        }

        url = url + '?' + params.join('&');

        const html = await getHtml(url);
        const list = parseList(html);
        const pagecount = parsePageCount(html, page);

        return {
            page: page,
            pagecount: pagecount,
            limit: 30,
            total: list.length,
            list: list
        };
    } catch (e) {
        console.warn('[loveq] category error:', e?.message || e);
        const page = pageOf(reqIn?.body?.page || reqIn?.body?.pg);
        return { page: page, pagecount: page, limit: 30, total: 0, list: [] };
    }
}

async function detail(reqIn) {
    try {
        const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
        const result = [];

        for (const rawId of ids.filter(Boolean)) {
            const vid = String(rawId).trim();
            const url = HOST + `/program_download-${vid}.html`;
            const html = await getHtml(url);

            if (!html) {
                result.push({
                    vod_id: vid,
                    vod_name: `节目${vid}`,
                    vod_pic: defaultPic,
                    vod_content: '暂无节目简介',
                    vod_play_from: '木凡的天空',
                    vod_play_url: '暂无音频'
                });
                continue;
            }

            const $ = pq(html);

            // 标题
            let originalTitle = $('title').text().replace(/[-|]\s*LoveQ.*$/, '').trim() || `节目${vid}`;

            // 提取发布日期和内容
            let pubDate = '';
            let content = '';

            // 从 pdl1 类中提取
            $('ul[class*="pdl1"] li').each((_, el) => {
                const text = stripTags($(el).text());
                if (text.includes('发布日期：') || text.includes('发布时间：')) {
                    const dateMatch = text.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
                    if (dateMatch) {
                        pubDate = dateMatch[1];
                    } else {
                        pubDate = text.replace(/^(发布日期|发布时间)[：:]/, '').trim();
                    }
                } else if (text.includes('节目内容：') || text.includes('内容简介：')) {
                    content = text.replace(/^(节目内容|内容简介)[：:]/, '').trim();
                }
            });

            if (!content) {
                const metaDesc = $('meta[name="description"]').attr('content') || '';
                if (metaDesc) content = metaDesc;
            }

            if (!content) {
                const contentDiv = $('div[class*="content"], div[class*="intro"], div[class*="desc"]').first();
                if (contentDiv.length) {
                    content = stripTags(contentDiv.html() || '').slice(0, 500);
                }
            }

            if (!content || /^\d{4}[-/]\d{2}[-/]\d{2}\s*$/.test(content)) {
                content = '暂无节目简介';
            }

            // 构建标题
            let newTitle = originalTitle;
            if (pubDate) {
                const formattedDate = pubDate.replace(/\//g, '-');
                const contentPreview = content.length > 50 ? content.slice(0, 50) : content;
                newTitle = `${formattedDate} - ${contentPreview}`;
            }

            const desc = pubDate ? `📅 发布日期：${pubDate}\n📝 ${content}` : content;

            // 提取音频链接
            const audioLinks = extractAudioLinks(html, url);

            // 构建播放URL
            let playUrl = '暂无音频';
            if (audioLinks.length > 0) {
                if (audioLinks.length > 1) {
                    playUrl = audioLinks.map((link, i) => `LoveQ音频${i + 1}$${link}`).join('$$$');
                } else {
                    playUrl = `LoveQ音频$${audioLinks[0]}`;
                }
            }

            // 提取图片
            let vodPic = defaultPic;
            if (originalTitle.includes('得闲小叙') || originalTitle.includes('得闲')) {
                vodPic = dexianPic;
            } else {
                const imgMatch = $('img[class*="cover"], img[class*="poster"], img[class*="pic"], img[class*="lazy"]').first();
                if (imgMatch.length) {
                    const src = imgMatch.attr('src') || imgMatch.attr('data-src') || '';
                    if (src) vodPic = abs(src, url);
                }
            }

            result.push({
                vod_id: vid,
                vod_name: newTitle,
                vod_pic: vodPic,
                vod_content: desc,
                vod_play_from: '木凡的天空',
                vod_play_url: playUrl
            });
        }

        return { list: result };
    } catch (e) {
        console.warn('[loveq] detail error:', e?.message || e);
        return { list: [] };
    }
}

async function search(reqIn) {
    try {
        const body = bodyOf(reqIn);
        const wd = String(body.wd || '').trim();
        const page = pageOf(body.page || body.pg);

        if (!wd) {
            return { page: page, pagecount: page, limit: 30, total: 0, list: [] };
        }

        const encodedWd = encodeURIComponent(wd);
        const searchUrls = [
            HOST + `/so-${page}-${encodedWd}.html`,
            HOST + `/so.html?wd=${encodedWd}&page=${page}`,
            HOST + `/search.php?keyword=${encodedWd}&page=${page}`
        ];

        let html = '';
        for (const url of searchUrls) {
            try {
                const result = await getHtml(url);
                if (result) {
                    html = result;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!html) {
            return { page: page, pagecount: page, limit: 30, total: 0, list: [] };
        }

        const list = parseList(html, wd);
        return {
            page: page,
            pagecount: 1,
            limit: 30,
            total: list.length,
            list: list
        };
    } catch (e) {
        console.warn('[loveq] search error:', e?.message || e);
        const page = pageOf(reqIn?.body?.page || reqIn?.body?.pg);
        return { page: page, pagecount: page, limit: 30, total: 0, list: [] };
    }
}

async function play(reqIn) {
    try {
        const body = bodyOf(reqIn);
        let id = String(body.id || '').trim();

        let audioUrl = id;

        // 解析播放URL
        if (id && id.includes('$$$')) {
            const firstTrack = id.split('$$$')[0];
            if (firstTrack && firstTrack.includes('$')) {
                audioUrl = firstTrack.split('$')[1];
            } else {
                audioUrl = firstTrack;
            }
        } else if (id && id.includes('$')) {
            audioUrl = id.split('$')[1];
        }

        audioUrl = abs(audioUrl);

        if (!audioUrl || audioUrl === '暂无音频' || !audioUrl.startsWith('http')) {
            return {
                parse: 0,
                url: '',
                header: {},
                message: '未提取到有效的音频地址'
            };
        }

        return {
            parse: 0,
            url: audioUrl,
            header: playHeaders
        };
    } catch (e) {
        console.warn('[loveq] play error:', e?.message || e);
        return {
            parse: 0,
            url: reqIn?.body?.id || '',
            header: playHeaders
        };
    }
}

export default function createSpider() {
    return {
        meta: {
            key: KEY,
            name: NAME,
            type: 3
        },
        api: async (fastify) => {
            fastify.post('/init', init);
            fastify.post('/home', home);
            fastify.post('/homeVod', homeVod);
            fastify.post('/category', category);
            fastify.post('/detail', detail);
            fastify.post('/search', search);
            fastify.post('/play', play);
        },
        check: async () => {
            try {
                const html = await getHtml(HOST + '/program.html');
                return html && html.length > 100;
            } catch {
                return false;
            }
        }
    };
}