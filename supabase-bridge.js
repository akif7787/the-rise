"use strict";

/* The Rise BD — Supabase Cloud Bridge (Auth, Database & Storage) */
(function () {
  var SUPABASE_URL = 'https://ptomtfvwhhocaxgpvesg.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_9kIM2Vb-1qj9fHWytOj-ag_xc5hcQG0';

  var client = null;
  function getClient() {
    if (client) return client;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return client;
  }

  /* Lightweight REST helper (works even on pages without CDN script) */
  function restFetch(path, options) {
    var opts = options || {};
    var headers = Object.assign({
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + (opts.token || SUPABASE_KEY),
      'Content-Type': 'application/json'
    }, opts.headers || {});
    return fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('Supabase REST ' + res.status);
      var ct = res.headers.get('content-type') || '';
      return ct.indexOf('application/json') !== -1 ? res.json() : null;
    });
  }

  function getAccessToken() {
    var sb = getClient();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      return res && res.data && res.data.session ? res.data.session.access_token : null;
    }).catch(function () { return null; });
  }

  /* Public: Pull published content & settings from Supabase into local cache */
  function pullPublicContent() {
    return Promise.allSettled([
      restFetch('news_articles?select=*&order=created_at.desc'),
      restFetch('spotlights?select=*&order=created_at.desc'),
      restFetch('authors?select=*'),
      restFetch('ad_campaigns?select=*&status=eq.active&order=created_at.desc'),
      restFetch('site_settings?select=*')
    ]).then(function (results) {
      var nr = window.RiseNewsroom;
      if (!nr) return false;
      var state = nr.load();
      var changed = false;

      if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
        state.publishedArticles = results[0].value.map(function (r) {
          return {
            id: r.id, topic: r.topic, badgeClass: r.badge_class || 'policy',
            headline: r.headline, dek: r.dek, authorId: r.author_id || '',
            author: r.author, affiliation: r.affiliation || '',
            date: r.date_label, readTime: r.read_time || '5 min read',
            image: r.image_url || '', imageCaption: r.image_caption || '',
            body: Array.isArray(r.body) ? r.body : [],
            sources: Array.isArray(r.sources) ? r.sources : []
          };
        });
        changed = true;
      }

      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
        state.publishedStories = results[1].value.map(function (r) {
          return {
            id: r.id, name: r.name, category: r.category, cats: r.cats || r.category,
            achievement: r.achievement, localImage: r.image_url || '',
            monogram: r.monogram || '', color: r.color || '#111827',
            summary: r.summary, headline: r.headline, featuredDate: r.featured_date,
            journey: Array.isArray(r.journey) ? r.journey : [],
            body: Array.isArray(r.body) ? r.body : [],
            sources: Array.isArray(r.sources) ? r.sources : []
          };
        });
        changed = true;
      }

      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) {
        results[2].value.forEach(function (a) {
          state.customAuthors[a.id] = {
            id: a.id, name: a.name, role: a.role, institution: a.institution,
            photo: a.photo_url || 'akif-profile.jpg', bio: a.bio || '',
            email: a.email || '', links: Array.isArray(a.links) ? a.links : []
          };
        });
        changed = true;
      }

      if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) {
        state.adCampaigns = results[3].value.map(function (c) {
          return {
            id: c.id, name: c.name, advertiser: c.advertiser, runBy: c.run_by,
            targets: Array.isArray(c.targets) ? c.targets : ['home_top'],
            bannerSize: c.banner_size, mediaType: c.media_type, mediaUrl: c.media_url,
            title: c.title, text: c.description, cta: c.cta, href: c.href,
            startAt: c.start_at, endAt: c.end_at, status: c.status,
            impressions: c.impressions, clicks: c.clicks, createdAt: c.created_at
          };
        });
        changed = true;
      }

      if (results[4].status === 'fulfilled' && Array.isArray(results[4].value)) {
        results[4].value.forEach(function (row) {
          if (row.key === 'socialLinks' && row.value) state.socialLinks = row.value;
          if (row.key === 'popup') state.popup = row.value;
          if (row.key === 'tickerItems' && Array.isArray(row.value)) state.tickerItems = row.value;
          if (row.key === 'customSections' && Array.isArray(row.value)) state.customSections = row.value;
          if (row.key === 'riseSelectIds' && Array.isArray(row.value)) state.riseSelectIds = row.value;
          if (row.key === 'partnershipConfig' && row.value) state.partnershipConfig = row.value;
          if (row.key === 'recycleBin' && Array.isArray(row.value)) state.recycleBin = row.value;
          if (row.key === 'jobCirculars' && Array.isArray(row.value)) state.jobCirculars = row.value;
          if (row.key === 'ambassadorCirculars' && Array.isArray(row.value)) state.ambassadorCirculars = row.value;
          if (row.key === 'deletedArticleIds' && Array.isArray(row.value)) state.deletedArticleIds = row.value;
          if (row.key === 'deletedStoryIds' && Array.isArray(row.value)) state.deletedStoryIds = row.value;
        });
        changed = true;
      }

      if (changed) {
        nr.save(state);
        try { window.dispatchEvent(new CustomEvent('rise:cloud-synced')); } catch (e) {}
      }
      return changed;
    }).catch(function () { return false; });
  }

  /* Auth: Sign in via Supabase Auth + verify role in team_roles */
  function signIn(email, password) {
    var sb = getClient();
    if (!sb) return Promise.reject(new Error('Supabase SDK not loaded'));
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      var user = res.data.user;
      var token = res.data.session.access_token;
      return restFetch('team_roles?select=*&email=eq.' + encodeURIComponent(user.email), { token: token })
        .then(function (rows) {
          var roleRow = Array.isArray(rows) && rows[0] ? rows[0] : null;
          return {
            id: user.id,
            name: (roleRow && roleRow.name) || user.email.split('@')[0],
            email: user.email,
            role: (roleRow && roleRow.role) || 'Admin',
            token: token
          };
        });
    });
  }

  function getCurrentSession() {
    var sb = getClient();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      if (!session || !session.user) return null;
      return restFetch('team_roles?select=*&email=eq.' + encodeURIComponent(session.user.email), { token: session.access_token })
        .then(function (rows) {
          var roleRow = Array.isArray(rows) && rows[0] ? rows[0] : null;
          return {
            id: session.user.id,
            name: (roleRow && roleRow.name) || session.user.email.split('@')[0],
            email: session.user.email,
            role: (roleRow && roleRow.role) || 'Admin',
            token: session.access_token
          };
        }).catch(function () {
          return { id: session.user.id, name: session.user.email, email: session.user.email, role: 'Admin', token: session.access_token };
        });
    });
  }

  function signOut() {
    var sb = getClient();
    if (!sb) return Promise.resolve();
    return sb.auth.signOut();
  }

  function uploadMedia(file) {
    var sb = getClient();
    if (!sb || !file) return Promise.resolve(null);
    var safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sb.storage.from('newsroom-media').upload(safeName, file, { upsert: true }).then(function (res) {
      if (res.error) throw res.error;
      var pub = sb.storage.from('newsroom-media').getPublicUrl(safeName);
      return pub && pub.data ? pub.data.publicUrl : null;
    });
  }

  window.RiseSupabase = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    getClient: getClient,
    restFetch: restFetch,
    getAccessToken: getAccessToken,
    pullPublicContent: pullPublicContent,
    signIn: signIn,
    getCurrentSession: getCurrentSession,
    signOut: signOut,
    uploadMedia: uploadMedia
  };
})();
