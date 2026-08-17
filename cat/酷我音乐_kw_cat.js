import req from '../../util/req.js';
import { jsoup } from '../../util/htmlParser.js';
import { fixUrl, stripHtmlTag, delay } from '../../util/misc.js';
import { URL } from 'url';

const KEY = 'kuwo_music';
const NAME = '小心儿悠悠';
const HOST = 'https://www.kuwo.cn';
const API_HOST = 'http://wapi.kuwo.cn';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ========== 工具函数 ==========

function bodyOf(req) {
    return req?.body || {};
}

function pageOf(value) {
    const page = Number.parseInt(value, 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

function abs(url, base = HOST) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('//')) return 'https:' + raw;
    if (raw.startsWith('/')) return HOST + raw;
    return new URL(raw, base).toString();
}

function stripTags(str) {
    return String(str || '').replace(/<[^>]+>/g, '').trim();
}

async function getJson(url, headers = {}) {
    const res = await req.get(url, {
        headers: { 'User-Agent': UA, ...headers },
        timeout: 10000,
        responseType: 'json',
        validateStatus: () => true
    });
    return res.data || {};
}

async function getText(url, headers = {}) {
    const res = await req.get(url, {
        headers: { 'User-Agent': UA, ...headers },
        timeout: 10000,
        responseType: 'text',
        validateStatus: () => true
    });
    return typeof res.data === 'string' ? res.data : String(res.data || '');
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// ========== 歌词功能 ==========

/**
 * 获取歌曲歌词
 * @param {string} rid - 歌曲ID
 * @returns {Promise<string|null>} 返回LRC格式歌词或null
 */
async function getLyric(rid) {
    if (!rid) return null;
    
    try {
        const url = `https://kuwo.cn/openapi/v1/www/lyric/getlyric?musicId=${rid}`;
        const data = await getJson(url, { 'Referer': HOST + '/' });
        
        if (data.data && data.data.lrclist) {
            const lines = [];
            for (const item of data.data.lrclist) {
                const time = formatTime(parseFloat(item.time || 0));
                lines.push(`[${time}]${item.lineLyric || ''}`);
            }
            return lines.join('\n');
        }
        return null;
    } catch (e) {
        console.warn('[kuwo] getLyric error:', e?.message || e);
        return null;
    }
}

/**
 * 解析LRC歌词为时间戳数组
 * @param {string} lrcText - LRC歌词文本
 * @returns {Array<{time: number, text: string}>} 解析后的歌词数组
 */
function parseLyric(lrcText) {
    if (!lrcText) return [];
    
    const lines = lrcText.split('\n');
    const parsed = [];
    const pattern = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;
    
    for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = parseInt(match[3]);
            const time = minutes * 60 + seconds + centiseconds / 100;
            const text = match[4] || '';
            if (text.trim()) {
                parsed.push({ time, text: text.trim() });
            }
        }
    }
    
    return parsed;
}

// ========== 创建SSA字幕（可选增强） ==========
function createSsaSubtitle(lrcText) {
    const lines = [];
    const pattern = /\[(\d{2}):(\d{2})\.(\d{2})\](.*)/;

    for (const line of lrcText.split('\n')) {
        const match = line.match(pattern);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const hundredths = parseInt(match[3]);
            const text = match[4].trim();
            const totalSeconds = minutes * 60 + seconds + hundredths / 100.0;
            if (text) {
                lines.push({ start: totalSeconds, text });
            }
        }
    }

    if (lines.length === 0) return '';

    const ssaHeader = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1280
PlayResY: 720
Timer: 100.0000
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: WAITING_TOP2,Roboto,55,&H0000FFFF,&H00808080,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,1,2,0,0,180,1
Style: WAITING_TOP1,Roboto,55,&H0000FFFF,&H00808080,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,1,2,0,0,260,1
Style: PLAYING_CENTER,Roboto,60,&H0000FF00,&H00808080,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,2,2,0,0,340,1
Style: PLAYED_BOTTOM1,Roboto,55,&H0000FFFF,&H00808080,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,1,2,0,0,420,1
Style: PLAYED_BOTTOM2,Roboto,55,&H0000FFFF,&H00808080,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,1,2,0,0,500,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    function formatSsaTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const cs = Math.floor((seconds * 100) % 100);
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    }

    const events = [];

    for (let i = 0; i < lines.length; i++) {
        const current = lines[i];
        const currentEnd = lines[i + 1] ? lines[i + 1].start : current.start + 5.0;

        const wait2 = lines[i + 2] || null;
        const wait1 = lines[i + 1] || null;
        const played1 = lines[i - 1] || null;
        const played2 = lines[i - 2] || null;

        const startStr = formatSsaTime(current.start);
        const endStr = formatSsaTime(currentEnd);

        if (wait2) {
            events.push(`Dialogue: 1,${startStr},${endStr},WAITING_TOP2,,0,0,0,,${wait2.text}`);
        }
        if (wait1) {
            events.push(`Dialogue: 2,${startStr},${endStr},WAITING_TOP1,,0,0,0,,${wait1.text}`);
        }
        events.push(`Dialogue: 3,${startStr},${endStr},PLAYING_CENTER,,0,0,0,,${current.text}`);
        if (played1) {
            events.push(`Dialogue: 4,${startStr},${endStr},PLAYED_BOTTOM1,,0,0,0,,${played1.text}`);
        }
        if (played2) {
            events.push(`Dialogue: 5,${startStr},${endStr},PLAYED_BOTTOM2,,0,0,0,,${played2.text}`);
        }
    }

    return ssaHeader + events.join('\n');
}

// ========== 获取歌手歌曲列表 ==========
async function getArtistSongs(artistId) {
    const songs = [];
    const maxPages = 10;

    for (let page = 1; page <= maxPages; page++) {
        try {
            const url = `${API_HOST}/api/www/artist/artistMusic?artistid=${artistId}&pn=${page}&rn=30`;
            const data = await getJson(url, { 'Referer': HOST + '/' });

            if (data.code === 200) {
                const musicData = data.data || {};
                const songList = musicData.list || [];

                if (songList.length === 0) break;

                for (const song of songList) {
                    const songName = (song.name || '').trim();
                    if (songName) {
                        songs.push({
                            name: songName,
                            rid: song.rid || '',
                            album: song.album || '',
                            duration: song.duration || ''
                        });
                    }
                }

                if (songs.length >= 300) {
                    return songs.slice(0, 300);
                }
            }
        } catch (e) {
            continue;
        }
    }

    return songs;
}

// ========== 接口实现 ==========

async function init() {
    return {};
}

async function home() {
    const categories = [
        { type_id: '1', type_name: '华语男' },
        { type_id: '2', type_name: '华语女' },
        { type_id: '3', type_name: '华语组合' },
        { type_id: '4', type_name: '日韩男' },
        { type_id: '5', type_name: '日韩女' },
        { type_id: '6', type_name: '日韩组合' },
        { type_id: '7', type_name: '欧美男' },
        { type_id: '8', type_name: '欧美女' },
        { type_id: '9', type_name: '欧美组合' },
        { type_id: '0', type_name: '其他' }
    ];

    return {
        class: categories,
        filters: {},
        list: []
    };
}

async function homeVod() {
    return category({ body: { id: '1', pg: '1' } });
}

async function category(reqIn) {
    const body = bodyOf(reqIn);
    const tid = String(body.id || body.tid || '1');
    const page = pageOf(body.page || body.pg);

    const result = { list: [], page, pagecount: 9999, limit: 90, total: 999999 };

    try {
        const url = `${API_HOST}/api/www/artist/artistInfo?category=${tid}&prefix=&pn=${page}&rn=30`;
        const data = await getJson(url, { 'Referer': HOST + '/' });

        if (data.data && data.data.artistList) {
            const videos = [];
            for (const item of data.data.artistList) {
                videos.push({
                    vod_id: String(item.id || ''),
                    vod_name: item.name || '',
                    vod_pic: item.pic300 || item.pic || item.pic120 || '',
                    vod_remarks: ''
                });
            }
            result.list = videos;
        }
    } catch (e) {
        console.warn('[kuwo] category error:', e?.message || e);
    }

    return result;
}

async function detail(reqIn) {
    const ids = Array.isArray(reqIn?.body?.id) ? reqIn.body.id : [reqIn?.body?.id];
    const result = [];

    for (const rawId of ids.filter(Boolean)) {
        const artistId = String(rawId).trim();

        try {
            // 获取歌手信息
            const infoUrl = `${API_HOST}/api/www/artist/artist?artistid=${artistId}`;
            const infoData = await getJson(infoUrl, { 'Referer': HOST + '/' });
            const artist = infoData.data || {};

            const artistName = artist.name || '';

            // 获取歌曲列表
            const allSongs = await getArtistSongs(artistId);

            // 清理简介
            let artistInfo = artist.info || '';
            artistInfo = stripTags(artistInfo);
            artistInfo = artistInfo.replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
            if (!artistInfo) artistInfo = '暂无歌手简介';

            // 限制歌曲数量
            const maxSongs = 300;
            const songs = allSongs.length > maxSongs ? allSongs.slice(0, maxSongs) : allSongs;

            // 构建播放列表
            const playArr = [];
            for (const song of songs) {
                const name = (song.name || '').replace(/[$#]/g, '').trim();
                const songId = song.rid || '';
                const album = song.album || '';

                if (album) {
                    playArr.push(`${name} - ${album}$${songId}`);
                } else {
                    playArr.push(`${name}$${songId}`);
                }
            }

            const vod = {
                vod_id: artistId,
                vod_name: artistName,
                vod_pic: artist.pic300 || artist.pic || '',
                vod_content: artistInfo,
                vod_remarks: `歌曲 : ${songs.length}首`,
                vod_actor: artistName,
                vod_play_from: '酷我音乐',
                vod_play_url: playArr.join('#')
            };

            result.push(vod);

        } catch (e) {
            console.warn('[kuwo] detail error:', e?.message || e);
            result.push({
                vod_id: artistId,
                vod_name: '加载失败',
                vod_content: `加载歌手信息失败: ${e?.message || '未知错误'}`,
                vod_remarks: '加载失败',
                vod_actor: '未知',
                vod_play_from: '酷我音乐',
                vod_play_url: ''
            });
        }
    }

    return { list: result };
}

async function play(reqIn) {
    const body = bodyOf(reqIn);
    const rid = String(body.id || '').trim();

    const result = {
        parse: 0,
        url: '',
        header: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.kuwo.cn/'
        }
    };

    if (!rid) return result;

    const qualities = [];
    const qualityList = [
        { name: '无损FLAC', bitrate: 2000, format: 'flac' },
        { name: '高品质320K', bitrate: 320, format: 'mp3' },
        { name: '标准128K', bitrate: 128, format: 'mp3' }
    ];

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10)',
        'Referer': 'https://www.kuwo.cn/'
    };

    for (const q of qualityList) {
        try {
            const apiUrl = `https://nmobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayer_ar_4.4.2.7_B_nuoweida_vh.apk&type=convert_url_with_sign&rid=${rid}&bitrate=${q.bitrate}&format=${q.format}`;
            const data = await getJson(apiUrl, headers);
            if (data.code === 200 && data.data && data.data.url) {
                qualities.push({ name: q.name, url: data.data.url });
            }
        } catch (e) {
            continue;
        }
    }

    if (qualities.length === 0) {
        return result;
    }

    // 构建多品质播放URL
    const urls = [];
    for (const q of qualities) {
        urls.push(q.name);
        urls.push(q.url);
    }
    result.url = urls;

    // ========== 新增：获取歌词 ==========
    try {
        const lrc = await getLyric(rid);
        if (lrc) {
            // 添加歌词到返回结果
            result.lyric = lrc;
            result.lrc = lrc;  // 兼容字段
            result.content = lrc;  // Tvbox 兼容
            
            // 解析歌词为数组
            const lyricList = parseLyric(lrc);
            result.lyricList = lyricList;
            
            // 生成SSA字幕（如果播放器支持）
            try {
                const ssaContent = createSsaSubtitle(lrc);
                if (ssaContent) {
                    const ssaBase64 = Buffer.from(ssaContent, 'utf-8').toString('base64');
                    result.subs = [{
                        name: '歌词',
                        url: `data:text/x-ssa;base64,${ssaBase64}`,
                        format: 'text/x-ssa',
                        selected: true
                    }];
                }
            } catch (e) {
                // 字幕生成失败不影响播放
            }
        }
    } catch (e) {
        console.warn('[kuwo] lyric fetch error:', e?.message || e);
    }

    return result;
}

async function search(reqIn) {
    const body = bodyOf(reqIn);
    const wd = String(body.wd || '').trim();
    const page = pageOf(body.page || body.pg);

    const result = {
        list: [],
        page: page,
        pagecount: 9999,
        limit: 30,
        total: 999999
    };

    if (!wd) return result;

    try {
        const pageNum = (page - 1) * 30;
        const encodedWd = encodeURIComponent(wd);
        const url = `https://search.kuwo.cn/r.s?client=kt&pn=${pageNum}&rn=30&all=${encodedWd}&vipver=1&ft=artist&encoding=utf8&rformat=json&mobi=1`;

        const data = await getJson(url, { 'Referer': HOST + '/' });

        if (data.abslist) {
            const basePath = data.BASEPICPATH || 'http://img1.kuwo.cn/star/starheads/';
            const videos = [];

            for (const item of data.abslist) {
                const aid = item.ARTISTID || item.DC_TARGETID || '';
                let pic = item.hts_PICPATH || '';
                if (!pic && item.PICPATH) {
                    pic = basePath + item.PICPATH;
                }

                videos.push({
                    vod_id: String(aid),
                    vod_name: item.ARTIST || '',
                    vod_pic: pic,
                    vod_remarks: `歌曲 : ${item.SONGNUM || 0}首`
                });
            }

            result.list = videos;
        }
    } catch (e) {
        console.warn('[kuwo] search error:', e?.message || e);
    }

    return result;
}

// ========== 导出 ==========

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
            fastify.post('/play', play);
            fastify.post('/search', search);
        },
        check: async () => {
            try {
                const data = await getJson(`${API_HOST}/api/www/artist/artistInfo?category=1&pn=1&rn=1`);
                return data && data.code === 200;
            } catch {
                return false;
            }
        }
    };
}