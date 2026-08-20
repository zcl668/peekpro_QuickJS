import req from '../../util/req.js';
import { jsoup } from '../../util/htmlParser.js';
import { URL } from 'url';
import crypto from 'crypto';

const KEY = 'xp_paradise';
const NAME = 'XP天堂18+';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SITES = [
    'https://dzsx5k01kgm6y.cloudfront.net',
    'https://attack.bjidvlyog.com',
    'https://agency.bjidvlyog.com/'
];
const BASE_URL = SITES[0];
const REFERER = 'https://dzsx5k01kgm6y.cloudfront.net';

let cachedClasses = [];
let cachedFilters = {};
let hasParsed = false;

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

function fixVodName(name) {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length > 2) {
        return parts.slice(1, -1).join('');
    }
    return name.trim();
}

function log() {
    console.log('[xp天堂18+]', ...arguments);
}

function requestOrigin(request) {
    const proto = String(request?.headers?.['x-forwarded-proto'] || request?.protocol || 'http')
        .split(',')[0]
        .trim() || 'http';
    const host = String(request?.headers?.['x-forwarded-host'] || request?.headers?.host || '')
        .split(',')[0]
        .trim();
    return host ? proto + '://' + host : '';
}

function routePrefix(request) {
    if (request?.server && typeof request.server.prefix === 'string') {
        return request.server.prefix.replace(/\/+$/, '');
    }
    return '/spider/' + KEY + '/3';
}

function buildImageProxyUrl(request, imgUrl) {
    if (!imgUrl) return '';
    const origin = requestOrigin(request);
    if (!origin) return imgUrl;
    return origin + routePrefix(request) + '/proxy/image?url=' + encodeURIComponent(imgUrl);
}

function aesDecryptNoPadding(encryptedBase64, key, iv) {
    try {
        const encrypted = Buffer.from(encryptedBase64, 'base64');
        const keyBuffer = Buffer.from(key, 'utf8');
        const ivBuffer = Buffer.from(iv, 'utf8');
        const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, ivBuffer);
        decipher.setAutoPadding(false);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('base64');
    } catch (e) {
        log('AES解密失败:', e?.message);
        return '';
    }
}

async function parseCategories(html) {
    const $ = new jsoup().pq(html);
    const classes = [];
    const filters = {};
    const sortFilter = [
        {
            key: 'sort',
            name: '排序',
            value: [
                { n: '最近更新', v: 'update' },
                { n: '最高收藏', v: 'favorite' },
                { n: '近期最佳', v: 'hot' },
                { n: '最多观看', v: 'watch' }
            ]
        }
    ];

    $('.app-nav .container').each(function(_, container) {
        const blockTitle = $(container).find('.title-box h2').text().trim();

        if (blockTitle.includes('选片') || blockTitle.includes('主题')) {
            $(container).find('a.tjtagmanager').each(function(_, el) {
                const name = $(el).text().trim();
                let href = $(el).attr('href') || '';
                href = href.replace(/\/(favorite|update|hot|watch)\/?$/, '');
                if (href && name) {
                    classes.push({ type_id: href, type_name: name });
                    filters[href] = sortFilter;
                }
            });
        }

        if ($(container).find('a.tag').length > 0) {
            $(container).find('a.tag').each(function(_, el) {
                const name = $(el).text().trim();
                let href = $(el).attr('href') || '';
                href = href.replace(/\/(favorite|update|hot|watch)\/?$/, '');
                if (href && name) {
                    classes.push({ type_id: href, type_name: '🏷️ ' + name });
                    filters[href] = sortFilter;
                }
            });
        }
    });

    const filtered = classes.filter(function(item) {
        return !item.type_name.includes('资讯') && !item.type_name.includes('回家');
    });

    return { classes: filtered, filters: filters };
}

async function parseList(html, reqIn) {
    const $ = new jsoup().pq(html);
    const items = [];
    const videoElements = $('.col-6.col-sm-4.col-lg-3, .video-img-box').toArray();

    for (const el of videoElements) {
        const $el = $(el);
        const link = $el.find('.video-img-box a, .img-box > a').first();
        const href = link.attr('href') || '';

        if (!href || !href.includes('/videos/')) continue;

        const vodId = href;
        let vodName = $el.find('.title a, .img-box img').attr('alt') ||
                      $el.find('.title a').text().trim() ||
                      $el.find('h3.title a.text').text().trim();
        vodName = fixVodName(vodName);

        let vodPic = $el.find('img.zximg').attr('z-image-loader-url') || '';
        if (vodPic && reqIn) {
            vodPic = buildImageProxyUrl(reqIn, vodPic);
        }

        const watchCount = $el.find('span[class^="interaction_watch_count_"]').text().trim();
        const vodRemarks = watchCount ? watchCount + '播放' : '';
        const vodYear = $el.find('.label').text().trim();

        items.push({
            vod_id: vodId,
            vod_name: vodName || '未知标题',
            vod_pic: vodPic || '',
            vod_year: vodYear,
            vod_remarks: vodRemarks,
            land: 1,
            ratio: 1.78
        });
    }

    return items;
}

function parsePagination(html) {
    const $ = new jsoup().pq(html);
    const pager = $('ul.dx-pager');
    const total = parseInt(pager.attr('data-rec-total') || '0');
    const perPage = parseInt(pager.attr('data-rec-per-page') || '24');
    const pagecount = total > 0 && perPage > 0 ? Math.ceil(total / perPage) : 1;
    return { total: total, perPage: perPage, pagecount: pagecount };
}

async function init() {
    return {};
}

async function home() {
    try {
        if (hasParsed && cachedClasses.length > 0) {
            return { class: cachedClasses, filters: cachedFilters, list: [] };
        }

        const res = await req.get(BASE_URL, {
            headers: { 'User-Agent': UA },
            timeout: 15000,
            responseType: 'text',
            validateStatus: function() { return true; }
        });
        const html = res?.data || '';

        if (!html) return { class: [], filters: {}, list: [] };

        const result = await parseCategories(html);
        cachedClasses = result.classes;
        cachedFilters = result.filters;
        hasParsed = true;

        return { class: cachedClasses, filters: cachedFilters, list: [] };
    } catch (e) {
        log('home error:', e?.message);
        return { class: [], filters: {}, list: [] };
    }
}

async function homeVod(reqIn) {
    try {
        const res = await req.get(BASE_URL, {
            headers: { 'User-Agent': UA },
            timeout: 15000,
            responseType: 'text',
            validateStatus: function() { return true; }
        });
        const html = res?.data || '';

        if (!html) return { list: [] };

        const list = await parseList(html, reqIn);
        return { list: list.slice(0, 30) };
    } catch (e) {
        log('homeVod error:', e?.message);
        return { list: [] };
    }
}

async function category(reqIn) {
    try {
        const body = bodyOf(reqIn);
        const tid = String(body.id || body.tid || '');
        const page = pageOf(body.page || body.pg);
        const ext = extendOf(reqIn);

        if (!tid) return { list: [], page: page, pagecount: 1 };

        const sort = ext.sort || '';
        const url = BASE_URL + tid + '/' + sort + '/' + page + '/';

        const res = await req.get(url, {
            headers: { 'User-Agent': UA, 'Referer': BASE_URL + '/' },
            timeout: 15000,
            responseType: 'text',
            validateStatus: function() { return true; }
        });
        const html = res?.data || '';

        if (!html) return { list: [], page: page, pagecount: 1 };

        const list = await parseList(html, reqIn);
        const pagination = parsePagination(html);

        return { list: list, page: page, pagecount: pagination.pagecount || 1, limit: 24, total: list.length };
    } catch (e) {
        log('category error:', e?.message);
        const page = pageOf(reqIn?.body?.page || reqIn?.body?.pg);
        return { list: [], page: page, pagecount: 1 };
    }
}

async function detail(reqIn) {
    try {
        const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
        const result = [];

        for (const rawId of ids.filter(Boolean)) {
            const vid = String(rawId).trim();
            const url = BASE_URL + vid;

            const res = await req.get(url, {
                headers: { 'User-Agent': UA, 'Referer': BASE_URL + '/' },
                timeout: 15000,
                responseType: 'text',
                validateStatus: function() { return true; }
            });
            const html = res?.data || '';

            if (!html) {
                result.push({
                    vod_id: vid,
                    vod_name: '加载失败',
                    vod_content: '无法获取详情',
                    vod_play_from: 'XP天堂',
                    vod_play_url: ''
                });
                continue;
            }

            const $ = new jsoup().pq(html);
            let vodName = $('h1.my-foldable-content').text().trim() || $('h1').text().trim() || '未知标题';
            
            let vodPic = $('#player').attr('data-src') || '';
            if (vodPic) {
                vodPic = buildImageProxyUrl(reqIn, vodPic);
            }

            const tags = [];
            $('h5.tags a, .tags a').each(function(_, el) {
                const tag = $(el).text().trim();
                if (tag) tags.push(tag);
            });
            const vodActor = tags.join('/');
            const vodClass = tags.join(' ');

            let vodContent = '标签快捷搜索：\n';
            for (const tag of tags) {
                vodContent += '[a=cr:{"action":"category","key":"' + tag + '"}/]【' + tag + '】[/a]   ';
            }
            if (!vodContent.trim()) {
                vodContent = '暂无简介';
            }

            const m3u8Regex = /https?:\/\/[^\s"'`]+\.m3u8(?:\?[^\s"'`]+)?/g;
            const matches = html.match(m3u8Regex);
            const hlsUrl = matches ? matches[0] : '';
            const vodPlayFrom = 'hls线路';
            const vodPlayUrl = hlsUrl ? '正片$' + hlsUrl : '';

            const watchCount = $('.video-info span[class^="interaction_watch_count_"]').text().trim();
            const favoriteCount = $('#bind_collect_count').text().trim();
            let vodRemarks = watchCount ? watchCount + '播放' : '';
            if (favoriteCount) {
                vodRemarks += vodRemarks ? ' | ' + favoriteCount + '收藏' : favoriteCount + '收藏';
            }

            result.push({
                vod_id: vid,
                vod_name: vodName,
                vod_pic: vodPic || '',
                vod_content: vodContent,
                vod_actor: vodActor,
                vod_class: vodClass,
                vod_remarks: vodRemarks || '未知',
                vod_play_from: vodPlayFrom,
                vod_play_url: vodPlayUrl
            });
        }
        return { list: result };
    } catch (e) {
        log('detail error:', e?.message);
        return { list: [] };
    }
}

async function play(reqIn) {
    const body = bodyOf(reqIn);
    const id = String(body.id || '').trim();

    return {
        parse: 0,
        url: id,
        header: {
            'User-Agent': UA,
            'Referer': BASE_URL + '/'
        }
    };
}

async function search(reqIn) {
    try {
        const body = bodyOf(reqIn);
        const key = String(body.wd || '').trim();
        const page = pageOf(body.page || body.pg);

        if (!key) return { list: [], page: page, pagecount: 1 };

        const encodedKey = encodeURIComponent(key);
        const url = BASE_URL + '/search/' + encodedKey + '/' + page + '/';

        const res = await req.get(url, {
            headers: { 'User-Agent': UA, 'Referer': BASE_URL + '/' },
            timeout: 15000,
            responseType: 'text',
            validateStatus: function() { return true; }
        });
        const html = res?.data || '';

        if (!html) return { list: [], page: page, pagecount: 1 };

        const list = await parseList(html, reqIn);
        const pagination = parsePagination(html);

        return { list: list, page: page, pagecount: pagination.pagecount || 1, limit: 24, total: list.length };
    } catch (e) {
        log('search error:', e?.message);
        const page = pageOf(reqIn?.body?.page || reqIn?.body?.pg);
        return { list: [], page: page, pagecount: 1 };
    }
}

async function imageProxy(request, reply) {
    const imgUrl = String(request?.query?.url || '').trim();
    
    if (!imgUrl) {
        return reply.code(400).send('Invalid url');
    }

    try {
        const res = await req.get(imgUrl, {
            headers: {
                'User-Agent': UA,
                'Referer': REFERER,
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
            },
            timeout: 10000,
            responseType: 'arraybuffer',
            validateStatus: function() { return true; }
        });

        if (res.status !== 200) {
            log('图片请求失败: ' + imgUrl + ', status: ' + res.status);
            return reply.code(502).send('Fetch image failed');
        }

        const encryptedBuffer = Buffer.from(res.data);
        const encryptedBase64 = encryptedBuffer.toString('base64');
        
        if (!encryptedBase64) {
            return reply.code(500).send('Empty response');
        }

        const realImageBase64 = aesDecryptNoPadding(
            encryptedBase64,
            'f5d965df75336270',
            '97b60394abc2fbe1'
        );
        
        if (!realImageBase64) {
            log('解密失败，加密数据长度: ' + encryptedBase64.length);
            return reply.code(500).send('Decrypt failed');
        }

        let ext = 'jpeg';
        const lowerUrl = imgUrl.toLowerCase();
        if (lowerUrl.includes('.gif')) ext = 'gif';
        else if (lowerUrl.includes('.png')) ext = 'png';
        else if (lowerUrl.includes('.webp')) ext = 'webp';

        const buffer = Buffer.from(realImageBase64, 'base64');

        reply.header('Content-Type', 'image/' + ext);
        reply.header('Cache-Control', 'public, max-age=86400');
        reply.header('Access-Control-Allow-Origin', '*');
        return reply.send(buffer);

    } catch (error) {
        log('image proxy error:', error?.message);
        return reply.code(500).send('Proxy error: ' + error.message);
    }
}

export default function createSpider(name, config) {
    return {
        meta: {
            key: KEY,
            name: NAME,
            type: 3
        },
        api: async function(fastify) {
            fastify.post('/init', init);
            fastify.post('/home', home);
            fastify.post('/homeVod', homeVod);
            fastify.post('/category', category);
            fastify.post('/detail', detail);
            fastify.post('/play', play);
            fastify.post('/search', search);
            fastify.get('/proxy/image', imageProxy);
        },
        check: async function() {
            try {
                const res = await req.get(BASE_URL, {
                    headers: { 'User-Agent': UA },
                    timeout: 10000,
                    validateStatus: function() { return true; }
                });
                return res && res.status === 200;
            } catch {
                return false;
            }
        }
    };
}