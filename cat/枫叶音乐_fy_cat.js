// coding=utf-8

/**
 * 枫叶音乐TVBox爬虫（枫叶API歌词版）
 * 作者 丢丢喵 🚓 内容均从互联网收集而来 仅供交流学习使用 版权归原创者所有 如侵犯了您的权益 请通知作者 将及时删除侵权内容
 * ====================Diudiumiao====================
 */

import req from '../../util/req.js';
import { URL } from 'url';

const KEY = 'fengye_music';
const NAME = '枫叶音乐';
const BASE_URL = 'https://fy-musicbox-api.mu-jie.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0';

const HEADERS = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua': '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    'sec-ch-ua-mobile': '?0',
    'Origin': 'https://mu-jie.cc',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://mu-jie.cc/',
};

/**
 * 工具函数：获取请求体
 */
function bodyOf(req) {
    return req?.body || {};
}

/**
 * 工具函数：获取页码
 */
function pageOf(value) {
    const page = Number.parseInt(value, 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

/**
 * 工具函数：从URL或ID中提取歌曲ID
 */
function extractSongId(urlOrId) {
    if (!urlOrId) return null;
    const str = String(urlOrId);
    
    // 如果全是数字，直接返回
    if (/^\d+$/.test(str)) return str;
    
    const patterns = [
        /[?&]id=(\d+)/,
        /\/song\/(\d+)/,
        /\/playlist\/(\d+)/,
        /\/track\/(\d+)/,
        /\/(\d+)\.mp3/,
        /\/(\d+)\.m4a/,
        /\/(\d+)\.flac/,
        /\/(\d+)$/,
    ];
    
    for (const pattern of patterns) {
        const match = str.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

/**
 * 工具函数：构建绝对URL
 */
function absUrl(url, base = BASE_URL) {
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

/**
 * 工具函数：判断是否为音频文件URL
 */
function isAudioUrl(url) {
    if (!url) return false;
    const exts = ['.mp3', '.m4a', '.flac', '.wav', '.aac', '.ogg', '.wma'];
    const lower = String(url).toLowerCase();
    return exts.some(ext => lower.endsWith(ext));
}

// ==================== 请求函数 ====================

async function fetchData(url, options = {}) {
    try {
        const response = await req.get(url, {
            headers: { ...HEADERS, ...(options.headers || {}) },
            timeout: options.timeout || 10000,
            responseType: options.responseType || 'json',
        });
        return response.data;
    } catch (error) {
        console.error(`[枫叶音乐-请求] 错误: ${error.message}`);
        throw error;
    }
}

async function fetchCategoryData() {
    const url = `${BASE_URL}/getPlaylistCategory`;
    const data = await fetchData(url);
    if (Array.isArray(data) && data.length > 0) {
        return data[0]?.category || [];
    }
    if (typeof data === 'object' && data !== null) {
        return data.category || data.data || [];
    }
    return [];
}

async function fetchPlaylistTracksData(playlistId) {
    const url = `${BASE_URL}/meting/?server=netease&type=playlist&id=${playlistId}`;
    return await fetchData(url);
}

async function fetchCategoryPlaylistsData(cid) {
    const url = `${BASE_URL}/netease/playlist/category?type=${cid}&limit=60`;
    return await fetchData(url);
}

async function fetchSearchData(key, page) {
    const url = `${BASE_URL}/netease/search/song/?keywords=${encodeURIComponent(key)}&pn=${page}&limit=20`;
    return await fetchData(url);
}

async function fetchLyricData(songId) {
    const url = `${BASE_URL}/meting/?server=netease&type=lrc&id=${songId}`;
    try {
        const response = await req.get(url, {
            headers: HEADERS,
            timeout: 10000,
            responseType: 'text',
        });
        const lyric = typeof response.data === 'string' ? response.data : String(response.data || '');
        if (lyric && lyric.trim().length > 0) {
            console.log(`[枫叶音乐-歌词] 获取成功, ${lyric.length} 字符`);
            return lyric;
        }
        console.log('[枫叶音乐-歌词] 歌词内容为空');
        return null;
    } catch (error) {
        console.error(`[枫叶音乐-歌词] 请求异常: ${error.message}`);
        return null;
    }
}

async function getLyricFromFengye(songUrl) {
    if (!songUrl) return null;
    const songId = extractSongId(songUrl);
    if (!songId) {
        console.log(`[枫叶音乐-歌词] 无法提取歌曲ID: ${songUrl}`);
        return null;
    }
    console.log(`[枫叶音乐-歌词] 请求歌词, 歌曲ID: ${songId}`);
    return await fetchLyricData(songId);
}

async function getPlaybackUrl(url) {
    if (!url) return '';
    if (isAudioUrl(url)) return url;
    
    try {
        const response = await req.get(url, {
            headers: HEADERS,
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        // 检查重定向
        if (response.status >= 301 && response.status <= 308) {
            const location = response.headers?.location || response.headers?.Location;
            if (location) {
                return absUrl(location, url);
            }
        }
        return url;
    } catch (error) {
        console.error(`[枫叶音乐-解析] 获取播放地址异常: ${error.message}`);
        return url;
    }
}

// ==================== 数据处理函数 ====================

function processCategories(data) {
    if (!Array.isArray(data)) return [];
    const result = [];
    for (const item of data) {
        if (typeof item !== 'object' || item === null) continue;
        const subList = item.sub || [];
        if (!Array.isArray(subList)) continue;
        for (const sub of subList) {
            if (typeof sub === 'object' && sub !== null && sub.name) {
                result.push({
                    type_id: sub.name,
                    type_name: sub.name,
                });
            }
        }
    }
    return result;
}

function processMusicItem(item) {
    if (typeof item !== 'object' || item === null) return {};
    const name = item.name || '未知歌曲';
    const songUrl = item.url || '';
    const pic = item.pic || '';
    const remark = item.artist || '未知艺术家';
    const songId = item.id || '';
    
    return {
        vod_id: songUrl,
        vod_name: name,
        vod_pic: pic,
        vod_remarks: remark,
        song_id: songId,
    };
}

function processPlaylistTracks(data) {
    const tracks = Array.isArray(data) ? data : (data?.tracks || []);
    if (!Array.isArray(tracks)) return [];
    const result = [];
    for (const item of tracks) {
        const video = processMusicItem(item);
        if (video.vod_id) {
            result.push(video);
        }
    }
    return result;
}

function processCategoryPlaylists(data) {
    if (!Array.isArray(data)) return [];
    const result = [];
    for (const item of data) {
        if (typeof item !== 'object' || item === null) continue;
        const name = item.name || '未知歌单';
        const pid = item.id || '';
        const pic = item.coverImgUrl || '';
        const remark = item.playCount || 0;
        result.push({
            vod_id: `${pid}@`,
            vod_name: name,
            vod_pic: pic,
            vod_tag: 'folder',
            vod_remarks: `${remark} 播放量`,
        });
    }
    return result;
}

function processMusicItems(data) {
    let items = data;
    if (typeof data === 'object' && data !== null) {
        items = data.tracks || data.results || data.data || data.songs || [];
    }
    if (!Array.isArray(items)) return [];
    const result = [];
    for (const item of items) {
        const video = processMusicItem(item);
        if (video.vod_id) {
            result.push(video);
        }
    }
    return result;
}

// ==================== 路由处理函数 ====================

async function init() {
    return {};
}

async function home() {
    const result = { class: [] };
    try {
        const data = await fetchCategoryData();
        result.class = processCategories(data);
    } catch (error) {
        console.error(`[枫叶音乐-首页] 错误: ${error.message}`);
    }
    return result;
}

async function category(req) {
    const body = bodyOf(req);
    const cid = body.id || body.cid || '';
    const pg = pageOf(body.page || body.pg);
    let videos = [];
    
    try {
        if (!cid) {
            return pageResult(videos, pg);
        }
        
        if (cid.includes('@')) {
            const playlistId = cid.split('@')[0];
            const data = await fetchPlaylistTracksData(playlistId);
            videos = processPlaylistTracks(data);
        } else {
            const data = await fetchCategoryPlaylistsData(cid);
            videos = processCategoryPlaylists(data);
        }
    } catch (error) {
        console.error(`[枫叶音乐-分类] 错误 (cid=${cid}): ${error.message}`);
    }
    
    return pageResult(videos, pg);
}

async function detail(req) {
    const body = bodyOf(req);
    const ids = Array.isArray(body.id) ? body.id : [body.id];
    const list = [];
    
    try {
        for (const did of ids) {
            if (!did) continue;
            const songId = extractSongId(did);
            list.push({
                vod_id: did,
                vod_play_from: '音乐专线',
                vod_play_url: `播放$${did}`,
                song_id: songId,
            });
        }
    } catch (error) {
        console.error(`[枫叶音乐-详情] 错误: ${error.message}`);
    }
    
    return { list };
}

async function play(req) {
    const body = bodyOf(req);
    const id = body.id || '';
    
    try {
        if (!id) {
            return { parse: 0, playUrl: '', url: '', header: HEADERS };
        }
        
        // 获取播放地址
        const url = await getPlaybackUrl(id);
        
        // 获取歌词
        const lyric = await getLyricFromFengye(id);
        
        const result = {
            parse: 0,
            playUrl: '',
            url: url,
            header: HEADERS,
        };
        
        // 如果获取到歌词，添加到响应中
        if (lyric) {
            result.lyric = lyric;
            result.content = lyric;
            result.lrc = lyric;
            result.subtitle = lyric;
            result.hasLyric = true;
            console.log('[枫叶音乐-播放] 歌词已添加到播放响应');
        } else {
            result.hasLyric = false;
            console.log('[枫叶音乐-播放] 未获取到歌词');
        }
        
        return result;
    } catch (error) {
        console.error(`[枫叶音乐-播放] 错误: ${error.message}`);
        return { parse: 0, playUrl: '', url: id || '', header: HEADERS };
    }
}

async function search(req) {
    const body = bodyOf(req);
    const key = body.wd || body.key || '';
    const pg = pageOf(body.page || body.pg);
    
    try {
        if (!key) {
            return searchResult([], pg);
        }
        
        const data = await fetchSearchData(key, pg);
        const videos = processMusicItems(data);
        return searchResult(videos, pg);
    } catch (error) {
        console.error(`[枫叶音乐-搜索] 错误 (key=${key}): ${error.message}`);
        return { list: [], page: pg, pagecount: 1, limit: 20, total: 0 };
    }
}

// ==================== 结果构建函数 ====================

function pageResult(list, page) {
    return {
        list: list,
        page: page,
        pagecount: 1,
        limit: 90,
        total: 999999,
    };
}

function searchResult(list, page) {
    return {
        list: list,
        page: page,
        pagecount: 9999,
        limit: 90,
        total: 999999,
    };
}

// ==================== 导出 ====================

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
            fastify.post('/category', category);
            fastify.post('/detail', detail);
            fastify.post('/play', play);
            fastify.post('/search', search);
        },
        check: async () => true,
    };
}