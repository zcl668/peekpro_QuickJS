const HOST = 'https://fy-musicbox-api.mu-jie.cc';

function request(url, headers) {
    try {
        let res = fetch(url, {headers: headers || {}});
        let text = '';
        if (typeof res === 'string') {
            text = res;
        } else if (res && typeof res === 'object') {
            text = res.content || res.body || res.data || JSON.stringify(res);
        }
        if (!text || text.length === 0) return {};
        text = text.trim();
        if (text.charAt(0) === '<') return {};
        return JSON.parse(text);
    } catch(e) {
        return {};
    }
}

function init(ext) {
}

function home(filter) {
    let result = {"class": []};
    try {
        let url = HOST + "/getPlaylistCategory";
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://mu-jie.cc/'
        };
        let data = request(url, headers);
        let categories = [];
        if (Array.isArray(data) && data.length > 0) {
            categories = data[0].category || [];
        } else if (typeof data === 'object' && data !== null) {
            categories = data.category || data.data || [];
        }
        let classes = [];
        for (let i = 0; i < categories.length; i++) {
            let cat = categories[i];
            let subList = cat.sub || [];
            for (let j = 0; j < subList.length; j++) {
                let sub = subList[j];
                if (sub && sub.name) {
                    classes.push({
                        type_id: sub.name,
                        type_name: sub.name
                    });
                }
            }
        }
        result.class = classes;
    } catch(e) {}
    return JSON.stringify(result);
}

function homeVod() {
    return JSON.stringify({list: []});
}

function categoryContent(tid, pg, filter, extend) {
    pg = parseInt(pg) || 1;
    let result = {list: [], page: pg, pagecount: 1, limit: 90, total: 999999};
    try {
        if (!tid) {
            return JSON.stringify(result);
        }
        if (tid.indexOf('@') !== -1) {
            let playlistId = tid.split('@')[0];
            let url = HOST + "/meting/?server=netease&type=playlist&id=" + playlistId;
            let headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://mu-jie.cc/'
            };
            let data = request(url, headers);
            let tracks = [];
            if (typeof data === 'object' && data !== null) {
                if (Array.isArray(data)) {
                    tracks = data;
                } else {
                    tracks = data.tracks || [];
                }
            }
            for (let i = 0; i < tracks.length; i++) {
                let track = tracks[i];
                if (!track || !track.name) continue;
                let songUrl = track.url || '';
                let pic = track.pic || '';
                let artist = track.artist || '未知艺术家';
                result.list.push({
                    vod_id: String(songUrl),
                    vod_name: String(track.name),
                    vod_pic: String(pic),
                    vod_remarks: String(artist)
                });
            }
        } else {
            let url = HOST + "/netease/playlist/category?type=" + encodeURIComponent(tid) + "&limit=60";
            let headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://mu-jie.cc/'
            };
            let data = request(url, headers);
            if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    let item = data[i];
                    if (!item || typeof item !== 'object') continue;
                    let name = item.name || '未知歌单';
                    let pid = item.id || '';
                    let pic = item.coverImgUrl || '';
                    let playCount = item.playCount || 0;
                    result.list.push({
                        vod_id: String(pid) + '@',
                        vod_name: String(name),
                        vod_pic: String(pic),
                        vod_tag: 'folder',
                        vod_remarks: String(playCount) + ' 播放量'
                    });
                }
            }
        }
    } catch(e) {}
    return JSON.stringify(result);
}

function extractSongId(urlOrId) {
    if (!urlOrId) return '';
    if (/^\d+$/.test(urlOrId)) return urlOrId;
    
    let patterns = [
        /[?&]id=(\d+)/,
        /\/song\/(\d+)/,
        /\/playlist\/(\d+)/,
        /\/track\/(\d+)/,
        /\/(\d+)\.mp3/,
        /\/(\d+)\.m4a/,
        /\/(\d+)\.flac/,
        /\/(\d+)$/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
        let match = urlOrId.match(patterns[i]);
        if (match) return match[1];
    }
    return '';
}

function getLyric(songId) {
    if (!songId) return null;
    try {
        let url = HOST + "/meting/?server=netease&type=lrc&id=" + songId;
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://mu-jie.cc/'
        };
        let res = fetch(url, {headers: headers});
        let text = '';
        if (typeof res === 'string') {
            text = res;
        } else if (res && typeof res === 'object') {
            text = res.content || res.body || res.data || '';
        }
        if (text && text.trim().length > 0 && text.trim().charAt(0) !== '<') {
            return text.trim();
        }
    } catch(e) {}
    return null;
}

function detailContent(ids) {
    let did;
    if (typeof ids === 'string') {
        did = ids;
    } else if (Array.isArray(ids)) {
        did = ids[0];
    } else {
        did = String(ids);
    }
    
    let result = {};
    try {
        result.list = [{
            vod_id: did,
            vod_name: '音乐播放',
            vod_pic: '',
            vod_content: '',
            vod_remarks: '',
            vod_actor: '',
            vod_play_from: '音乐专线',
            vod_play_url: '播放$' + did
        }];
    } catch(e) {
        result.list = [{
            vod_id: did || '',
            vod_name: '加载失败',
            vod_content: '加载详情失败',
            vod_remarks: '加载失败',
            vod_actor: '未知',
            vod_play_from: '音乐专线',
            vod_play_url: ''
        }];
    }
    return JSON.stringify(result);
}

function playerContent(flag, id, vipFlags) {
    let rid;
    if (typeof id === 'string') {
        rid = id;
    } else if (Array.isArray(id)) {
        rid = id[0];
    } else {
        rid = String(id);
    }
    
    let result = {};
    try {
        let playUrl = rid;
        let songId = extractSongId(rid);
        let lyric = getLyric(songId);
        
        result.parse = 0;
        result.playUrl = '';
        result.url = playUrl;
        result.header = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://mu-jie.cc/'
        };
        
        if (lyric) {
            result.lyric = lyric;
            result.content = lyric;
            result.lrc = lyric;
            result.subtitle = lyric;
            result.hasLyric = true;
        } else {
            result.content = '暂无歌词';
            result.hasLyric = false;
        }
    } catch(e) {
        result.parse = 0;
        result.playUrl = '';
        result.url = rid || '';
        result.header = {};
    }
    return JSON.stringify(result);
}

function searchContent(key, quick, pg) {
    pg = pg ? parseInt(pg) : 1;
    let result = {list: [], page: pg, pagecount: 9999, limit: 20, total: 999999};
    try {
        if (!key) {
            return JSON.stringify(result);
        }
        let url = HOST + "/netease/search/song/?keywords=" + encodeURIComponent(key) + "&pn=" + pg + "&limit=20";
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://mu-jie.cc/'
        };
        let data = request(url, headers);
        let tracks = [];
        if (typeof data === 'object' && data !== null) {
            tracks = data.tracks || data.results || data.data || data.songs || [];
        }
        if (!Array.isArray(tracks)) {
            tracks = [];
        }
        for (let i = 0; i < tracks.length; i++) {
            let track = tracks[i];
            if (!track || !track.name) continue;
            let songUrl = track.url || '';
            let pic = track.pic || '';
            let artist = track.artist || '未知艺术家';
            result.list.push({
                vod_id: String(songUrl),
                vod_name: String(track.name),
                vod_pic: String(pic),
                vod_remarks: String(artist)
            });
        }
    } catch(e) {}
    return JSON.stringify(result);
}

function searchContentPage(key, quick, pg) {
    return searchContent(key, quick, pg);
}

function localProxy(param) {
    return null;
}

function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: categoryContent,
        detail: detailContent,
        play: playerContent,
        search: searchContent,
        searchContentPage: searchContentPage,
        localProxy: localProxy
    };
}
