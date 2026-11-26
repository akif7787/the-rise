"use strict";

/* The Rise BD Newsroom — Unified Local Store, Publishing & Analytics */
(function () {
  var STORAGE_KEY = 'rise_newsroom_v1';
  var SESSION_VISITED_KEY = 'rise_session_visited_v1';

  function todayIso() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function formatDisplayDate(iso) {
    try {
      return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(iso ? new Date(iso) : new Date());
    } catch (e) {
      return new Date().toDateString();
    }
  }

  function defaultState() {
    return {
      articlesQueue: [],
      nominationsQueue: [],
      adsQueue: [],
      subscribers: [],
      publishedArticles: [],
      publishedStories: [],
      deletedArticleIds: [],
      deletedStoryIds: [],
      featuredSpotlightId: 'nasir',
      customAuthors: {},
      deletedAuthorIds: [],
      adPlacements: {},
      adCampaigns: [],
      tickerItems: [],
      auditLog: [],
      riseSelectIds: [],
      partnershipConfig: {
        stats: [
          { val: 'Bangladesh-First', lbl: 'Youth, Researchers & Builders' },
          { val: '100% Verified', lbl: 'Human-Checked Editorial Context' },
          { val: 'Web + Social', lbl: 'Website, Facebook, LinkedIn & IG' },
          { val: 'Direct Desk', lbl: 'Fast Email & WhatsApp Booking' }
        ],
        collabs: null
      },
      socialLinks: {
        facebook: 'https://www.facebook.com/',
        linkedin: 'https://www.linkedin.com/',
        instagram: 'https://www.instagram.com/',
        youtube: 'https://www.youtube.com/',
        x: 'https://x.com/'
      },
      popup: null,
      customSections: [],
      campaigns: [],
      team: [
        {
          id: 'tm-admin-1',
          name: 'Mohammed Ahanaf Akif Rahman',
          email: 'admin@therisebd.com',
          password: 'rise2026',
          role: 'Admin',
          createdAt: '2026-11-01T00:00:00.000Z'
        }
      ],
      analytics: {
        totalVisits: 0,
        totalImpressions: 0,
        uniqueVisitors: 0,
        daily: {},
        pageViews: {},
        articleReads: {},
        storyReads: {}
      },
      recycleBin: [],
      jobCirculars: [],
      ambassadorCirculars: [],
      passcode: 'rise2026'
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      var def = defaultState();
      return {
        articlesQueue: Array.isArray(parsed.articlesQueue) ? parsed.articlesQueue : [],
        nominationsQueue: Array.isArray(parsed.nominationsQueue) ? parsed.nominationsQueue : [],
        adsQueue: Array.isArray(parsed.adsQueue) ? parsed.adsQueue : [],
        subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
        publishedArticles: Array.isArray(parsed.publishedArticles) ? parsed.publishedArticles : [],
        publishedStories: Array.isArray(parsed.publishedStories) ? parsed.publishedStories : [],
        deletedArticleIds: Array.isArray(parsed.deletedArticleIds) ? parsed.deletedArticleIds : [],
        deletedStoryIds: Array.isArray(parsed.deletedStoryIds) ? parsed.deletedStoryIds : [],
        featuredSpotlightId: parsed.featuredSpotlightId || 'nasir',
        customAuthors: parsed.customAuthors && typeof parsed.customAuthors === 'object' ? parsed.customAuthors : {},
        deletedAuthorIds: Array.isArray(parsed.deletedAuthorIds) ? parsed.deletedAuthorIds : [],
        adPlacements: parsed.adPlacements && typeof parsed.adPlacements === 'object' ? parsed.adPlacements : {},
        adCampaigns: Array.isArray(parsed.adCampaigns) ? parsed.adCampaigns : [],
        tickerItems: Array.isArray(parsed.tickerItems) ? parsed.tickerItems : [],
        auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
        riseSelectIds: Array.isArray(parsed.riseSelectIds) ? parsed.riseSelectIds : [],
        partnershipConfig: parsed.partnershipConfig && typeof parsed.partnershipConfig === 'object' ? parsed.partnershipConfig : def.partnershipConfig,
        socialLinks: parsed.socialLinks && typeof parsed.socialLinks === 'object' ? Object.assign(def.socialLinks, parsed.socialLinks) : def.socialLinks,
        popup: parsed.popup || null,
        customSections: Array.isArray(parsed.customSections) ? parsed.customSections : [],
        campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
        team: Array.isArray(parsed.team) && parsed.team.length ? parsed.team : def.team,
        analytics: Object.assign(def.analytics, parsed.analytics || {}),
        recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
        jobCirculars: Array.isArray(parsed.jobCirculars) ? parsed.jobCirculars : [],
        ambassadorCirculars: Array.isArray(parsed.ambassadorCirculars) ? parsed.ambassadorCirculars : [],
        passcode: parsed.passcode || 'rise2026'
      };
    } catch (e) {
      return defaultState();
    }
  }

  var syncChannel = null;
  try {
    if ('BroadcastChannel' in window) syncChannel = new BroadcastChannel('rise_newsroom_sync');
  } catch (e) {}

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (syncChannel) syncChannel.postMessage({ type: 'state_updated', ts: Date.now() });
      return true;
    } catch (e) {
      return false;
    }
  }

  function slugify(str) {
    return String(str || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || ('item-' + Date.now());
  }

  function topicToBadge(topic) {
    var t = String(topic || '').toLowerCase();
    if (t.indexOf('ai') !== -1 || t.indexOf('tech') !== -1) return 'tech';
    if (t.indexOf('science') !== -1 || t.indexOf('climate') !== -1) return 'science';
    if (t.indexOf('startup') !== -1 || t.indexOf('business') !== -1) return 'business';
    if (t.indexOf('education') !== -1) return 'education';
    return 'policy';
  }

  function submitArticle(payload) {
    var state = load();
    var id = slugify(payload.headline) + '-' + String(Date.now()).slice(-4);
    var entry = {
      id: id,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      author: payload.author || 'Anonymous',
      email: payload.email || '',
      whatsapp: payload.whatsapp || '',
      affiliation: payload.affiliation || 'Contributor · Bangladesh',
      topic: payload.topic || 'Policy & Society',
      city: payload.city || 'Dhaka',
      headline: payload.headline || 'Untitled Article',
      dek: payload.summary || '',
      bodyText: payload.bodyText || '',
      sources: payload.sources || '',
      imageNames: payload.imageNames || 'None attached'
    };
    state.articlesQueue.unshift(entry);
    save(state);
    return entry;
  }

  function submitNomination(payload) {
    var state = load();
    var id = slugify(payload.name) + '-' + String(Date.now()).slice(-4);
    var entry = {
      id: id,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      name: payload.name || 'Unnamed Achiever',
      email: payload.email || '',
      whatsapp: payload.whatsapp || '',
      address: payload.address || 'Bangladesh',
      category: payload.category || 'Research',
      achievement: payload.achievement || 'Community Recognition',
      headline: payload.headline || payload.name,
      bodyText: payload.bodyText || '',
      proofLink: payload.proofLink || '',
      photoNames: payload.photoNames || 'None',
      proofNames: payload.proofNames || 'None'
    };
    state.nominationsQueue.unshift(entry);
    save(state);
    return entry;
  }

  function submitAd(payload) {
    var state = load();
    var entry = {
      id: 'ad-' + Date.now(),
      status: 'new',
      submittedAt: new Date().toISOString(),
      name: payload.name || '',
      company: payload.company || '',
      slot: payload.slot || 'General Sponsorship',
      message: payload.message || ''
    };
    state.adsQueue.unshift(entry);
    save(state);
    return entry;
  }

  function addSubscriber(email, source, topics) {
    var clean = String(email || '').trim().toLowerCase();
    if (!clean) return null;
    var chosen = Array.isArray(topics) && topics.length ? topics : ['Latest Stories'];
    var state = load();
    var existing = state.subscribers.find(function (s) { return s.email === clean; });
    if (existing) {
      existing.topics = chosen;
    } else {
      state.subscribers.unshift({
        id: 'sub-' + Date.now(),
        email: clean,
        source: source || window.location.pathname,
        topics: chosen,
        subscribedAt: new Date().toISOString()
      });
    }
    save(state);
    return clean;
  }

  function acceptArticle(id) {
    var state = load();
    var item = state.articlesQueue.find(function (a) { return a.id === id; });
    if (!item) return false;
    item.status = 'published';
    item.reviewedAt = new Date().toISOString();

    var paragraphs = String(item.bodyText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paragraphs.length) paragraphs = [item.dek || item.headline];
    var wordCount = String(item.bodyText || '').trim().split(/\s+/).filter(Boolean).length;
    var readMins = Math.max(2, Math.ceil(wordCount / 180));

    var published = {
      id: item.id,
      topic: item.topic || 'Policy & Society',
      badgeClass: topicToBadge(item.topic),
      headline: item.headline,
      dek: item.dek || paragraphs[0],
      author: item.author,
      affiliation: item.affiliation || (item.city ? item.city + ', Bangladesh' : 'Bangladesh'),
      date: formatDisplayDate(),
      readTime: readMins + ' min read',
      image: item.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
      imageCaption: 'Published via The Rise BD Newsroom.',
      body: paragraphs,
      sources: item.sources ? [{ label: 'Author Reference / Source', url: item.sources }] : []
    };
    if (!state.publishedArticles.some(function (p) { return p.id === published.id; })) {
      state.publishedArticles.unshift(published);
    }
    save(state);
    return true;
  }

  function rejectArticle(id) {
    var state = load();
    var item = state.articlesQueue.find(function (a) { return a.id === id; });
    if (!item) return false;
    item.status = 'rejected';
    item.reviewedAt = new Date().toISOString();
    save(state);
    return true;
  }

  function acceptNomination(id) {
    var state = load();
    var item = state.nominationsQueue.find(function (n) { return n.id === id; });
    if (!item) return false;
    item.status = 'published';
    item.reviewedAt = new Date().toISOString();

    var paragraphs = String(item.bodyText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paragraphs.length) paragraphs = [item.achievement + ' — featured in The Rise BD.'];

    var published = {
      id: item.id,
      name: item.name,
      category: item.category || 'Research',
      cats: (item.category || 'Research') + ' Awards',
      achievement: item.achievement,
      localImage: item.localImage || 'nasir%20.jpg',
      sample: false,
      alt: item.name + ' — ' + item.achievement,
      summary: item.achievement + ' (' + item.address + ').',
      headline: item.headline || (item.name + ': ' + item.achievement),
      featuredDate: formatDisplayDate(),
      journey: [
        ['Background', item.name + ' from ' + item.address + '.'],
        ['Achievement', item.achievement],
        ['Verification', item.proofLink ? 'Verified via submitted documentation & reference link.' : 'Verified by The Rise BD Newsroom editors.']
      ],
      body: paragraphs,
      sources: item.proofLink ? [{ label: 'Verification Reference', url: item.proofLink }] : []
    };
    if (!state.publishedStories.some(function (s) { return s.id === published.id; })) {
      state.publishedStories.unshift(published);
    }
    save(state);
    return true;
  }

  function rejectNomination(id) {
    var state = load();
    var item = state.nominationsQueue.find(function (n) { return n.id === id; });
    if (!item) return false;
    item.status = 'rejected';
    item.reviewedAt = new Date().toISOString();
    save(state);
    return true;
  }

  function updateAdStatus(id, status) {
    var state = load();
    var item = state.adsQueue.find(function (a) { return a.id === id; });
    if (!item) return false;
    item.status = status;
    save(state);
    return true;
  }

  function deleteSubscriber(id) {
    var state = load();
    state.subscribers = state.subscribers.filter(function (s) { return s.id !== id; });
    save(state);
    return true;
  }

  function publishArticleDirect(payload) {
    var state = load();
    var id = slugify(payload.headline) + '-' + String(Date.now()).slice(-4);
    var bodyArr = [];
    if (payload.bodyHtml && String(payload.bodyHtml).trim()) {
      bodyArr = [String(payload.bodyHtml).trim()];
    } else {
      bodyArr = String(payload.bodyText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    }
    if (!bodyArr.length) bodyArr = [payload.dek || payload.headline];
    var plainWords = String(payload.bodyText || payload.bodyHtml || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    var readMins = Math.max(2, Math.ceil(plainWords / 180));
    var art = {
      id: id,
      topic: payload.topic || 'Policy & Society',
      badgeClass: topicToBadge(payload.topic),
      headline: payload.headline,
      dek: payload.dek || '',
      authorId: payload.authorId || '',
      author: payload.author || 'The Rise Editorial',
      affiliation: payload.affiliation || 'The Rise BD Newsroom · Dhaka',
      date: payload.date || formatDisplayDate(),
      readTime: payload.readTime || (readMins + ' min read'),
      image: payload.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
      imageCaption: payload.imageCaption || 'Published from The Rise BD Newsroom.',
      body: bodyArr,
      sources: payload.sources ? [{ label: 'Source / Reference', url: payload.sources }] : []
    };
    state.publishedArticles.unshift(art);
    save(state);
    return art;
  }

  function updatePublishedArticle(id, payload) {
    var state = load();
    var bodyArr = [];
    if (payload.bodyHtml && String(payload.bodyHtml).trim()) {
      bodyArr = [String(payload.bodyHtml).trim()];
    } else {
      bodyArr = String(payload.bodyText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    }
    var plainWords = String(payload.bodyText || payload.bodyHtml || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    var readMins = Math.max(2, Math.ceil(plainWords / 180));
    var existing = state.publishedArticles.find(function (x) { return x.id === id; });
    var updated = Object.assign({}, existing || { id: id }, {
      id: id,
      topic: payload.topic || (existing && existing.topic) || 'Policy & Society',
      badgeClass: topicToBadge(payload.topic || (existing && existing.topic)),
      headline: payload.headline,
      dek: payload.dek !== undefined ? payload.dek : ((existing && existing.dek) || ''),
      authorId: payload.authorId !== undefined ? payload.authorId : ((existing && existing.authorId) || ''),
      author: payload.author || (existing && existing.author) || 'The Rise Editorial',
      affiliation: payload.affiliation || (existing && existing.affiliation) || 'The Rise BD Newsroom · Dhaka',
      date: payload.date || (existing && existing.date) || formatDisplayDate(),
      readTime: payload.readTime || (readMins + ' min read'),
      image: payload.image || (existing && existing.image) || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80',
      imageCaption: payload.imageCaption || (existing && existing.imageCaption) || 'Published from The Rise BD Newsroom.',
      body: bodyArr.length ? bodyArr : ((existing && existing.body) || []),
      sources: payload.sources ? [{ label: 'Source / Reference', url: payload.sources }] : ((existing && existing.sources) || [])
    });
    var idx = state.publishedArticles.findIndex(function (x) { return x.id === id; });
    if (idx !== -1) state.publishedArticles[idx] = updated;
    else state.publishedArticles.unshift(updated);
    save(state);
    return updated;
  }

  function deletePublishedArticle(id) {
    var state = load();
    state.publishedArticles = state.publishedArticles.filter(function (a) { return a.id !== id; });
    if (state.deletedArticleIds.indexOf(id) === -1) state.deletedArticleIds.push(id);
    save(state);
    return true;
  }

  function publishSpotlightDirect(payload) {
    var state = load();
    var id = slugify(payload.name) + '-' + String(Date.now()).slice(-4);
    var paragraphs = String(payload.bodyText || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (!paragraphs.length) paragraphs = [payload.summary || payload.achievement];
    var story = {
      id: id,
      name: payload.name,
      category: payload.category || 'Research',
      cats: (payload.category || 'Research') + ' Awards',
      achievement: payload.achievement,
      localImage: payload.image || 'nasir%20.jpg',
      sample: false,
      alt: payload.name + ' — ' + payload.achievement,
      summary: payload.summary || payload.achievement,
      headline: payload.headline || (payload.name + ': ' + payload.achievement),
      featuredDate: formatDisplayDate(),
      journey: [
        ['Profile', payload.name + (payload.location ? ' (' + payload.location + ')' : '')],
        ['Recognition', payload.achievement],
        ['Published By', 'The Rise BD Newsroom']
      ],
      body: paragraphs,
      sources: payload.sourceLink ? [{ label: 'Reference', url: payload.sourceLink }] : []
    };
    state.publishedStories.unshift(story);
    if (payload.setFeatured) state.featuredSpotlightId = id;
    save(state);
    return story;
  }

  function deletePublishedStory(id) {
    var state = load();
    state.publishedStories = state.publishedStories.filter(function (s) { return s.id !== id; });
    if (state.deletedStoryIds.indexOf(id) === -1) state.deletedStoryIds.push(id);
    save(state);
    return true;
  }

  function setFeaturedSpotlight(id) {
    var state = load();
    state.featuredSpotlightId = id;
    save(state);
    return true;
  }

  function saveCustomAuthor(payload) {
    var state = load();
    var id = payload.id || slugify(payload.name);
    state.customAuthors[id] = {
      id: id,
      name: payload.name,
      role: payload.role || 'Contributor · The Rise BD',
      institution: payload.institution || 'Dhaka, Bangladesh',
      photo: payload.photo || 'akif-profile.jpg',
      bio: payload.bio || '',
      email: payload.email || 'hello@therisebd.com',
      links: payload.website ? [{ label: 'Profile / Website', url: payload.website }] : []
    };
    state.deletedAuthorIds = state.deletedAuthorIds.filter(function (x) { return x !== id; });
    save(state);
    return state.customAuthors[id];
  }

  function deleteAuthor(id) {
    var state = load();
    delete state.customAuthors[id];
    if (state.deletedAuthorIds.indexOf(id) === -1) state.deletedAuthorIds.push(id);
    save(state);
    return true;
  }

  function saveAdPlacement(slotKey, payload) {
    var state = load();
    state.adPlacements[slotKey] = Object.assign({ updatedAt: new Date().toISOString() }, payload);
    save(state);
    return state.adPlacements[slotKey];
  }

  function deleteAdPlacement(slotKey) {
    var state = load();
    delete state.adPlacements[slotKey];
    save(state);
    return true;
  }

  function savePopup(payload) {
    var state = load();
    state.popup = Object.assign({ updatedAt: new Date().toISOString() }, payload);
    save(state);
    return state.popup;
  }

  function clearPopup() {
    var state = load();
    state.popup = null;
    save(state);
    return true;
  }

  function addCustomSection(payload) {
    var state = load();
    var sec = {
      id: 'sec-' + Date.now(),
      eyebrow: payload.eyebrow || 'SPECIAL FEATURE',
      title: payload.title,
      body: payload.body || '',
      ctaText: payload.ctaText || 'Explore →',
      ctaHref: payload.ctaHref || 'articles.html',
      theme: payload.theme || 'violet',
      createdAt: new Date().toISOString()
    };
    state.customSections.push(sec);
    save(state);
    return sec;
  }

  function deleteCustomSection(id) {
    var state = load();
    state.customSections = state.customSections.filter(function (s) { return s.id !== id; });
    save(state);
    return true;
  }

  function saveCampaign(payload) {
    var state = load();
    var camp = {
      id: 'camp-' + Date.now(),
      subject: payload.subject,
      headline: payload.headline,
      body: payload.body,
      recipientCount: state.subscribers.length,
      sentAt: new Date().toISOString()
    };
    state.campaigns.unshift(camp);
    save(state);
    return camp;
  }

  function saveTeamMember(payload) {
    var state = load();
    var member = {
      id: 'tm-' + Date.now(),
      name: payload.name,
      email: String(payload.email || '').trim().toLowerCase(),
      password: payload.password,
      role: payload.role || 'Editor',
      createdAt: new Date().toISOString()
    };
    var existingIdx = state.team.findIndex(function (t) { return t.email === member.email; });
    if (existingIdx !== -1) {
      state.team[existingIdx] = Object.assign(state.team[existingIdx], member);
    } else {
      state.team.push(member);
    }
    save(state);
    return member;
  }

  function deleteTeamMember(id) {
    var state = load();
    if (state.team.length <= 1) return false;
    state.team = state.team.filter(function (t) { return t.id !== id; });
    save(state);
    return true;
  }

  function authenticateUser(email, password) {
    var state = load();
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPass = String(password || '').trim();
    if (!cleanEmail && cleanPass === (state.passcode || 'rise2026')) {
      return state.team[0] || { id: 'admin', name: 'Newsroom Admin', email: 'admin@therisebd.com', role: 'Admin' };
    }
    var found = state.team.find(function (t) {
      return t.email === cleanEmail && t.password === cleanPass;
    });
    if (found) return found;
    if (cleanEmail === 'admin@therisebd.com' && cleanPass === (state.passcode || 'rise2026')) {
      return { id: 'tm-admin-1', name: 'Mohammed Ahanaf Akif Rahman', email: 'admin@therisebd.com', role: 'Admin' };
    }
    return null;
  }

  function hydrateStories(storiesArr) {
    if (!Array.isArray(storiesArr)) return;
    var state = load();
    for (var i = storiesArr.length - 1; i >= 0; i--) {
      if (state.deletedStoryIds.indexOf(storiesArr[i].id) !== -1) {
        storiesArr.splice(i, 1);
      }
    }
    state.publishedStories.forEach(function (item) {
      if (state.deletedStoryIds.indexOf(item.id) === -1 && !storiesArr.some(function (s) { return s.id === item.id; })) {
        storiesArr.unshift(item);
      }
    });
  }

  function hydrateArticles(articlesArr) {
    if (!Array.isArray(articlesArr)) return;
    var state = load();
    for (var i = articlesArr.length - 1; i >= 0; i--) {
      if (state.deletedArticleIds.indexOf(articlesArr[i].id) !== -1) {
        articlesArr.splice(i, 1);
      }
    }
    state.publishedArticles.forEach(function (item) {
      if (state.deletedArticleIds.indexOf(item.id) === -1 && !articlesArr.some(function (a) { return a.id === item.id; })) {
        articlesArr.unshift(item);
      }
    });
  }

  function hydrateAuthors(authorsObj) {
    if (!authorsObj || typeof authorsObj !== 'object') return;
    var state = load();
    state.deletedAuthorIds.forEach(function (id) { delete authorsObj[id]; });
    Object.keys(state.customAuthors).forEach(function (id) {
      if (state.deletedAuthorIds.indexOf(id) === -1) {
        authorsObj[id] = state.customAuthors[id];
      }
    });
  }

  function trackPageView() {
    if (document.getElementById('nr-lock-screen')) return;
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var state = load();
    var day = todayIso();
    var a = state.analytics;
    a.totalVisits += 1;
    var impressionsOnPage = document.querySelectorAll('.ad-slot, .spotlight-card, .news-card, .dual-card').length || 3;
    a.totalImpressions += impressionsOnPage;

    var isNewSession = false;
    try {
      if (!sessionStorage.getItem(SESSION_VISITED_KEY)) {
        sessionStorage.setItem(SESSION_VISITED_KEY, '1');
        isNewSession = true;
        a.uniqueVisitors += 1;
      }
    } catch (e) {}

    if (!a.daily[day]) a.daily[day] = { visits: 0, impressions: 0, unique: 0 };
    a.daily[day].visits += 1;
    a.daily[day].impressions += impressionsOnPage;
    if (isNewSession) a.daily[day].unique += 1;

    a.pageViews[path] = (a.pageViews[path] || 0) + 1;

    var params = new URLSearchParams(window.location.search);
    var itemId = params.get('id');
    if (path === 'article.html') {
      var artKey = itemId || 'climate-governance-bangladesh-local-capacity';
      a.articleReads[artKey] = (a.articleReads[artKey] || 0) + 1;
    } else if (path === 'story.html') {
      var storyKey = itemId || 'nasir';
      a.storyReads[storyKey] = (a.storyReads[storyKey] || 0) + 1;
    }

    save(state);
  }

  function createAdCampaign(payload) {
    var state = load();
    var camp = {
      id: 'adcamp-' + Date.now(),
      name: payload.name || 'Sponsored Campaign',
      advertiser: payload.advertiser || 'Direct Sponsor',
      runBy: payload.runBy || 'Newsroom Admin',
      targets: Array.isArray(payload.targets) && payload.targets.length ? payload.targets : ['home_top'],
      bannerSize: payload.bannerSize || '1280x120',
      mediaType: payload.mediaType || 'image',
      mediaUrl: payload.mediaUrl || '',
      title: payload.title || '',
      text: payload.text || '',
      cta: payload.cta || 'Learn More →',
      href: payload.href || 'https://therisebd.com',
      startAt: payload.startAt || new Date().toISOString().slice(0, 16),
      endAt: payload.endAt || '',
      status: 'active',
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    state.adCampaigns.unshift(camp);
    state.auditLog.unshift({ actor: camp.runBy, action: 'Launched ad campaign: ' + camp.name, at: new Date().toISOString() });
    save(state);
    return camp;
  }

  function toggleAdCampaign(id) {
    var state = load();
    var c = state.adCampaigns.find(function (x) { return x.id === id; });
    if (!c) return false;
    c.status = c.status === 'active' ? 'paused' : 'active';
    save(state);
    return c.status;
  }

  function deleteAdCampaign(id) {
    var state = load();
    state.adCampaigns = state.adCampaigns.filter(function (x) { return x.id !== id; });
    save(state);
    return true;
  }

  function recordAdImpression(id) {
    var state = load();
    var c = state.adCampaigns.find(function (x) { return x.id === id; });
    if (!c) return;
    c.impressions = (c.impressions || 0) + 1;
    save(state);
  }

  function recordAdClick(id) {
    var state = load();
    var c = state.adCampaigns.find(function (x) { return x.id === id; });
    if (!c) return;
    c.clicks = (c.clicks || 0) + 1;
    save(state);
  }

  function updateAdCampaign(id, payload) {
    var state = load();
    var idx = (state.adCampaigns || []).findIndex(function (x) { return x.id === id; });
    if (idx === -1) return null;
    var cur = state.adCampaigns[idx];
    var updated = Object.assign({}, cur, {
      name: payload.name || cur.name,
      advertiser: payload.advertiser || cur.advertiser,
      bannerSize: payload.bannerSize || cur.bannerSize,
      mediaType: payload.mediaType || cur.mediaType,
      mediaUrl: payload.mediaUrl !== undefined ? payload.mediaUrl : cur.mediaUrl,
      title: payload.title || cur.title,
      text: payload.text !== undefined ? payload.text : cur.text,
      cta: payload.cta || cur.cta,
      href: payload.href || cur.href,
      targets: Array.isArray(payload.targets) && payload.targets.length ? payload.targets : cur.targets,
      startAt: payload.startAt !== undefined ? payload.startAt : cur.startAt,
      endAt: payload.endAt !== undefined ? payload.endAt : cur.endAt
    });
    state.adCampaigns[idx] = updated;
    save(state);
    return updated;
  }

  function saveTickerItems(itemsArr) {
    var state = load();
    state.tickerItems = itemsArr.filter(Boolean);
    save(state);
    return state.tickerItems;
  }

  function saveSocialLinks(links) {
    var state = load();
    state.socialLinks = Object.assign({}, state.socialLinks, links || {});
    save(state);
    return state.socialLinks;
  }

  function savePartnershipConfig(cfg) {
    var state = load();
    state.partnershipConfig = Object.assign({}, state.partnershipConfig || {}, cfg || {});
    save(state);
    return state.partnershipConfig;
  }

  function toggleRiseSelect(type, id) {
    var state = load();
    var idx = state.riseSelectIds.findIndex(function (x) { return x.type === type && x.id === id; });
    if (idx !== -1) {
      state.riseSelectIds.splice(idx, 1);
    } else {
      state.riseSelectIds.unshift({ type: type, id: id });
      state.riseSelectIds = state.riseSelectIds.slice(0, 4);
    }
    save(state);
    return state.riseSelectIds;
  }

  function logAudit(actor, action) {
    var state = load();
    state.auditLog.unshift({ actor: actor || 'Admin', action: action, at: new Date().toISOString() });
    state.auditLog = state.auditLog.slice(0, 30);
    save(state);
  }

  window.RiseNewsroom = {
    load: load,
    save: save,
    submitArticle: submitArticle,
    submitNomination: submitNomination,
    submitAd: submitAd,
    addSubscriber: addSubscriber,
    acceptArticle: acceptArticle,
    rejectArticle: rejectArticle,
    acceptNomination: acceptNomination,
    rejectNomination: rejectNomination,
    updateAdStatus: updateAdStatus,
    deleteSubscriber: deleteSubscriber,
    publishArticleDirect: publishArticleDirect,
    updatePublishedArticle: updatePublishedArticle,
    deletePublishedArticle: deletePublishedArticle,
    publishSpotlightDirect: publishSpotlightDirect,
    deletePublishedStory: deletePublishedStory,
    setFeaturedSpotlight: setFeaturedSpotlight,
    saveCustomAuthor: saveCustomAuthor,
    deleteAuthor: deleteAuthor,
    saveAdPlacement: saveAdPlacement,
    deleteAdPlacement: deleteAdPlacement,
    createAdCampaign: createAdCampaign,
    updateAdCampaign: updateAdCampaign,
    toggleAdCampaign: toggleAdCampaign,
    deleteAdCampaign: deleteAdCampaign,
    recordAdImpression: recordAdImpression,
    recordAdClick: recordAdClick,
    saveTickerItems: saveTickerItems,
    saveSocialLinks: saveSocialLinks,
    savePartnershipConfig: savePartnershipConfig,
    toggleRiseSelect: toggleRiseSelect,
    logAudit: logAudit,
    savePopup: savePopup,
    clearPopup: clearPopup,
    addCustomSection: addCustomSection,
    deleteCustomSection: deleteCustomSection,
    saveCampaign: saveCampaign,
    saveTeamMember: saveTeamMember,
    deleteTeamMember: deleteTeamMember,
    authenticateUser: authenticateUser,
    hydrateStories: hydrateStories,
    hydrateArticles: hydrateArticles,
    hydrateAuthors: hydrateAuthors,
    trackPageView: trackPageView
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();

const stories = [
  {
    "id": "nasir",
    "name": "Mohammad Nasir Uddin",
    "category": "Research",
    "cats": "Research Awards",
    "achievement": "Research Paper — First Prize",
    "localImage": "nasir%20.jpg",
    "sample": false,
    "alt": "Mohammad Nasir Uddin at the 2nd Annual International OSH Research Conference 2026",
    "summary": "First-prize recognition at the 2nd Annual International OSH Research Conference 2026.",
    "headline": "Mohammad Nasir Uddin: first-prize recognition for research",
    "featuredDate": "23 November 2026",
    "journey": [
      [
        "The research",
        "A research paper formed the basis of the achievement shared with The Rise."
      ],
      [
        "The conference",
        "Nasir attended the 2nd Annual International OSH Research Conference 2026."
      ],
      [
        "The recognition",
        "According to the submitted update, his paper received first prize at the conference."
      ]
    ],
    "body": [
      "Mohammad Nasir Uddin is today’s featured achiever on The Rise. According to the update shared with us, he attended the 2nd Annual International OSH Research Conference 2026 and received first prize for his research paper.",
      "The recognition puts his research at the centre of this spotlight. The photograph supplied with the story shows Nasir beside a conference display connecting better evidence with safer industries and stronger policies—a fitting setting for a moment of research recognition.",
      "Across occupational safety and health research, clear evidence is often the bridge between lab findings and real-world policy changes that protect workers on the ground. Nasir’s first-prize presentation highlights how rigorous study can earn international recognition.",
      "We are sharing this milestone to celebrate the person behind the achievement. For Nasir, the conference and the first-prize recognition are the focus of today’s feature; the account here stays with the details provided to The Rise."
    ],
    "gallery": [
      {
        "src": "nasir%20.jpg",
        "alt": "Mohammad Nasir Uddin standing beside the conference banner at the 2nd Annual International OSH Research Conference 2026",
        "caption": "Supplied photograph: Mohammad Nasir Uddin at the 2nd Annual International OSH Research Conference 2026.",
        "className": "nasir-photo"
      },
      {
        "src": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1000&q=80",
        "alt": "Academic conference and research presentation setting",
        "caption": "Illustrative conference scene: International research gatherings bring evidence and safer industry policy together."
      }
    ],
    "sourceNote": "Community-submitted profile. The attendance and first-prize details were supplied to The Rise and have not been independently verified. The photograph was provided with the submission. No paper title, affiliation, official results link, or personal quote was supplied."
  },
  {
    "id": "zahid",
    "name": "M. Zahid Hasan",
    "category": "Research",
    "cats": "Research",
    "achievement": "Davisson-Germer Prize",
    "monogram": "ZH",
    "color": "#0F2040",
    "sample": false,
    "alt": "Monogram for M. Zahid Hasan",
    "summary": "Davisson-Germer Prize in atomic or surface physics for discovering new topological states in quantum materials.",
    "headline": "M. Zahid Hasan: a Princeton physicist honoured for quantum discovery",
    "featuredDate": "19 November 2026",
    "journey": [
      [
        "The discovery",
        "Hasan discovered different topological states in quantum materials using advanced surface science techniques."
      ],
      [
        "The laboratory",
        "He has led Princeton’s Laboratory for Topological Quantum Matter and Advanced Spectroscopy since 2008."
      ],
      [
        "The prize",
        "Princeton announced the Davisson-Germer Prize on 18 November 2026 — one of the American Physical Society’s honours in atomic or surface physics."
      ]
    ],
    "body": [
      "Princeton University Professor of Physics M. Zahid Hasan received the Davisson-Germer Prize in Atomic or Surface Physics from the American Physical Society for discovering different topological states in quantum materials using advanced surface science techniques. Princeton announced the award on 18 November 2026.",
      "Born and raised in Dhaka, Hasan joined Princeton in 2002 and has led its Laboratory for Topological Quantum Matter and Advanced Spectroscopy since 2008. He has been Eugene Higgins Professor at Princeton since 2017.",
      "Topological quantum materials exhibit exotic electronic properties on their surfaces that remain stable despite defects—opening possibilities for future low-energy electronics and quantum computing research worldwide.",
      "The prize recognises research that opens new ways of understanding matter at the quantum level — work that began far from Princeton, in Dhaka."
    ],
    "gallery": [
      {
        "src": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1000&q=80",
        "alt": "Scientific laboratory instrumentation and precision research",
        "caption": "Illustrative research photo: Advanced spectroscopy and surface science uncover how electrons behave in quantum matter."
      },
      {
        "src": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=80",
        "alt": "Academic research environment",
        "caption": "Illustrative editorial photo: Decades of laboratory leadership from Dhaka to Princeton University."
      }
    ],
    "sourceNote": "Source: The Daily Inqilab (English), 19 November 2026.",
    "sourceUrl": "https://en.dailyinqilab.com/bangladeshi-scientist-zahid-hasan-wins-prestigious-davisson-germer-award-for-quantum-research/"
  },
  {
    "id": "muammar",
    "name": "Muammar Tazwar Asfi",
    "category": "Hackathon",
    "cats": "Hackathon Technology",
    "achievement": "NASA Space Apps — Regional Champion",
    "monogram": "MA",
    "color": "#166534",
    "sample": false,
    "alt": "Monogram for Muammar Tazwar Asfi",
    "summary": "Led Team Galactic Poet to the Mymensingh regional championship at the NASA Space Apps Challenge 2026.",
    "headline": "Muammar Tazwar Asfi: leading a team to a NASA Space Apps regional title",
    "featuredDate": "19 November 2026",
    "journey": [
      [
        "The team",
        "Five Jagannath University CSE students formed Galactic Poet, with Asfi as team lead."
      ],
      [
        "The project",
        "“Rover Villa” presents the history and missions of space robots, rovers, landers and probes as a digital museum."
      ],
      [
        "The win",
        "Galactic Poet won the Mymensingh regional championship at the NASA Space Apps Challenge 2026 and was nominated for the Global Round."
      ]
    ],
    "body": [
      "Five computer science and engineering students from Jagannath University, competing as Team Galactic Poet, won the regional championship in the Mymensingh division at the NASA Space Apps Challenge 2026. Their project, “Rover Villa”, is a digital museum-style platform showcasing the history, missions and contributions of space-bound robots, rovers, landers and probes.",
      "The hackathon ran on 14–15 November 2026, and the winners were announced at the closing ceremony on 17 November at the American International University-Bangladesh auditorium in Dhaka. The team was nominated for the Global Round.",
      "By turning complex space-exploration history into an accessible interactive experience, Rover Villa stood out among dozens of regional entries focused on science communication and open space data.",
      "Asfi led the team of Md. Ramjan Mia, Atoshi Sharma, Susmita Ghosh and Jihad Rahman. He had previously been on Jagannath University’s “Quantum Voyager” team, Dhaka divisional champion in 2024."
    ],
    "gallery": [
      {
        "src": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1000&q=80",
        "alt": "Student engineering team collaborating during a hackathon",
        "caption": "Illustrative hackathon photo: Team collaboration over 48 hours brought the Rover Villa digital museum to life."
      },
      {
        "src": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1000&q=80",
        "alt": "Award ceremony stage and student recognition",
        "caption": "Illustrative ceremony photo: Regional champions were announced at the closing ceremony in Dhaka ahead of the Global Round."
      }
    ],
    "sourceNote": "Source: The Daily Inqilab (English), 19 November 2026. Corroborated by The Daily Star, 19 November 2026.",
    "sourceUrl": "https://en.dailyinqilab.com/team-galactic-poet-from-jagannath-university-wins-regional-championship-in-nasas-international-hackathon/"
  },
  {
    "id": "shamim",
    "name": "Dr Md Shamim Alam",
    "category": "Innovation",
    "cats": "Innovation Technology",
    "achievement": "Best Innovation Award — Smart Textiles",
    "monogram": "SA",
    "color": "#0F766E",
    "sample": false,
    "alt": "Monogram for Dr Md Shamim Alam",
    "summary": "Best Innovation Award at the TIE–ITET Textile Innovation Expo 2026 for three smart textiles.",
    "headline": "Dr Md Shamim Alam: smart textiles that heal, warm and protect",
    "featuredDate": "16 November 2026",
    "journey": [
      [
        "The lab",
        "Alam leads the Sustainable Smart Textile Lab at Southeast University and is Associate Professor and Coordinator of Textile Engineering."
      ],
      [
        "The innovations",
        "FLUOROVA, FeMats and ThermoTex — three smart, sustainable textiles for health, warmth and protection."
      ],
      [
        "The award",
        "The Best Innovation Award was announced on 12 November 2026 at the Textile Innovation Expo in Dhaka."
      ]
    ],
    "body": [
      "Dr Md Shamim Alam of Southeast University, Dhaka, and Dr Md Raju Ahmed of the University of Manchester jointly won the Best Innovation Award for three innovations developed with the Sustainable Smart Textile Lab.",
      "The three innovations are FLUOROVA, a waterproof, breathable textile made without PFAS “forever chemicals”; FeMats, a graphene-enhanced wearable textile that tracks the health of mother and baby during pregnancy; and ThermoTex, a self-charging smart heating textile.",
      "Together, the three materials show how Bangladesh’s textile expertise is expanding beyond conventional garment manufacturing into high-value medical, sustainable, and functional engineering.",
      "The award was announced on 12 November 2026 at the Open Innovation Zone of the TIE–ITET Textile Innovation Expo at the International Convention City Bashundhara, Dhaka."
    ],
    "gallery": [
      {
        "src": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1000&q=80",
        "alt": "Material science testing in a sustainable textile laboratory",
        "caption": "Illustrative laboratory photo: Sustainable Smart Textile Lab research focuses on safer, chemical-free performance materials."
      },
      {
        "src": "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=80",
        "alt": "Modern textile innovation showcase",
        "caption": "Illustrative expo photo: Smart wearable and heating fabrics debuted at the TIE–ITET Textile Innovation Expo in Dhaka."
      }
    ],
    "sourceNote": "Source: Bangladesh Textile Today, 16 November 2026.",
    "sourceUrl": "https://textiletoday.com.bd/dr-md-shamim-alam-and-dr-md-raju-ahmed-win-best-innovation-award-for-smart-textile-innovations-at-tie-itet-textile-innovation-expo-2026"
  },
  {
    "id": "fatiha",
    "name": "Fatiha Ayat",
    "category": "Leadership",
    "cats": "Leadership Impact",
    "achievement": "Youth of the Year — Promise Awards 2026",
    "monogram": "FA",
    "color": "#334155",
    "sample": false,
    "alt": "Monogram for Fatiha Ayat",
    "summary": "Youth of the Year at the Promise Awards 2026, beating 500,000+ young people worldwide.",
    "headline": "Fatiha Ayat: Youth of the Year on a world stage",
    "featuredDate": "18 November 2026",
    "journey": [
      [
        "The initiative",
        "She founded Zero Olympiad, a global competition encouraging young people to contribute to the UN Sustainable Development Goals."
      ],
      [
        "The award",
        "She was named Youth of the Year at the Promise Awards 2026, organised by World Youth Clubs."
      ],
      [
        "The scale",
        "She beat more than 500,000 young people from over 50 countries and three other finalists."
      ]
    ],
    "body": [
      "Bangladeshi teenager Fatiha Ayat was named Youth of the Year at the Promise Awards 2026, organised by US-based international organisation World Youth Clubs, beating more than 500,000 young people from over 50 countries.",
      "She was nominated for her initiative and social leadership engaging young people in the UN Sustainable Development Goals, and founded Zero Olympiad, a global competition encouraging young people to contribute to sustainable development.",
      "Through Zero Olympiad and community advocacy, her work connects young participants across borders around climate action, equality, and grassroots problem-solving.",
      "Born in Dhaka, she has worked on children’s rights, climate change and human rights since childhood, and first attracted international attention aged seven when she addressed the 74th session of the UN General Assembly."
    ],
    "gallery": [
      {
        "src": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=80",
        "alt": "Young changemakers collaborating on community initiatives",
        "caption": "Illustrative leadership photo: Empowering young voices across communities to engage with global sustainability goals."
      },
      {
        "src": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1000&q=80",
        "alt": "International youth recognition stage",
        "caption": "Illustrative recognition photo: Selected from over 500,000 young people across more than 50 countries."
      }
    ],
    "sourceNote": "Source: Sarabangla (English), 18 November 2026.",
    "sourceUrl": "https://en.sarabangla.net/achievement/post-53263/bangladeshi-teen-fatiha-ayat-wins-global-promise-award/"
  }
];

const select = (query) => document.querySelector(query);

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function scrollToId(id) {
  const target = select(id);
  if (!target) return;
  if (window.__lenis) { window.__lenis.scrollTo(target); } else { target.scrollIntoView(); }
}

/* Spotlights filtering & See more toggle (index.html + spotlights.html) */
if (window.RiseNewsroom) window.RiseNewsroom.hydrateStories(stories);
const storyGrid = select('#story-grid');
if (storyGrid && window.RiseNewsroom) {
  const publishedStories = window.RiseNewsroom.load().publishedStories || [];
  publishedStories.forEach((ps) => {
    if (document.getElementById(ps.id)) return;
    const card = document.createElement('article');
    card.className = 'spotlight-card';
    card.id = ps.id;
    card.setAttribute('data-categories', ps.cats || ps.category || 'Research');
    card.setAttribute('data-search', `${ps.name} ${ps.achievement} ${ps.category}`);
    const portrait = document.createElement('div');
    portrait.className = 'spotlight-portrait';
    const img = document.createElement('img');
    img.src = ps.localImage || 'nasir%20.jpg';
    img.alt = ps.alt || ps.name;
    img.loading = 'lazy';
    portrait.append(img, textElement('span', 'Newsroom Accepted', 'profile-sample'));
    const copy = document.createElement('div');
    copy.className = 'spotlight-person-copy';
    const badge = textElement('span', ps.achievement, 'achievement-badge research');
    const link = document.createElement('a');
    link.className = 'text-button spotlight-trigger';
    link.href = `story.html?id=${encodeURIComponent(ps.id)}`;
    link.innerHTML = 'Read story <span class="link-mark" aria-hidden="true">+</span>';
    copy.append(textElement('h3', ps.name), badge, textElement('p', ps.summary || ps.achievement), link);
    card.append(portrait, copy);
    storyGrid.prepend(card);
  });
}
const cards = [...document.querySelectorAll('#story-grid .spotlight-card')];
const countPill = select('#reset-filters .count-pill');
if (countPill && cards.length) countPill.textContent = String(cards.length);
const categoryButtons = [...document.querySelectorAll('[data-filter]')];
const searchInput = select('#story-search');
let activeCategory = 'All';
const SEE_MORE_COUNT = 3;
let spotlightsExpanded = false;
const seeMoreRow = select('#see-more-row');
const seeMoreBtn = select('#see-more-spotlights');

function filterStories() {
  if (!storyGrid) return;
  const query = searchInput ? searchInput.value.trim().toLocaleLowerCase() : '';
  const filtering = activeCategory !== 'All' || Boolean(query);
  let count = 0;
  cards.forEach((card) => {
    const categoryMatches = activeCategory === 'All' || (card.dataset.categories || '').split(' ').includes(activeCategory);
    const personMatches = (card.dataset.search || '').toLocaleLowerCase().includes(query);
    card.hidden = !(categoryMatches && personMatches);
    if (!card.hidden) count += 1;
  });
  let shown = 0;
  cards.forEach((card) => {
    if (card.hidden) return;
    shown += 1;
    card.classList.toggle('beyond-see-more', !filtering && !spotlightsExpanded && seeMoreRow && shown > SEE_MORE_COUNT);
  });
  categoryButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === activeCategory)));
  storyGrid.classList.toggle('is-filtered', filtering);
  const emptyState = select('#empty-state');
  if (emptyState) emptyState.hidden = count > 0;
  const filterStatus = select('#filter-status');
  const categoryLabel = activeCategory === 'All' ? '' : ` in ${activeCategory}`;
  if (filterStatus) {
    if (!filtering) {
      filterStatus.textContent = (spotlightsExpanded || !seeMoreRow) ? `Showing all ${cards.length} spotlights` : `Showing ${Math.min(SEE_MORE_COUNT, cards.length)} of ${cards.length} spotlights`;
    } else {
      filterStatus.textContent = `${count} ${count === 1 ? 'spotlight' : 'spotlights'}${categoryLabel}${query && searchInput ? ` matching “${searchInput.value.trim()}”` : ''}`;
    }
  }
  const clearFiltersInline = select('#clear-filters-inline');
  if (clearFiltersInline) clearFiltersInline.hidden = !filtering;
  if (seeMoreRow) seeMoreRow.classList.toggle('is-hidden', filtering || cards.length <= SEE_MORE_COUNT);
  if (seeMoreBtn) {
    seeMoreBtn.setAttribute('aria-expanded', String(spotlightsExpanded));
    const label = seeMoreBtn.querySelector('.see-more-label');
    if (label) label.textContent = spotlightsExpanded ? 'Show less' : 'See more';
    const pill = seeMoreBtn.querySelector('.count-pill');
    if (pill) {
      pill.textContent = `${Math.max(0, cards.length - SEE_MORE_COUNT)} more`;
      pill.hidden = spotlightsExpanded;
    }
  }
}

function resetFilters() {
  activeCategory = 'All';
  if (searchInput) searchInput.value = '';
  spotlightsExpanded = true;
  filterStories();
}

if (storyGrid) {
  categoryButtons.forEach((button) => button.addEventListener('click', () => {
    activeCategory = activeCategory === button.dataset.filter ? 'All' : button.dataset.filter;
    if (activeCategory === 'All') spotlightsExpanded = false;
    filterStories();
    scrollToId('#stories');
  }));

  document.querySelectorAll('[data-pillar-filter]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    if (searchInput) searchInput.value = '';
    activeCategory = link.dataset.pillarFilter;
    filterStories();
    scrollToId('#stories');
  }));

  if (searchInput) searchInput.addEventListener('input', filterStories);
  const resetFiltersBtn = select('#reset-filters');
  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);
  const clearFiltersInlineBtn = select('#clear-filters-inline');
  if (clearFiltersInlineBtn) clearFiltersInlineBtn.addEventListener('click', resetFilters);
  const emptyResetBtn = select('#empty-reset');
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);
  const clearSearchBtn = select('#clear-search');
  if (clearSearchBtn && searchInput) clearSearchBtn.addEventListener('click', () => { searchInput.value = ''; filterStories(); searchInput.focus(); });

  if (seeMoreBtn) seeMoreBtn.addEventListener('click', () => {
    spotlightsExpanded = !spotlightsExpanded;
    filterStories();
    if (!spotlightsExpanded) scrollToId('#stories');
  });

  filterStories();
}

/* Search panel & Main navigation */
const searchToggle = select('#search-toggle');
const searchPanel = select('#search-panel');
function closeSearch() {
  if (!searchPanel || !searchToggle) return;
  searchPanel.hidden = true;
  searchToggle.setAttribute('aria-expanded', 'false');
}
if (searchToggle && searchPanel) {
  searchToggle.addEventListener('click', () => {
    const opening = searchPanel.hidden;
    searchPanel.hidden = !opening;
    searchToggle.setAttribute('aria-expanded', String(opening));
    if (opening && searchInput) searchInput.focus();
  });
} else if (searchToggle) {
  searchToggle.addEventListener('click', () => {
    const newsSearch = select('#news-search');
    if (newsSearch) {
      newsSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newsSearch.focus();
    } else if (siteMenu) {
      openSiteMenu();
    }
  });
}

const menuToggle = select('#menu-toggle');
const mainNav = select('#main-nav');
const siteMenu = select('#site-menu');
const menuClose = select('#menu-close');
const menuSearch = select('#menu-search');
const menuSearchHint = select('#menu-search-hint');

function hideSiteMenu() {
  if (!siteMenu || !menuToggle) return;
  siteMenu.hidden = true;
  document.body.classList.remove('menu-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  if (window.__lenis) window.__lenis.start();
}
function openSiteMenu() {
  if (!siteMenu || !menuToggle) return;
  siteMenu.hidden = false;
  document.body.classList.add('menu-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close menu');
  if (window.__lenis) window.__lenis.stop();
  if (menuClose) menuClose.focus();
}
function closeSiteMenu() {
  hideSiteMenu();
  if (menuToggle) menuToggle.focus();
}

/* Mobile left sidebar */
const mobileSidebar = select('#mobile-sidebar');
const mobileSidebarBackdrop = select('#mobile-sidebar-backdrop');
const mobileSidebarClose = select('#mobile-sidebar-close');
const mobileSidebarSearch = select('#mobile-sidebar-search');
const mobileSidebarSearchHint = select('#mobile-sidebar-search-hint');
const mobileSidebarMore = select('#mobile-sidebar-more');
const mobileSidebarMorePanel = select('#mobile-sidebar-more-panel');
const isMobileMenu = () => window.matchMedia('(max-width: 580px)').matches;

function hideMobileSidebar() {
  if (!mobileSidebar || !mobileSidebarBackdrop || !menuToggle) return;
  mobileSidebar.hidden = true;
  mobileSidebar.classList.remove('open');
  mobileSidebarBackdrop.hidden = true;
  document.body.classList.remove('mobile-sidebar-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  if (window.__lenis) window.__lenis.start();
}
function openMobileSidebar() {
  if (!mobileSidebar || !mobileSidebarBackdrop || !menuToggle) return;
  mobileSidebar.hidden = false;
  mobileSidebarBackdrop.hidden = false;
  requestAnimationFrame(() => mobileSidebar.classList.add('open'));
  document.body.classList.add('mobile-sidebar-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close menu');
  if (window.__lenis) window.__lenis.stop();
  if (mobileSidebarClose) mobileSidebarClose.focus();
}
function closeMobileSidebar() {
  hideMobileSidebar();
  if (menuToggle) menuToggle.focus();
}

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    if (isMobileMenu() && mobileSidebar) {
      mobileSidebar.hidden ? openMobileSidebar() : closeMobileSidebar();
    } else if (siteMenu) {
      siteMenu.hidden ? openSiteMenu() : closeSiteMenu();
    }
  });
}

if (menuClose) menuClose.addEventListener('click', closeSiteMenu);
if (mainNav) {
  mainNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    mainNav.querySelectorAll('a').forEach((item) => item.classList.toggle('active', item === link));
  }));
}

if (siteMenu) {
  siteMenu.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
    hideSiteMenu();
    scrollToId(link.getAttribute('href'));
  }));
  siteMenu.querySelectorAll('[data-menu-filter]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    if (searchInput) searchInput.value = '';
    activeCategory = link.dataset.menuFilter;
    filterStories();
    hideSiteMenu();
    scrollToId('#stories');
  }));
  siteMenu.querySelectorAll('[data-menu-tab]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const tab = select(`[data-tab="${link.dataset.menuTab}"]`);
    if (tab) tab.click();
    hideSiteMenu();
    scrollToId('#trending');
  }));
  if (menuSearch && menuSearchHint) {
    menuSearch.addEventListener('input', () => {
      const query = menuSearch.value.trim();
      if (!query) { menuSearchHint.textContent = ''; return; }
      const qLower = query.toLocaleLowerCase();
      if (select('#news-search')) {
        const count = newsArticles.filter((a) => `${a.headline} ${a.dek} ${a.topic} ${a.author}`.toLocaleLowerCase().includes(qLower)).length;
        menuSearchHint.textContent = `${count} ${count === 1 ? 'article' : 'articles'} matching “${query}” — press Enter to view.`;
      } else {
        const count = cards.filter((card) => (card.dataset.search || '').toLocaleLowerCase().includes(qLower)).length;
        menuSearchHint.textContent = `${count} ${count === 1 ? 'spotlight' : 'spotlights'} matching “${query}” — press Enter to view.`;
      }
    });
    const submitMenuSearch = () => {
      const query = menuSearch.value.trim();
      const newsSearchEl = select('#news-search');
      if (newsSearchEl) {
        newsSearchEl.value = query;
        newsSearchEl.dispatchEvent(new Event('input'));
        hideSiteMenu();
        scrollToId('#news-grid');
        return;
      }
      resetFilters();
      if (searchInput) searchInput.value = query;
      filterStories();
      hideSiteMenu();
      scrollToId('#stories');
    };
    menuSearch.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submitMenuSearch(); } });
    const menuSearchBtn = select('#menu-search-button');
    if (menuSearchBtn) menuSearchBtn.addEventListener('click', submitMenuSearch);
  }
}

if (mobileSidebar) {
  if (mobileSidebarClose) mobileSidebarClose.addEventListener('click', closeMobileSidebar);
  if (mobileSidebarBackdrop) mobileSidebarBackdrop.addEventListener('click', closeMobileSidebar);
  mobileSidebar.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
    hideMobileSidebar();
    scrollToId(link.getAttribute('href'));
  }));
  mobileSidebar.querySelectorAll('[data-menu-filter]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    if (searchInput) searchInput.value = '';
    activeCategory = link.dataset.menuFilter;
    filterStories();
    hideMobileSidebar();
    scrollToId('#stories');
  }));
  mobileSidebar.querySelectorAll('[data-menu-tab]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const tab = select(`[data-tab="${link.dataset.menuTab}"]`);
    if (tab) tab.click();
    hideMobileSidebar();
    scrollToId('#trending');
  }));
  if (mobileSidebarMore && mobileSidebarMorePanel) {
    mobileSidebarMore.addEventListener('click', () => {
      const opening = mobileSidebarMorePanel.hidden;
      mobileSidebarMorePanel.hidden = !opening;
      mobileSidebarMore.setAttribute('aria-expanded', String(opening));
    });
  }
  if (mobileSidebarSearch && mobileSidebarSearchHint) {
    mobileSidebarSearch.addEventListener('input', () => {
      const query = mobileSidebarSearch.value.trim();
      if (!query) { mobileSidebarSearchHint.textContent = ''; return; }
      const qLower = query.toLocaleLowerCase();
      if (select('#news-search')) {
        const count = newsArticles.filter((a) => `${a.headline} ${a.dek} ${a.topic} ${a.author}`.toLocaleLowerCase().includes(qLower)).length;
        mobileSidebarSearchHint.textContent = `${count} ${count === 1 ? 'article' : 'articles'} matching “${query}” — press Enter to view.`;
      } else {
        const count = cards.filter((card) => (card.dataset.search || '').toLocaleLowerCase().includes(qLower)).length;
        mobileSidebarSearchHint.textContent = `${count} ${count === 1 ? 'spotlight' : 'spotlights'} matching “${query}” — press Enter to view.`;
      }
    });
    const submitMobileSidebarSearch = () => {
      const query = mobileSidebarSearch.value.trim();
      const newsSearchEl = select('#news-search');
      if (newsSearchEl) {
        newsSearchEl.value = query;
        newsSearchEl.dispatchEvent(new Event('input'));
        hideMobileSidebar();
        scrollToId('#news-grid');
        return;
      }
      resetFilters();
      if (searchInput) searchInput.value = query;
      filterStories();
      hideMobileSidebar();
      scrollToId('#stories');
    };
    mobileSidebarSearch.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); submitMobileSidebarSearch(); } });
    const mobileSearchBtn = select('#mobile-sidebar-search-button');
    if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', submitMobileSidebarSearch);
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (searchPanel && !searchPanel.hidden) { closeSearch(); if (searchToggle) searchToggle.focus(); }
    if (siteMenu && !siteMenu.hidden) { closeSiteMenu(); }
    if (mobileSidebar && !mobileSidebar.hidden) { closeMobileSidebar(); }
  }
});

/* Newsletter form */
const newsletterForm = select('#newsletter-form');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const emailInput = event.currentTarget.querySelector('input[type="email"]');
    const chosenTopics = [...document.querySelectorAll('#nl-topic-cards input[name="nl-topic"]:checked')].map((cb) => cb.value);
    if (emailInput && window.RiseNewsroom) {
      window.RiseNewsroom.addSubscriber(emailInput.value, window.location.pathname.split('/').pop() || 'index.html', chosenTopics);
    }
    const successEl = select('#newsletter-success');
    if (successEl) successEl.textContent = 'Thanks! You are on the list — saved to The Rise BD Newsroom.';
    event.currentTarget.reset();
  });
}

/* Today's date in topbar */
const todayEl = select('#today');
if (todayEl) {
  const today = new Date();
  todayEl.textContent = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(today);
  todayEl.dateTime = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
}

/* Dedicated Story Page renderer — Newspaper Editorial Layout (story.html?id=...) */
(function () {
  const root = select('#story-article-root');
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get('id');
  const story = stories.find((item) => item.id === requestedId) || stories[0];
  document.title = `${story.name} — The Rise`;

  function createSponsoredBanner(variantClass, sizeLabel, titleText, descText, ctaText) {
    const ad = document.createElement('a');
    ad.className = `ad-slot ${variantClass}`;
    ad.href = 'https://uplcm.com/4/12335958';
    ad.target = '_blank';
    ad.rel = 'noopener noreferrer';
    ad.setAttribute('aria-label', 'Sponsored partner offer');
    const contact = document.createElement('div');
    contact.className = 'ad-contact';
    contact.append(textElement('span', ctaText, 'ad-button ad-cta'));
    ad.append(
      textElement('span', 'SPONSORED', 'ad-label'),
      textElement('span', sizeLabel, 'ad-size'),
      textElement('p', titleText, 'ad-title'),
      textElement('p', descText, 'ad-text'),
      contact
    );
    return ad;
  }

  function createInlineFigure(photo) {
    const fig = document.createElement('figure');
    fig.className = 'story-inline-figure';
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.alt;
    img.loading = 'lazy';
    if (photo.className) img.className = photo.className;
    const cap = textElement('figcaption', photo.caption);
    fig.append(img, cap);
    return fig;
  }

  const layout = document.createElement('div');
  layout.className = 'story-newspaper-layout';

  const article = document.createElement('article');
  article.className = 'profile-article story-page-article';

  const head = document.createElement('div');
  head.className = 'profile-dialog-head story-page-head';

  let portrait;
  if (story.monogram) {
    portrait = document.createElement('div');
    portrait.className = 'profile-dialog-monogram';
    portrait.style.background = story.color || '#6335EB';
    portrait.textContent = story.monogram;
  } else {
    portrait = document.createElement('img');
    portrait.src = story.localImage || '';
    portrait.alt = story.alt;
    portrait.className = story.localImage ? 'profile-dialog-portrait nasir-photo' : 'profile-dialog-portrait';
  }

  const intro = document.createElement('div');
  intro.className = 'profile-dialog-intro';
  const title = textElement('h1', story.name);
  title.className = 'story-page-title';
  intro.append(
    textElement('p', `COMMUNITY PROFILE · FEATURED ${story.featuredDate.toUpperCase()}`, 'eyebrow'),
    title,
    textElement('span', story.achievement, `achievement-badge ${story.category.toLowerCase()}`),
    textElement('p', story.summary, 'profile-dialog-summary'),
    textElement('p', story.localImage ? 'Photograph and achievement details supplied to The Rise.' : 'No photograph supplied. Achievement details as reported in the press.', 'profile-disclaimer')
  );
  head.append(portrait, intro);
  article.append(head);

  const body = document.createElement('div');
  body.className = 'profile-story-body story-page-body';
  body.append(textElement('h2', story.headline || 'The story behind the achievement'));

  const byline = document.createElement('div');
  byline.className = 'story-byline-bar';
  byline.append(
    textElement('span', `By The Rise Editorial Desk · ${story.featuredDate}`),
    textElement('span', `${story.category} · 3 min read`)
  );
  body.append(byline);

  const gallery = Array.isArray(story.gallery) ? story.gallery : [];
  story.body.forEach((paragraph, index) => {
    const p = textElement('p', paragraph, index === 0 ? 'story-lead-paragraph' : '');
    body.append(p);

    if (index === 0 && gallery[0]) {
      body.append(createInlineFigure(gallery[0]));
    }
    if (index === 1) {
      body.append(createSponsoredBanner(
        'story-inline-ad',
        '728 × 90 IN-ARTICLE BANNER',
        'Partner Spotlight & Recommended Offers',
        'Click to explore verified deals and resources supporting The Rise.',
        'Visit Sponsor →'
      ));
    }
    if (index === 2 && gallery[1]) {
      body.append(createInlineFigure(gallery[1]));
    }
  });

  body.append(textElement('h3', 'The milestone, in three parts'));

  const journey = document.createElement('ol');
  journey.className = 'profile-journey';
  story.journey.forEach(([heading, description]) => {
    const step = document.createElement('li');
    step.append(textElement('h4', heading), textElement('p', description));
    journey.append(step);
  });
  body.append(journey);

  if (story.quote) {
    const quote = textElement('blockquote', `“${story.quote}”`, 'profile-advice');
    quote.append(textElement('cite', `Advice from ${story.name}`));
    body.append(quote);
  }

  body.append(textElement('p', story.sourceNote, 'dialog-note'));
  if (story.sourceUrl) {
    const sourceLink = document.createElement('a');
    sourceLink.className = 'dialog-source-link';
    sourceLink.href = story.sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'Read the news report →';
    body.append(sourceLink);
  }

  body.append(createSponsoredBanner(
    'story-bottom-ad',
    '728 × 90 END-OF-STORY BANNER',
    'Recommended for Readers',
    'Click to check out curated deals and partner announcements.',
    'Explore Partner Offer →'
  ));

  article.append(body);

  const sidebar = document.createElement('aside');
  sidebar.className = 'story-sidebar';
  sidebar.setAttribute('aria-label', 'Story facts and partner column');

  const factsCard = document.createElement('div');
  factsCard.className = 'story-facts-card';
  factsCard.append(textElement('span', 'AT A GLANCE', 'ad-label'));
  factsCard.append(textElement('h3', story.name));
  const factsList = document.createElement('dl');
  factsList.className = 'story-facts-list';
  [
    ['Field', story.category],
    ['Recognition', story.achievement],
    ['Featured', story.featuredDate],
    ['Verification', story.sourceUrl ? 'Press-reported & sourced' : 'Community-submitted']
  ].forEach(([term, val]) => {
    factsList.append(textElement('dt', term), textElement('dd', val));
  });
  factsCard.append(factsList);
  const nomBtn = textElement('a', 'Nominate Someone →', 'button navy');
  nomBtn.href = 'nominate.html';
  factsCard.append(nomBtn);

  const tallAd = createSponsoredBanner(
    'ad-skyscraper story-sidebar-ad',
    '300 × 600 VERTICAL COLUMN',
    'Featured Brand Column',
    'High-visibility vertical sponsor placement right beside full spotlight articles.',
    'Explore Offer →'
  );

  sidebar.append(factsCard, tallAd);
  layout.append(article, sidebar);
  root.replaceChildren(layout);

  const moreGrid = select('#more-stories-grid');
  if (moreGrid) {
    const others = stories.filter((item) => item.id !== story.id).slice(0, 3);
    others.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'spotlight-card';

      const visual = document.createElement('div');
      visual.className = 'spotlight-portrait';
      if (item.localImage) {
        const img = document.createElement('img');
        img.src = item.localImage;
        img.alt = item.alt;
        img.className = 'nasir-photo';
        img.loading = 'lazy';
        visual.append(img);
      } else {
        const mono = document.createElement('div');
        mono.className = 'spotlight-monogram';
        mono.style.background = item.color || '#6335EB';
        mono.textContent = item.monogram || item.name.slice(0, 2).toUpperCase();
        visual.append(mono);
      }

      const copy = document.createElement('div');
      copy.className = 'spotlight-person-copy';
      const link = document.createElement('a');
      link.className = 'text-button spotlight-trigger';
      link.href = `story.html?id=${encodeURIComponent(item.id)}`;
      link.innerHTML = 'Read their story <span class="link-mark" aria-hidden="true">+</span>';
      copy.append(
        textElement('h3', item.name),
        textElement('span', item.achievement, `achievement-badge ${item.category.toLowerCase()}`),
        textElement('p', item.summary),
        link
      );

      card.append(visual, copy);
      moreGrid.append(card);
    });
  }
})();

/* Dedicated Nomination Form Page (nominate.html) */
(function () {
  const form = select('#nomination-form');
  if (!form) return;

  const articleInput = select('#nom-article');
  const wordCountEl = select('#nom-word-count');
  const photosInput = select('#nom-photos');
  const proofsInput = select('#nom-proofs');
  const photosPreview = select('#nom-photos-preview');
  const proofsPreview = select('#nom-proofs-preview');
  const errorEl = select('#nom-error');
  const resultEl = select('#nom-result');
  const summaryBox = select('#nom-summary-box');
  const sendEmailBtn = select('#nom-send-email');
  const sendWaBtn = select('#nom-send-whatsapp');
  const copyBtn = select('#nom-copy-btn');
  const copyStatus = select('#nom-copy-status');

  let articleFiles = [];
  let proofFiles = [];
  let lastFormattedText = '';

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function renderFilePreviews(list, container, onRemove) {
    if (!container) return;
    container.replaceChildren();
    list.forEach((file, idx) => {
      const card = document.createElement('div');
      card.className = 'upload-thumb-card';
      const img = document.createElement('img');
      img.alt = file.name;
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);

      const meta = document.createElement('div');
      meta.className = 'upload-thumb-meta';
      meta.append(
        textElement('span', file.name, 'upload-thumb-name'),
        textElement('small', formatSize(file.size), 'upload-thumb-size')
      );

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'upload-thumb-remove';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => onRemove(idx));

      card.append(img, meta, removeBtn);
      container.append(card);
    });
  }

  function refreshArticlePreviews() {
    renderFilePreviews(articleFiles, photosPreview, (idx) => {
      articleFiles.splice(idx, 1);
      refreshArticlePreviews();
    });
  }

  function refreshProofPreviews() {
    renderFilePreviews(proofFiles, proofsPreview, (idx) => {
      proofFiles.splice(idx, 1);
      refreshProofPreviews();
    });
  }

  if (photosInput) {
    photosInput.addEventListener('change', () => {
      const incoming = [...photosInput.files].filter((f) => f.type.startsWith('image/'));
      articleFiles = articleFiles.concat(incoming);
      photosInput.value = '';
      refreshArticlePreviews();
    });
  }

  if (proofsInput) {
    proofsInput.addEventListener('change', () => {
      const incoming = [...proofsInput.files].filter((f) => f.type.startsWith('image/'));
      proofFiles = proofFiles.concat(incoming);
      proofsInput.value = '';
      refreshProofPreviews();
    });
  }

  if (articleInput && wordCountEl) {
    articleInput.addEventListener('input', () => {
      const words = articleInput.value.trim() ? articleInput.value.trim().split(/\s+/).length : 0;
      wordCountEl.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (errorEl) errorEl.textContent = '';
    if (!form.reportValidity()) {
      if (errorEl) errorEl.textContent = 'Please complete all required fields highlighted above.';
      return;
    }

    const name = select('#nom-name').value.trim();
    const whatsapp = select('#nom-whatsapp').value.trim();
    const email = select('#nom-email').value.trim();
    const address = select('#nom-address').value.trim();
    const category = select('#nom-category').value;
    const achievement = select('#nom-achievement').value.trim();
    const articleTitle = select('#nom-title').value.trim();
    const articleBody = select('#nom-article').value.trim();
    const proofLink = select('#nom-link').value.trim();

    if (proofFiles.length === 0 && !proofLink) {
      if (errorEl) errorEl.textContent = 'Please upload at least one proof document image (certificate, award letter, or participation screenshot) or provide a public verification link.';
      const proofBox = select('.proof-box');
      if (proofBox) proofBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const photoNames = articleFiles.length ? articleFiles.map((f) => f.name).join(', ') : 'None selected (please attach if available)';
    const proofNames = proofFiles.length ? proofFiles.map((f) => f.name).join(', ') : 'None (using public link)';

    if (window.RiseNewsroom) {
      window.RiseNewsroom.submitNomination({
        name,
        whatsapp,
        email,
        address,
        category,
        achievement,
        headline: articleTitle,
        bodyText: articleBody,
        proofLink,
        photoNames,
        proofNames
      });
    }

    lastFormattedText = [
      'THE RISE — STORY & NOMINATION SUBMISSION',
      '----------------------------------------',
      `Full Name: ${name}`,
      `Address: ${address}`,
      `Email: ${email}`,
      `WhatsApp: ${whatsapp}`,
      `Category: ${category}`,
      `Achievement / Award: ${achievement}`,
      `Article Headline: ${articleTitle}`,
      proofLink ? `Public Verification Link: ${proofLink}` : '',
      `Attached Article Photos (${articleFiles.length}): ${photoNames}`,
      `Attached Proof Images (${proofFiles.length}): ${proofNames}`,
      '',
      'FULL ARTICLE:',
      articleBody
    ].filter(Boolean).join('\n');

    if (summaryBox) {
      summaryBox.replaceChildren();
      const rows = [
        ['Name', name],
        ['Address', address],
        ['Email', email],
        ['WhatsApp', whatsapp],
        ['Category', category],
        ['Achievement', achievement],
        ['Headline', articleTitle],
        ['Article Photos', `${articleFiles.length} file(s): ${photoNames}`],
        ['Proof Images', `${proofFiles.length} file(s): ${proofNames}`]
      ];
      if (proofLink) rows.push(['Reference Link', proofLink]);
      rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'nom-summary-row';
        row.append(textElement('strong', `${label}:`), textElement('span', value));
        summaryBox.append(row);
      });
    }

    const subject = `The Rise Submission — ${name} (${achievement})`;
    if (sendEmailBtn) {
      sendEmailBtn.href = `mailto:hello@therisebd.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lastFormattedText)}`;
    }
    if (sendWaBtn) {
      sendWaBtn.href = `https://wa.me/8801643442518?text=${encodeURIComponent(lastFormattedText)}`;
    }
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!lastFormattedText) return;
      try {
        await navigator.clipboard.writeText(lastFormattedText);
        if (copyStatus) copyStatus.textContent = 'Submission text copied to clipboard!';
      } catch (e) {
        if (copyStatus) copyStatus.textContent = 'Could not auto-copy — please use Email or WhatsApp above.';
      }
    });
  }
})();

/* Hover-expand floating nav (story.html, nominate.html, standards.html) */
(function () {
  if (document.body.classList.contains('advertise-page')) return;
  const hoverNav = select('#hover-nav');
  const hoverToggle = select('#hover-nav-toggle');
  if (!hoverNav || !hoverToggle) return;
  hoverToggle.addEventListener('click', () => {
    const open = hoverNav.classList.toggle('is-open');
    hoverToggle.setAttribute('aria-expanded', String(open));
    if (open) hoverNav.classList.remove('is-dismissed');
    else { hoverNav.classList.add('is-dismissed'); hoverToggle.blur(); }
  });
  hoverNav.addEventListener('mouseleave', () => {
    hoverNav.classList.remove('is-open');
    hoverNav.classList.remove('is-dismissed');
    hoverToggle.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hoverNav.classList.remove('is-open');
      hoverNav.classList.add('is-dismissed');
      hoverToggle.setAttribute('aria-expanded', 'false');
      hoverToggle.blur();
    }
  });
  let lastScrollY = window.scrollY || 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY || 0;
    if (y > 140 && y > lastScrollY && !hoverNav.classList.contains('is-open')) hoverNav.classList.add('hover-nav-hidden');
    else if (y < lastScrollY || y <= 140) hoverNav.classList.remove('hover-nav-hidden');
    lastScrollY = y;
  }, { passive: true });
})();

/* Scroll experience: Framer-style slow glide (Lenis) + gentle reveal + soft hero parallax. */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.07, smoothWheel: true });
    window.__lenis = lenis;
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      const target = href && href.length > 1 ? document.querySelector(href) : null;
      if (target) {
        event.preventDefault();
        lenis.scrollTo(target);
      }
    }));
  }
  if (reduceMotion) return;
  const revealTargets = document.querySelectorAll('.hero, main section');
  revealTargets.forEach((el) => el.classList.add('reveal'));
  const revealVisible = () => {
    const viewBottom = window.innerHeight + 120;
    revealTargets.forEach((el) => {
      if (el.classList.contains('in')) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0 && rect.top <= viewBottom) {
        el.classList.add('in');
      }
    });
  };
  if (typeof IntersectionObserver === 'undefined') {
    revealTargets.forEach((el) => el.classList.add('in'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 120px 0px' });
    revealTargets.forEach((el) => observer.observe(el));
    window.addEventListener('scroll', revealVisible, { passive: true });
    revealVisible();
  }
  const magazine = document.querySelector('.open-magazine');
  if (magazine) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 600);
        magazine.style.transform = 'translateY(' + (y * 0.06) + 'px) rotate(-2deg)';
        ticking = false;
      });
    }, { passive: true });
  }
})();

/* Top Spotlights tabs, Quote of the Day rotator, back-to-top button. */
(function () {
  const tabs = document.querySelectorAll('.trending-tab');
  const panels = document.querySelectorAll('.trending-list');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
    panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
  }));
  const quotes = [
    ['“It always seems impossible until it’s done.”', '— Nelson Mandela'],
    ['“The best way to predict the future is to invent it.”', '— Alan Kay'],
    ['“Whether you think you can or you think you can’t, you’re right.”', '— Henry Ford'],
    ['“The future belongs to those who believe in the beauty of their dreams.”', '— Eleanor Roosevelt']
  ];
  let quoteIndex = 0;
  const quoteBox = document.querySelector('#quote-box');
  const quoteText = document.querySelector('#quote-text');
  const quoteAuthor = document.querySelector('#quote-author');
  const nextQuote = document.querySelector('#next-quote');
  if (quoteBox && nextQuote) {
    nextQuote.addEventListener('click', () => {
      quoteBox.classList.add('fading');
      window.setTimeout(() => {
        quoteIndex = (quoteIndex + 1) % quotes.length;
        quoteText.textContent = quotes[quoteIndex][0];
        quoteAuthor.textContent = quotes[quoteIndex][1];
        quoteBox.classList.remove('fading');
      }, 300);
    });
  }
  const backToTop = document.querySelector('#back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.hidden = window.scrollY < 600;
    }, { passive: true });
    backToTop.addEventListener('click', () => {
      if (window.__lenis) { window.__lenis.scrollTo(0); }
      else { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    });
  }
})();

/* Mega menu: Stories dropdown (hover on desktop + click/keyboard accessible) */
(function () {
  var toggle = document.querySelector('#stories-toggle');
  var menu = document.querySelector('#stories-menu');
  if (!toggle || !menu) return;
  var dropdown = toggle.closest('.nav-dropdown') || toggle.parentElement;
  var closeTimer = null;

  var cancelClose = function () {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
  };
  var openMega = function () {
    cancelClose();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };
  var closeMega = function () {
    cancelClose();
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  var scheduleClose = function () {
    cancelClose();
    closeTimer = window.setTimeout(closeMega, 180);
  };

  if (dropdown) {
    dropdown.addEventListener('mouseenter', function () {
      if (window.innerWidth > 580) openMega();
    });
    dropdown.addEventListener('mouseleave', function () {
      if (window.innerWidth > 580) scheduleClose();
    });
  }
  menu.addEventListener('mouseenter', function () {
    if (window.innerWidth > 580) cancelClose();
  });

  toggle.addEventListener('click', function (event) {
    event.stopPropagation();
    if (menu.hidden) openMega();
    else closeMega();
  });
  menu.querySelectorAll('a, button').forEach(function (item) {
    item.addEventListener('click', closeMega);
  });
  menu.querySelectorAll('[data-menu-filter]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      if (searchInput) searchInput.value = '';
      activeCategory = link.dataset.menuFilter;
      filterStories();
      closeMega();
      scrollToId('#stories');
    });
  });
  document.addEventListener('click', function (event) {
    if (!menu.hidden && !menu.contains(event.target) && (!dropdown || !dropdown.contains(event.target))) closeMega();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMega();
  });
})();

/* Careers & Campus Ambassador / Volunteer forms (careers.html & ambassador.html) */
(function () {
  var roleSelect = document.getElementById('car-role');
  document.querySelectorAll('.apply-role-btn[data-role]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (roleSelect && btn.dataset.role) {
        roleSelect.value = btn.dataset.role;
      }
      var target = document.getElementById('apply');
      if (target) {
        if (window.__lenis) { window.__lenis.scrollTo(target, { offset: -20 }); }
        else { target.scrollIntoView({ behavior: 'smooth' }); }
      }
      var nameEl = document.getElementById('car-name');
      if (nameEl) nameEl.focus({ preventScroll: true });
    });
  });

  function bindApplicationForm(cfg) {
    var form = document.getElementById(cfg.formId);
    if (!form) return;
    var errEl = document.getElementById(cfg.errorId);
    var resEl = document.getElementById(cfg.resultId);
    var mailBtn = document.getElementById(cfg.mailId);
    var waBtn = document.getElementById(cfg.waId);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (errEl) errEl.textContent = '';
      var values = {};
      for (var i = 0; i < cfg.fields.length; i++) {
        var f = cfg.fields[i];
        var el = document.getElementById(f.id);
        var val = el ? String(el.value || '').trim() : '';
        if (f.required && !val) {
          if (errEl) errEl.textContent = 'Please complete all required fields (' + f.label + ').';
          if (el) el.focus();
          return;
        }
        values[f.label] = val || '—';
      }

      var lines = [cfg.header, '===================================='];
      Object.keys(values).forEach(function (k) {
        lines.push(k + ': ' + values[k]);
      });
      var packet = lines.join('\n');
      var subject = cfg.subjectPrefix + (values[cfg.subjectField] || 'Application');

      var prefix = cfg.formId === 'ambassador-form' ? 'AMBASSADOR:' : 'CAREER:';
      var slotVal = prefix + (values[cfg.subjectField] || 'General');
      var applicantName = values['Full Name'] || 'Applicant';
      var applicantContact = (values['Email Address'] || '') + ' | ' + (values['WhatsApp Number'] || '');
      var msgJson = JSON.stringify(values);
      try {
        var st = load();
        if (!Array.isArray(st.adsQueue)) st.adsQueue = [];
        st.adsQueue.unshift({
          id: 'app-' + Date.now(),
          status: 'new',
          name: applicantName,
          company: applicantContact,
          slot: slotVal,
          message: msgJson,
          submittedAt: new Date().toISOString()
        });
        save(st);
      } catch (e) {}
      if (window.RiseSupabase && typeof window.RiseSupabase.restFetch === 'function') {
        window.RiseSupabase.restFetch('ad_inquiries', {
          method: 'POST',
          body: { name: applicantName, company: applicantContact, slot: slotVal, message: msgJson }
        }).catch(function () {});
      }

      if (mailBtn) {
        mailBtn.href = 'mailto:hello@therisebd.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(packet);
      }
      if (waBtn) {
        waBtn.href = 'https://wa.me/8801643442518?text=' + encodeURIComponent(packet);
      }
      if (resEl) {
        resEl.hidden = false;
        resEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  bindApplicationForm({
    formId: 'career-form',
    errorId: 'car-error',
    resultId: 'car-result',
    mailId: 'car-send-email',
    waId: 'car-send-wa',
    header: 'THE RISE — CAREERS & JOB APPLICATION',
    subjectPrefix: 'The Rise Career Application — ',
    subjectField: 'Position',
    fields: [
      { id: 'car-name', label: 'Full Name', required: true },
      { id: 'car-whatsapp', label: 'WhatsApp Number', required: true },
      { id: 'car-email', label: 'Email Address', required: true },
      { id: 'car-city', label: 'City / Country', required: true },
      { id: 'car-role', label: 'Position', required: true },
      { id: 'car-portfolio', label: 'Portfolio / CV / LinkedIn', required: false },
      { id: 'car-note', label: 'Short Pitch', required: true }
    ]
  });

  bindApplicationForm({
    formId: 'ambassador-form',
    errorId: 'amb-error',
    resultId: 'amb-result',
    mailId: 'amb-send-email',
    waId: 'amb-send-wa',
    header: 'THE RISE — CAMPUS AMBASSADOR & VOLUNTEER APPLICATION',
    subjectPrefix: 'The Rise Community Application — ',
    subjectField: 'Program Track',
    fields: [
      { id: 'amb-name', label: 'Full Name', required: true },
      { id: 'amb-whatsapp', label: 'WhatsApp Number', required: true },
      { id: 'amb-email', label: 'Email Address', required: true },
      { id: 'amb-city', label: 'City / District', required: true },
      { id: 'amb-track', label: 'Program Track', required: true },
      { id: 'amb-inst', label: 'University / College / Workplace', required: true },
      { id: 'amb-social', label: 'LinkedIn / Facebook Profile', required: false },
      { id: 'amb-why', label: 'Motivation & Impact Plan', required: true }
    ]
  });
})();

/* Newsroom / Articles Data, Articles Page, Article Reader & Submission Form */
const newsAuthors = {
  akif: {
    id: 'akif',
    name: 'Mohammed Ahanaf Akif Rahman',
    photo: 'akif-profile.jpg',
    location: 'Dhaka, Bangladesh',
    role: 'MSc in Cyber Security, Daffodil International University',
    tagline: 'Researcher, Cyber Security Graduate Student & Editorial Contributor',
    bio: 'Mohammed Ahanaf Akif Rahman is a Dhaka-based researcher and MSc candidate in Cyber Security at Daffodil International University. Alongside his work in cybersecurity and digital systems, he collaborates with interdisciplinary teams across Bangladeshi universities on climate governance, institutional policy, and sustainable development research.',
    history: [
      'Co-Author — "Climate Governance and Local Sustainable Development: Institutional Capacity and Policy Implementation in Bangladesh" (British Journal of Arts and Humanities, 8(5), 819–833, 2026)',
      'MSc in Cyber Security — Daffodil International University, Dhaka, Bangladesh',
      'Editorial Contributor & Research Writer — The Rise Newsroom'
    ],
    links: [
      { label: 'View Published Paper (DOI)', url: 'https://doi.org/10.34104/bjah.02608190833' },
      { label: 'Journal Homepage (UniversePG)', url: 'https://www.universepg.com/journal/bjah' }
    ]
  }
};

if (window.RiseNewsroom) window.RiseNewsroom.hydrateAuthors(newsAuthors);

const newsArticles = [
  {
    id: 'climate-governance-bangladesh-local-capacity',
    topic: 'Policy & Society',
    badgeClass: 'policy',
    headline: 'Why National Climate Policies Struggle at Bangladesh’s Local Level — And What Must Change',
    dek: 'A peer-reviewed study co-authored by researchers from seven Bangladeshi universities examines why strong national climate frameworks often stall between central ministries and local government institutions.',
    authorId: 'akif',
    author: 'Mohammed Ahanaf Akif Rahman',
    affiliation: 'MSc in Cyber Security, Daffodil International University · Dhaka',
    date: '8 September 2026',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1200&q=80',
    imageCaption: 'Riverine and coastal communities across Bangladesh face recurring floods, cyclones, and salinity—putting local institutions on the frontlines.',
    inlinePhotos: [
      {
        src: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1000&q=80',
        alt: 'Clean energy and climate resilience infrastructure',
        caption: 'Bridging national climate commitments and local outcomes requires dedicated technical capacity, climate finance, and resilient infrastructure.'
      },
      {
        src: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=1000&q=80',
        alt: 'Community stakeholders collaborating on local resilience',
        caption: 'Meaningful community participation ensures local priorities—not only top-down directives—guide climate adaptation planning.'
      }
    ],
    charts: {
      participantsTitle: 'Study Sample Breakdown (Table 1: 30 KIIs & 6 FGDs · ~70–78 Participants)',
      participants: [
        { label: 'Climate-Affected Community Members (FGDs)', count: 28, display: '24–32' },
        { label: 'Local Leaders & Livelihood Groups (FGDs)', count: 18, display: '16–20' },
        { label: 'Local Government Representatives (KIIs)', count: 12, display: '12' },
        { label: 'Government Officials (KIIs)', count: 8, display: '8' },
        { label: 'NGO & Development Practitioners (KIIs)', count: 6, display: '6' },
        { label: 'Climate Policy & Adaptation Experts (KIIs)', count: 4, display: '4' }
      ],
      themesTitle: 'Core Governance Challenges Identified (Table 2)',
      themes: [
        ['Institutional Capacity Limitations', 'Limited technical expertise, inadequate staffing, and weak planning capacity at local level.'],
        ['Financial & Resource Constraints', 'Heavy dependence on external projects, delayed allocations, and low local fiscal autonomy.'],
        ['Multi-Level Governance Challenges', 'Weak vertical & horizontal coordination and fragmented responsibilities across agencies.'],
        ['Policy Implementation Gaps', 'Mismatch between national policy goals and local realities, with limited monitoring.'],
        ['Community Participation & Inclusion', 'Communities treated as passive beneficiaries rather than active co-planners.'],
        ['Institutional Strengthening Pathways', 'Decentralization, targeted training, direct climate finance, and integrated planning.']
      ]
    },
    highlights: [
      'Qualitative institutional case study drawing on 30 Key Informant Interviews (KIIs) and 6 Focus Group Discussions (FGDs).',
      'Identifies 4 decisive capacity pillars: Administrative, Technical, Financial, and Coordination capacity.',
      'Shows that national frameworks (BCCSAP, National Adaptation Plan) falter locally without decentralized authority and funding.',
      'Recommends shifting from short-term isolated projects to integrated, community-embedded local climate governance.'
    ],
    body: [
      'Bangladesh is widely recognized for building ambitious national climate policy frameworks—from the Bangladesh Climate Change Strategy and Action Plan (BCCSAP) and the Climate Change Trust Fund to the National Adaptation Plan. Yet on the frontlines of cyclones, river erosion, flooding, and salinity intrusion, the gap between national policy commitments and local execution remains wide.',
      'In a newly published peer-reviewed study in the British Journal of Arts and Humanities (Vol. 8, Issue 5, 2026), researchers from seven Bangladeshi universities—including Mohammed Ahanaf Akif Rahman of Daffodil International University alongside lead author Md. Rajiur Rahman Arif (University of Chittagong) and co-authors from State University of Bangladesh, Green University, BUP, Canadian University of Bangladesh, and Jagannath University—investigated why local government institutions struggle to turn climate policies into durable resilience.',
      'Using a qualitative institutional case study approach, the team conducted 30 Key Informant Interviews (KIIs) with local government representatives, central officials, NGO practitioners, and climate experts, alongside six Focus Group Discussions (FGDs) involving 40–48 community members and local leaders—triangulated with national policy documents.',
      'The findings point to four interconnected dimensions that determine whether local climate governance succeeds: administrative capacity, technical expertise, financial resources, and inter-institutional coordination. While Union Parishads, Upazila Parishads, and municipalities are expected to lead local adaptation, their responsibilities have expanded far faster than their staffing, climate-risk assessment skills, or independent budgets.',
      'Equally critical is the disconnect across governance levels. Local actors frequently operate as passive implementers of top-down or project-driven directives rather than active contributors to policy design, while climate-affected communities are often consulted only after plans are already set—limiting both local ownership and long-term sustainability.',
      'To close this implementation gap, the study calls for long-term institutional capacity building, simpler and more direct access to climate finance for local governments, stronger vertical and horizontal coordination between ministries, NGOs, and local bodies, and genuine community participation in planning and monitoring.'
    ],
    quote: 'Effective climate governance requires more than strong national policy documents—it depends on local institutions having the technical skills, funding, and coordination to act.',
    sources: 'Published peer-reviewed research article in British Journal of Arts and Humanities, 8(5), 819–833 (2026).',
    journal: {
      name: 'British Journal of Arts and Humanities',
      volume: 'Vol. 8, Issue 5, pp. 819–833 (Published: 8 September 2026)',
      publisher: 'UniversePG (eISSN: 2663-7782)',
      doiUrl: 'https://doi.org/10.34104/bjah.02608190833',
      journalUrl: 'https://www.universepg.com/journal/bjah',
      citation: 'Arif MRR, Sutradhar BC, Shawon SE, Fuad SMMA, Rahman MAK, Uddin N, Foysal AM. (2026). Climate governance and local sustainable development: institutional capacity and policy implementation in Bangladesh, Br. J. Arts Humanit., 8(5), 819–833.'
    }
  }
];

function createSponsoredAdCard(variantClass, sizeLabel, titleText, descText, ctaText) {
  const ad = document.createElement('a');
  ad.className = `ad-slot ${variantClass}`;
  ad.href = 'https://uplcm.com/4/12335958';
  ad.target = '_blank';
  ad.rel = 'noopener noreferrer';
  ad.setAttribute('aria-label', 'Sponsored partner offer');
  const contact = document.createElement('div');
  contact.className = 'ad-contact';
  contact.append(textElement('span', ctaText, 'ad-button ad-cta'));
  ad.append(
    textElement('span', 'SPONSORED', 'ad-label'),
    textElement('span', sizeLabel, 'ad-size'),
    textElement('p', titleText, 'ad-title'),
    textElement('p', descText, 'ad-text'),
    contact
  );
  return ad;
}

if (window.RiseNewsroom) window.RiseNewsroom.hydrateArticles(newsArticles);

/* Homepage Latest Article Card Sync (Vertical Compact Layout + Top Cover Photo + Clickable) */
(function () {
  const homeLatest = select('#home-latest-article');
  if (!homeLatest || !newsArticles[0]) return;
  const art = newsArticles[0];
  const artUrl = `article.html?id=${encodeURIComponent(art.id)}`;
  homeLatest.replaceChildren();

  const mediaLink = document.createElement('a');
  mediaLink.className = 'dual-cover-media';
  mediaLink.href = artUrl;
  mediaLink.setAttribute('aria-label', art.headline);
  const img = document.createElement('img');
  img.src = art.image || 'nasir%20.jpg';
  img.alt = art.headline;
  img.loading = 'lazy';
  img.onerror = function () { this.src = 'nasir%20.jpg'; };
  mediaLink.append(img);

  const eyebrow = textElement('p', `${String(art.topic || 'News').toUpperCase()} · ${String(art.date || '').toUpperCase()}`, 'eyebrow');
  const h3 = document.createElement('h3');
  const h3Link = textElement('a', art.headline);
  h3Link.href = artUrl;
  h3.append(h3Link);

  const shortDek = String(art.dek || '').length > 105 ? `${String(art.dek).slice(0, 102)}…` : (art.dek || '');
  const dek = textElement('p', shortDek, 'dual-dek');
  const meta = document.createElement('div');
  meta.className = 'dual-article-meta';
  const authorSpan = document.createElement('span');
  authorSpan.innerHTML = '<strong>By:</strong> ';
  if (art.authorId && newsAuthors[art.authorId]) {
    const aLink = textElement('a', art.author);
    aLink.href = `author.html?id=${encodeURIComponent(art.authorId)}`;
    authorSpan.append(aLink);
  } else {
    authorSpan.append(document.createTextNode(art.author));
  }
  const readSpan = textElement('span', art.readTime || '4 min read');
  meta.append(authorSpan, readSpan);

  const actions = document.createElement('div');
  actions.className = 'dual-actions';
  const readBtn = textElement('a', 'Read Article →', 'button dual-btn-article');
  readBtn.href = artUrl;
  const allBtn = textElement('a', 'All Articles', 'button dual-btn-ghost-dark');
  allBtn.href = 'articles.html';
  actions.append(readBtn, allBtn);

  homeLatest.append(mediaLink, eyebrow, h3, dek, meta, actions);
})();

/* Articles Newsroom Front Page (articles.html) */
(function () {
  const grid = select('#news-grid');
  if (!grid) return;
  const leadSlot = select('#news-lead-slot');
  const railList = select('#news-rail-list');
  const frontSec = select('#news-front');
  const emptyEl = select('#news-empty');
  const countEl = select('#news-count-status');
  const searchEl = select('#news-search');
  const resetBtn = select('#news-reset-btn');
  const filterBtns = [...document.querySelectorAll('[data-news-cat]')];

  let activeTopic = 'All';

  function buildNewsCard(article) {
    const card = document.createElement('article');
    card.className = 'news-card';

    const media = document.createElement('a');
    media.className = 'news-card-media';
    media.href = `article.html?id=${encodeURIComponent(article.id)}`;
    const img = document.createElement('img');
    img.src = article.image;
    img.alt = article.headline;
    img.loading = 'lazy';
    media.append(img, textElement('span', article.topic, `news-topic-tag ${article.badgeClass}`));

    const body = document.createElement('div');
    body.className = 'news-card-body';

    const meta = document.createElement('div');
    meta.className = 'news-card-meta';
    meta.append(textElement('span', article.date), textElement('span', `· ${article.readTime}`));

    const titleLink = document.createElement('a');
    titleLink.className = 'news-card-title';
    titleLink.href = `article.html?id=${encodeURIComponent(article.id)}`;
    titleLink.textContent = article.headline;

    const dek = textElement('p', article.dek, 'news-card-dek');

    const foot = document.createElement('div');
    foot.className = 'news-card-foot';
    if (article.authorId && newsAuthors[article.authorId]) {
      const aLink = textElement('a', `By ${article.author}`, 'news-card-author news-author-link');
      aLink.href = `author.html?id=${encodeURIComponent(article.authorId)}`;
      foot.append(aLink);
    } else {
      foot.append(textElement('span', `By ${article.author}`, 'news-card-author'));
    }
    const readMore = textElement('a', 'Read article →', 'news-card-link');
    readMore.href = `article.html?id=${encodeURIComponent(article.id)}`;
    foot.append(readMore);

    body.append(meta, titleLink, dek, foot);
    card.append(media, body);
    return card;
  }

  function renderLeadAndRail() {
    if (leadSlot && newsArticles[0]) {
      const lead = newsArticles[0];
      const leadCard = document.createElement('article');
      leadCard.className = 'news-lead-card';

      const imgWrap = document.createElement('a');
      imgWrap.className = 'news-lead-media';
      imgWrap.href = `article.html?id=${encodeURIComponent(lead.id)}`;
      const img = document.createElement('img');
      img.src = lead.image;
      img.alt = lead.headline;
      imgWrap.append(img, textElement('span', `LEAD DISPATCH · ${lead.topic.toUpperCase()}`, 'news-lead-badge'));

      const copy = document.createElement('div');
      copy.className = 'news-lead-copy';
      const meta = textElement('p', `${lead.date} · ${lead.readTime} · By ${lead.author}`, 'news-lead-meta');
      const h2 = document.createElement('h2');
      const link = document.createElement('a');
      link.href = `article.html?id=${encodeURIComponent(lead.id)}`;
      link.textContent = lead.headline;
      h2.append(link);
      const dek = textElement('p', lead.dek, 'news-lead-dek');
      const cta = textElement('a', 'Read Full Report →', 'button navy');
      cta.href = `article.html?id=${encodeURIComponent(lead.id)}`;
      copy.append(meta, h2, dek, cta);
      leadCard.append(imgWrap, copy);
      leadSlot.replaceChildren(leadCard);
    }

    if (railList) {
      railList.replaceChildren();
      newsArticles.slice(1, 5).forEach((art) => {
        const item = document.createElement('a');
        item.className = 'news-rail-item';
        item.href = `article.html?id=${encodeURIComponent(art.id)}`;
        item.append(
          textElement('span', art.topic.toUpperCase(), 'news-rail-topic'),
          textElement('strong', art.headline),
          textElement('small', `${art.date} · ${art.readTime}`)
        );
        railList.append(item);
      });
    }
  }

  function renderNewsroom() {
    const launchEl = select('#news-launch-state');
    if (newsArticles.length === 0) {
      if (frontSec) frontSec.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      if (launchEl) launchEl.hidden = false;
      grid.replaceChildren();
      if (countEl) countEl.textContent = '0 published articles yet';
      filterBtns.forEach((btn) => {
        const active = btn.dataset.newsCat === activeTopic;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      return;
    }

    if (launchEl) launchEl.hidden = true;
    const q = searchEl ? searchEl.value.trim().toLocaleLowerCase() : '';
    const filtering = activeTopic !== 'All' || Boolean(q);
    if (frontSec) frontSec.hidden = filtering;

    const matches = newsArticles.filter((art) => {
      const catOk = activeTopic === 'All' || art.topic === activeTopic;
      const hay = `${art.headline} ${art.dek} ${art.topic} ${art.author} ${art.body.join(' ')}`.toLocaleLowerCase();
      return catOk && (!q || hay.includes(q));
    });

    grid.replaceChildren();
    matches.forEach((art) => grid.append(buildNewsCard(art)));

    if (emptyEl) emptyEl.hidden = matches.length > 0;
    if (countEl) {
      const topicSuffix = activeTopic === 'All' ? '' : ` in ${activeTopic}`;
      const querySuffix = q ? ` for “${searchEl.value.trim()}”` : '';
      countEl.textContent = `Showing ${matches.length} ${matches.length === 1 ? 'article' : 'articles'}${topicSuffix}${querySuffix}`;
    }

    filterBtns.forEach((btn) => {
      const active = btn.dataset.newsCat === activeTopic;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTopic = btn.dataset.newsCat || 'All';
      renderNewsroom();
    });
  });

  if (searchEl) searchEl.addEventListener('input', renderNewsroom);
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeTopic = 'All';
      if (searchEl) searchEl.value = '';
      renderNewsroom();
    });
  }

  renderLeadAndRail();
  renderNewsroom();
})();

/* Single Article Reader Page (article.html?id=...) */
(function () {
  const root = select('#article-page-root');
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  const reqId = params.get('id');
  const article = newsArticles.find((a) => a.id === reqId) || newsArticles[0];
  if (!article) {
    document.title = 'Newsroom — The Rise';
    const box = document.createElement('div');
    box.className = 'news-launch-card';
    box.append(
      textElement('span', 'THE RISE NEWSROOM', 'ad-label'),
      textElement('h2', 'No published article found yet.'),
      textElement('p', 'Once a submitted article is verified and accepted by our editorial team, it will be published here.')
    );
    const backBtn = textElement('a', '← Back to Articles Newsroom', 'button navy');
    backBtn.href = 'articles.html';
    box.append(backBtn);
    root.replaceChildren(box);
    return;
  }
  document.title = `${article.headline} — The Rise Newsroom`;

  const layout = document.createElement('div');
  layout.className = 'story-newspaper-layout';

  const mainCol = document.createElement('article');
  mainCol.className = 'story-page-article news-reader-article';

  const header = document.createElement('header');
  header.className = 'story-page-hero';
  header.append(
    textElement('span', `${article.topic.toUpperCase()} · EDITORIALLY ACCEPTED`, `achievement-badge news-topic-badge ${article.badgeClass}`),
    textElement('h1', article.headline)
  );
  if (article.dek) header.append(textElement('p', article.dek, 'story-lead-dek'));

  const byline = document.createElement('div');
  byline.className = 'story-byline-bar';
  const byLeft = document.createElement('div');
  byLeft.className = 'art-byline-left';
  const byAuthor = document.createElement('span');
  if (article.authorId && newsAuthors[article.authorId]) {
    const aLink = textElement('a', article.author, 'news-author-link');
    aLink.href = `author.html?id=${encodeURIComponent(article.authorId)}`;
    byAuthor.append(aLink);
  } else {
    byAuthor.textContent = article.author;
  }
  byLeft.append(
    byAuthor,
    textElement('span', '|', 'byline-sep'),
    textElement('span', `${article.date}  ·  ${article.readTime}`)
  );
  byline.append(byLeft);

  const coverWrap = document.createElement('figure');
  coverWrap.className = 'story-inline-figure';
  const coverImg = document.createElement('img');
  coverImg.src = article.image;
  coverImg.alt = article.headline;
  coverWrap.append(coverImg, textElement('figcaption', article.imageCaption));

  mainCol.append(header, byline, coverWrap);

  function sanitizeRichHtml(raw) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(raw || '');
    tpl.content.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
    tpl.content.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const n = attr.name.toLowerCase();
        const v = String(attr.value || '').trim().toLowerCase();
        if (n.startsWith('on') || ((n === 'href' || n === 'src') && v.startsWith('javascript:'))) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return tpl.innerHTML;
  }

  const body = document.createElement('div');
  body.className = 'story-page-body';
  article.body.forEach((para, idx) => {
    const trimmed = String(para || '').trim();
    if (/^<[a-z]/i.test(trimmed)) {
      const richBox = document.createElement('div');
      richBox.innerHTML = sanitizeRichHtml(trimmed);
      body.append(richBox);
    } else {
      const p = textElement('p', trimmed);
      if (idx === 0) p.className = 'story-lead-paragraph';
      body.append(p);
    }
    if (idx === 1) {
      if (article.inlinePhotos && article.inlinePhotos[0]) {
        const fig = document.createElement('figure');
        fig.className = 'story-inline-figure';
        const img = document.createElement('img');
        img.src = article.inlinePhotos[0].src;
        img.alt = article.inlinePhotos[0].alt;
        img.loading = 'lazy';
        fig.append(img, textElement('figcaption', article.inlinePhotos[0].caption));
        body.append(fig);
      }
      body.append(createSponsoredAdCard(
        'story-inline-ad',
        '728 × 90 IN-ARTICLE BANNER',
        'Partner Resources & Tools',
        'Explore curated tech tools and sponsor announcements on The Rise.',
        'Visit Sponsor →'
      ));
    }
    if (idx === 3 && article.inlinePhotos && article.inlinePhotos[1]) {
      const fig2 = document.createElement('figure');
      fig2.className = 'story-inline-figure';
      const img2 = document.createElement('img');
      img2.src = article.inlinePhotos[1].src;
      img2.alt = article.inlinePhotos[1].alt;
      img2.loading = 'lazy';
      fig2.append(img2, textElement('figcaption', article.inlinePhotos[1].caption));
      body.append(fig2);
    }
  });

  if (article.charts) {
    const chartSec = document.createElement('div');
    chartSec.className = 'news-charts-wrap';

    if (article.charts.participants) {
      const card1 = document.createElement('div');
      card1.className = 'news-chart-card';
      card1.append(textElement('span', 'EMPIRICAL DATA · TABLE 1', 'ad-label'), textElement('h3', article.charts.participantsTitle));
      const bars = document.createElement('div');
      bars.className = 'news-bar-list';
      const maxVal = Math.max(...article.charts.participants.map((d) => d.count), 1);
      article.charts.participants.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'news-bar-row';
        const head = document.createElement('div');
        head.className = 'news-bar-head';
        head.append(textElement('span', item.label), textElement('strong', item.display));
        const track = document.createElement('div');
        track.className = 'news-bar-track';
        const fill = document.createElement('div');
        fill.className = 'news-bar-fill';
        fill.style.width = `${Math.round((item.count / maxVal) * 100)}%`;
        track.append(fill);
        row.append(head, track);
        bars.append(row);
      });
      card1.append(bars);
      chartSec.append(card1);
    }

    if (article.charts.themes) {
      const card2 = document.createElement('div');
      card2.className = 'news-chart-card';
      card2.append(textElement('span', 'THEMATIC MATRIX · TABLE 2', 'ad-label'), textElement('h3', article.charts.themesTitle));
      const grid2 = document.createElement('div');
      grid2.className = 'news-themes-grid';
      article.charts.themes.forEach(([title, desc], i) => {
        const box = document.createElement('div');
        box.className = 'news-theme-item';
        box.append(textElement('span', `0${i + 1}`, 'news-theme-num'), textElement('strong', title), textElement('p', desc));
        grid2.append(box);
      });
      card2.append(grid2);
      chartSec.append(card2);
    }
    body.append(chartSec);
  }

  if (article.highlights && article.highlights.length) {
    const takeBox = document.createElement('div');
    takeBox.className = 'news-takeaways-box';
    takeBox.append(textElement('h3', 'Key Takeaways'));
    const ul = document.createElement('ul');
    article.highlights.forEach((item) => ul.append(textElement('li', item)));
    takeBox.append(ul);
    body.append(takeBox);
  }

  if (article.quote) {
    const quote = textElement('blockquote', `“${article.quote}”`, 'profile-advice');
    quote.append(textElement('cite', `${article.author} · The Rise Newsroom`));
    body.append(quote);
  }

  body.append(textElement('p', `Editorial verification: ${article.sources}`, 'dialog-note'));
  if (article.journal) {
    const jBox = document.createElement('div');
    jBox.className = 'news-journal-box';
    jBox.append(
      textElement('span', 'PUBLISHED RESEARCH & JOURNAL LINK', 'ad-label'),
      textElement('h3', article.journal.name),
      textElement('p', `${article.journal.volume} · ${article.journal.publisher}`, 'news-journal-meta'),
      textElement('p', article.journal.citation, 'news-journal-cite')
    );
    const jLinks = document.createElement('div');
    jLinks.className = 'news-journal-actions';
    const doiBtn = textElement('a', `DOI: ${article.journal.doiUrl.replace('https://doi.org/', '')} →`, 'button navy');
    doiBtn.href = article.journal.doiUrl;
    doiBtn.target = '_blank';
    doiBtn.rel = 'noopener noreferrer';
    const jBtn = textElement('a', 'Visit Journal Homepage →', 'button outline-dark');
    jBtn.href = article.journal.journalUrl;
    jBtn.target = '_blank';
    jBtn.rel = 'noopener noreferrer';
    jLinks.append(doiBtn, jBtn);
    jBox.append(jLinks);
    body.append(jBox);
  }
  body.append(createSponsoredAdCard(
    'story-bottom-ad',
    '728 × 90 END-OF-ARTICLE BANNER',
    'Recommended Partner Offers',
    'Support independent journalism and student innovation across Bangladesh.',
    'Explore Offer →'
  ));
  mainCol.append(body);

  const sidebar = document.createElement('aside');
  sidebar.className = 'story-sidebar';
  const factsCard = document.createElement('div');
  factsCard.className = 'story-facts-card';
  factsCard.append(textElement('span', 'DISPATCH INFO', 'ad-label'), textElement('h3', article.topic));
  const dl = document.createElement('dl');
  dl.className = 'story-facts-list';
  [
    ['Author', article.author],
    ['Role', article.affiliation],
    ['Published', article.date],
    ['Review Status', 'Accepted by Editorial Desk']
  ].forEach(([k, v]) => dl.append(textElement('dt', k), textElement('dd', v)));
  factsCard.append(dl);

  sidebar.append(factsCard, createSponsoredAdCard(
    'ad-skyscraper story-sidebar-ad',
    '300 × 600 VERTICAL COLUMN',
    'Featured Sponsor Column',
    'High-visibility vertical sponsor placement inside The Rise Newsroom.',
    'Explore Offer →'
  ));

  layout.append(mainCol, sidebar);
  root.replaceChildren(layout);

  const moreGrid = select('#more-articles-grid');
  if (moreGrid) {
    newsArticles.filter((a) => a.id !== article.id).slice(0, 3).forEach((item) => {
      const card = document.createElement('article');
      card.className = 'news-card';
      const media = document.createElement('a');
      media.className = 'news-card-media';
      media.href = `article.html?id=${encodeURIComponent(item.id)}`;
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.headline;
      img.loading = 'lazy';
      media.append(img, textElement('span', item.topic, `news-topic-tag ${item.badgeClass}`));
      const cBody = document.createElement('div');
      cBody.className = 'news-card-body';
      const titleLink = document.createElement('a');
      titleLink.className = 'news-card-title';
      titleLink.href = `article.html?id=${encodeURIComponent(item.id)}`;
      titleLink.textContent = item.headline;
      cBody.append(
        textElement('div', `${item.date} · ${item.readTime}`, 'news-card-meta'),
        titleLink,
        textElement('p', item.dek, 'news-card-dek')
      );
      card.append(media, cBody);
      moreGrid.append(card);
    });
  }
})();

/* Dedicated Article Submission Form Page (submit-article.html) */
(function () {
  const form = select('#article-submit-form');
  if (!form) return;

  const bodyInput = select('#art-body');
  const wordCountEl = select('#art-word-count');
  const imagesInput = select('#art-images');
  const imagesPreview = select('#art-images-preview');
  const errorEl = select('#art-error');
  const resultEl = select('#art-result');
  const summaryBox = select('#art-summary-box');
  const sendEmailBtn = select('#art-send-email');
  const sendWaBtn = select('#art-send-whatsapp');
  const copyBtn = select('#art-copy-btn');
  const copyStatus = select('#art-copy-status');

  let coverFiles = [];
  let lastManuscriptText = '';

  function refreshCoverPreviews() {
    if (!imagesPreview) return;
    imagesPreview.replaceChildren();
    coverFiles.forEach((file, idx) => {
      const card = document.createElement('div');
      card.className = 'upload-thumb-card';
      const img = document.createElement('img');
      img.alt = file.name;
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      const meta = document.createElement('div');
      meta.className = 'upload-thumb-meta';
      const kb = (file.size / 1024).toFixed(1) + ' KB';
      meta.append(textElement('span', file.name, 'upload-thumb-name'), textElement('small', kb, 'upload-thumb-size'));
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'upload-thumb-remove';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        coverFiles.splice(idx, 1);
        refreshCoverPreviews();
      });
      card.append(img, meta, removeBtn);
      imagesPreview.append(card);
    });
  }

  if (imagesInput) {
    imagesInput.addEventListener('change', () => {
      const incoming = [...imagesInput.files].filter((f) => f.type.startsWith('image/'));
      coverFiles = coverFiles.concat(incoming);
      imagesInput.value = '';
      refreshCoverPreviews();
    });
  }

  if (bodyInput && wordCountEl) {
    bodyInput.addEventListener('input', () => {
      const words = bodyInput.value.trim() ? bodyInput.value.trim().split(/\s+/).length : 0;
      wordCountEl.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (errorEl) errorEl.textContent = '';
    if (!form.reportValidity()) {
      if (errorEl) errorEl.textContent = 'Please complete all required fields highlighted above.';
      return;
    }

    const author = select('#art-author').value.trim();
    const whatsapp = select('#art-whatsapp').value.trim();
    const email = select('#art-email').value.trim();
    const affiliation = select('#art-affiliation').value.trim();
    const topic = select('#art-topic').value;
    const city = select('#art-city').value.trim();
    const headline = select('#art-headline').value.trim();
    const summary = select('#art-summary').value.trim();
    const articleBody = select('#art-body').value.trim();
    const sources = select('#art-sources').value.trim();
    const imgNames = coverFiles.length ? coverFiles.map((f) => f.name).join(', ') : 'None attached';

    if (window.RiseNewsroom) {
      window.RiseNewsroom.submitArticle({
        author,
        whatsapp,
        email,
        affiliation,
        topic,
        city,
        headline,
        summary,
        bodyText: articleBody,
        sources,
        imageNames: imgNames
      });
    }

    lastManuscriptText = [
      'THE RISE NEWSROOM — ARTICLE SUBMISSION FOR REVIEW',
      '=================================================',
      `Author: ${author} (${affiliation})`,
      `Location: ${city}`,
      `Email: ${email}`,
      `WhatsApp: ${whatsapp}`,
      `Topic / Section: ${topic}`,
      `Headline: ${headline}`,
      `Summary: ${summary}`,
      sources ? `References / Sources: ${sources}` : '',
      `Cover / Diagram Images (${coverFiles.length}): ${imgNames}`,
      '',
      'FULL ARTICLE TEXT:',
      articleBody
    ].filter(Boolean).join('\n');

    if (summaryBox) {
      summaryBox.replaceChildren();
      [
        ['Author', `${author} (${affiliation})`],
        ['Topic', topic],
        ['Headline', headline],
        ['Email / WhatsApp', `${email} · ${whatsapp}`],
        ['Images', `${coverFiles.length} file(s): ${imgNames}`]
      ].forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'nom-summary-row';
        row.append(textElement('strong', `${label}:`), textElement('span', value));
        summaryBox.append(row);
      });
    }

    const subject = `The Rise Article Submission — ${topic}: ${headline}`;
    if (sendEmailBtn) {
      sendEmailBtn.href = `mailto:hello@therisebd.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lastManuscriptText)}`;
    }
    if (sendWaBtn) {
      sendWaBtn.href = `https://wa.me/8801643442518?text=${encodeURIComponent(lastManuscriptText)}`;
    }
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!lastManuscriptText) return;
      try {
        await navigator.clipboard.writeText(lastManuscriptText);
        if (copyStatus) copyStatus.textContent = 'Full article manuscript copied to clipboard!';
      } catch (e) {
        if (copyStatus) copyStatus.textContent = 'Could not auto-copy — please use Email or WhatsApp above.';
      }
    });
  }
})();

/* Contributor / Author Profile Page (author.html?id=...) */
(function () {
  const root = select('#author-profile-root');
  if (!root) return;
  const params = new URLSearchParams(window.location.search);
  const reqId = params.get('id') || 'akif';
  const author = newsAuthors[reqId] || newsAuthors.akif;
  if (!author) return;
  document.title = `${author.name} — Contributor Profile · The Rise`;

  const card = document.createElement('section');
  card.className = 'author-hero-card';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'author-avatar-wrap';
  const img = document.createElement('img');
  img.src = author.photo;
  img.alt = author.name;
  avatarWrap.append(img);

  const info = document.createElement('div');
  info.className = 'author-hero-info';
  info.append(
    textElement('span', 'THE RISE CONTRIBUTOR PROFILE', 'ad-label'),
    textElement('h1', author.name),
    textElement('p', `${author.role} · ${author.location}`, 'author-role-line'),
    textElement('p', author.bio, 'author-bio-text')
  );

  if (author.links && author.links.length) {
    const linksRow = document.createElement('div');
    linksRow.className = 'author-links-row';
    author.links.forEach((l, idx) => {
      const a = textElement('a', `${l.label} →`, idx === 0 ? 'button navy' : 'button outline-dark');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      linksRow.append(a);
    });
    info.append(linksRow);
  }

  card.append(avatarWrap, info);

  const historyCard = document.createElement('section');
  historyCard.className = 'author-history-card';
  historyCard.append(textElement('span', 'BACKGROUND & PUBLICATIONS', 'ad-label'), textElement('h2', 'Academic & Editorial History'));
  const ul = document.createElement('ul');
  ul.className = 'author-history-list';
  author.history.forEach((h) => ul.append(textElement('li', h)));
  historyCard.append(ul);

  const pubsSec = document.createElement('section');
  pubsSec.className = 'author-articles-section';
  pubsSec.append(textElement('span', 'PUBLISHED ON THE RISE', 'ad-label'), textElement('h2', `Articles by ${author.name}`));
  const grid = document.createElement('div');
  grid.className = 'news-grid';
  newsArticles.filter((a) => a.authorId === author.id).forEach((art) => {
    const aCard = document.createElement('article');
    aCard.className = 'news-card';
    const media = document.createElement('a');
    media.className = 'news-card-media';
    media.href = `article.html?id=${encodeURIComponent(art.id)}`;
    const aImg = document.createElement('img');
    aImg.src = art.image;
    aImg.alt = art.headline;
    media.append(aImg, textElement('span', art.topic, `news-topic-tag ${art.badgeClass}`));
    const cBody = document.createElement('div');
    cBody.className = 'news-card-body';
    const tLink = textElement('a', art.headline, 'news-card-title');
    tLink.href = `article.html?id=${encodeURIComponent(art.id)}`;
    cBody.append(textElement('div', `${art.date} · ${art.readTime}`, 'news-card-meta'), tLink, textElement('p', art.dek, 'news-card-dek'));
    aCard.append(media, cBody);
    grid.append(aCard);
  });
  pubsSec.append(grid);

  root.replaceChildren(card, historyCard, pubsSec);
})();

/* Auto-updating Impact Counters (index.html & about.html) */
(function () {
  var spotlightCount = typeof stories !== 'undefined' ? stories.length : 0;
  var articleCount = typeof newsArticles !== 'undefined' ? newsArticles.length : 0;
  var totalCount = spotlightCount + articleCount;
  document.querySelectorAll('[data-stat-spotlights]').forEach(function (el) { el.textContent = String(spotlightCount); });
  document.querySelectorAll('[data-stat-articles]').forEach(function (el) { el.textContent = String(articleCount); });
  document.querySelectorAll('[data-stat-total]').forEach(function (el) { el.textContent = String(totalCount); });
})();

/* Refresh starts at the top */
window.addEventListener('load', function () {
  var isReload = false;
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    isReload = !!nav && nav.type === 'reload';
  } catch (e) {}
  if (!isReload && performance.navigation) { isReload = performance.navigation.type === 1; }
  if (isReload) {
    if (window.__lenis) { window.__lenis.scrollTo(0, { immediate: true, force: true }); }
    window.scrollTo(0, 0);
  }
});

/* Theme toggle: Light / Night */
(function () {
  var root = document.documentElement;
  function label() { return root.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙'; }
  function sync() {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) { buttons[i].textContent = label(); }
  }
  function toggle() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') { root.setAttribute('data-theme', 'dark'); } else { root.removeAttribute('data-theme'); }
    try { localStorage.setItem('rise-theme', next); } catch (e) {}
    sync();
  }
  var buttons = document.querySelectorAll('[data-theme-toggle]');
  for (var i = 0; i < buttons.length; i++) { buttons[i].addEventListener('click', toggle); }
  sync();
})();

/* Bangla / English Language Toggle */
(function initLanguageToggle() {
  var root = document.documentElement;
  var buttons = document.querySelectorAll('[data-lang-toggle]');
  if (!buttons.length) { return; }

  var i18nMap = [
    { sel: '.topbar .edition', en: 'BANGLADESH FIRST. BOUNDLESS IN SPIRIT.', bn: 'বাংলাদেশ প্রথম। অসীম প্রেরণা।' },
    { sel: '.topbar-actions .subscribe', en: 'Subscribe', bn: 'সাবস্ক্রাইব' },
    { sel: '.masthead-caption', en: 'PEOPLE. PURPOSE. PROGRESS.', bn: 'মানুষ। উদ্দেশ্য। অগ্রগতি।' },
    { sel: '#main-nav a[href="#home"]', en: 'Home', bn: 'হোম' },
    { sel: '#main-nav a[href="spotlights.html"]', en: 'Stories', bn: 'স্টোরিজ' },
    { sel: '#main-nav a[href="articles.html"]', en: 'Articles', bn: 'আর্টিকেল' },
    { sel: '#main-nav a[href="#categories"]', en: 'Categories', bn: 'ক্যাটাগরি' },
    { sel: '#inside-rise-dropdown .nav-drop-btn', html: true, en: 'Inside The Rise <span aria-hidden="true">▾</span>', bn: 'আমাদের সম্পর্কে <span aria-hidden="true">▾</span>' },
    { sel: '#inside-rise-dropdown a[href="about.html"]', en: 'About Us', bn: 'আমাদের পরিচিতি' },
    { sel: '#inside-rise-dropdown a[href="contact.html"]', en: 'Contact', bn: 'যোগাযোগ' },
    { sel: '#inside-rise-dropdown a[href="careers.html"]', en: 'Life at The Rise', bn: 'ক্যারিয়ার ও টিম' },
    { sel: '#inside-rise-dropdown a[href="advertise.html"]', en: 'Partnership', bn: 'পার্টনারশিপ' },
    { sel: '.nav-edition', en: 'THE ACHIEVERS ISSUE', bn: 'অ্যাচিভার্স সংখ্যা' },
    { sel: '.nav-featured', en: 'Get Featured', bn: 'ফিচার হোন' },
    { sel: '.nav-subscribe', en: 'Subscribe', bn: 'সাবস্ক্রাইব' },
    { sel: '.search-toggle span', en: 'Search', bn: 'খুঁজুন' },
    { sel: '#hero-title', html: true, en: 'Celebrating<br>People Who Do<br><em>Great Work.</em>', bn: 'যাঁরা করছেন<br>অসাধারণ কাজ,<br><em>তাঁদের গল্প।</em>' },
    { sel: '.hero-description', en: 'The research that moves us forward. The ideas that win against the odds. The people building what comes next. Their stories deserve to rise.', bn: 'যে গবেষণা আমাদের এগিয়ে নেয়। যে ধারণা প্রতিকূলতা জয় করে। যাঁরা গড়ছেন আগামীর পথ—তাঁদের গল্পই উঠে আসুক সবার সামনে।' },
    { sel: '.hero-actions .button.amber', en: 'Explore Stories', bn: 'গল্পগুলো দেখুন' },
    { sel: '.hero-actions .button.outline', en: 'Submit a Nomination', bn: 'মনোনয়ন জমা দিন' },
    { sel: '.issue-note .eyebrow', en: 'AMBITION HAS MANY FACES', bn: 'স্বপ্নের অনেক রূপ' },
    { sel: '.issue-note p', en: 'Researchers. Problem-solvers. Quiet changemakers.', bn: 'গবেষক। সমস্যার সমাধানকারী। নীরব পরিবর্তনের কারিগর।' },
    { sel: '.issue-note .sample-note', en: 'Real people · Real achievements', bn: 'বাস্তব মানুষ · বাস্তব অর্জন' },
    { sel: '#featured-title', html: true, en: 'Featured Achiever Spotlight<span class="amber-dot">.</span>', bn: 'ফিচার্ড অ্যাচিভার স্পটলাইট<span class="amber-dot">.</span>' },
    { sel: '#latest-article-title', html: true, en: 'Latest Published Article<span class="teal-dot">.</span>', bn: 'সর্বশেষ প্রকাশিত আর্টিকেল<span class="teal-dot">.</span>' },
    { sel: '.dual-btn-primary', en: 'Read his full story →', bn: 'তাঁর পুরো গল্প পড়ুন →' },
    { sel: '.dual-btn-ghost', en: 'Nominate an Achiever', bn: 'একজন অ্যাচিভার মনোনীত করুন' },
    { sel: '.dual-btn-article', en: 'Read Full Article →', bn: 'সম্পূর্ণ আর্টিকেল পড়ুন →' },
    { sel: '.dual-btn-ghost-dark', en: 'All Articles', bn: 'সব আর্টিকেল' },
    { sel: '#stories-title', html: true, en: 'Latest Spotlights<span class="amber-dot">.</span>', bn: 'সর্বশেষ স্পটলাইট<span class="amber-dot">.</span>' },
    { sel: '#home-articles-title', html: true, en: 'Latest News Articles<span class="amber-dot">.</span>', bn: 'সর্বশেষ নিউজ আর্টিকেল<span class="amber-dot">.</span>' },
    { sel: '#home-articles-section .text-button', html: true, en: 'All Articles <span class="link-mark" aria-hidden="true">→</span>', bn: 'সব আর্টিকেল <span class="link-mark" aria-hidden="true">→</span>' },
    { sel: '#categories-title', en: 'Great work, in every field.', bn: 'প্রতিটি ক্ষেত্রেই অসাধারণ কাজ।' },
    { sel: '#categories .section-aside', en: 'Pick a category. Find your inspiration.', bn: 'একটি ক্যাটাগরি বেছে নিন। অনুপ্রেরণা খুঁজুন।' },
    { sel: '#trending-title', html: true, en: 'Most Read<span class="amber-dot">.</span>', bn: 'সর্বাধিক পঠিত<span class="amber-dot">.</span>' },
    { sel: '#about-title', html: true, en: 'Why readers trust <em>The Rise.</em>', bn: 'কেন পাঠকরা <em>দ্য রাইস</em>-এ আস্থা রাখেন।' },
    { sel: '#newsletter-title', html: true, en: 'Get the stories that <em>inspire.</em>', bn: 'পান সেই গল্পগুলো যা আপনাকে <em>অনুপ্রাণিত করবে।</em>' },
    { sel: '#newsletter-form .button', en: 'Subscribe', bn: 'সাবস্ক্রাইব করুন' },
    { sel: '.footer-about p', en: 'An independent magazine concept celebrating the people who move us forward. Rooted in Bangladesh. Open to the world.', bn: 'একটি স্বাধীন ম্যাগাজিন উদ্যোগ, যা বাংলাদেশের ও বিশ্বের অনুপ্রেরণাদায়ক মানুষদের গল্প তুলে ধরে।' }
  ];

  function applyLang(lang) {
    root.setAttribute('lang', lang);
    for (var i = 0; i < i18nMap.length; i++) {
      var item = i18nMap[i];
      var el = document.querySelector(item.sel);
      if (!el) { continue; }
      if (item.html) { el.innerHTML = item[lang]; } else { el.textContent = item[lang]; }
    }
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].textContent = lang === 'bn' ? 'English' : 'বাংলা';
      buttons[j].setAttribute('aria-label', lang === 'bn' ? 'Switch to English' : 'বাংলা ভাষায় দেখুন');
    }
  }

  var saved = 'en';
  try {
    var stored = localStorage.getItem('rise-lang');
    if (stored === 'bn' || stored === 'en') { saved = stored; }
  } catch (e) {}

  applyLang(saved);

  for (var k = 0; k < buttons.length; k++) {
    buttons[k].addEventListener('click', function () {
      var next = root.getAttribute('lang') === 'bn' ? 'en' : 'bn';
      try { localStorage.setItem('rise-lang', next); } catch (e) {}
      applyLang(next);
    });
  }
})();

/* Live Site Hydration: Featured Spotlight, Custom Ads, Timed Popup & Custom Sections */
(function () {
  var nr = window.RiseNewsroom;
  if (!nr || document.getElementById('nr-lock-screen')) return;
  var path = window.location.pathname.split('/').pop() || 'index.html';

  var state = nr.load();

  /* 1. Featured Spotlight Sync on Homepage */
  var dualSpot = document.querySelector('#editors-pick .dual-spotlight-card');
  if (dualSpot && typeof stories !== 'undefined' && stories.length) {
    var feat = stories.find(function (s) { return s.id === state.featuredSpotlightId; }) || stories[0];
    if (feat) {
      var storyUrl = 'story.html?id=' + encodeURIComponent(feat.id);
      var imgWrap = dualSpot.querySelector('.dual-cover-media');
      var img = dualSpot.querySelector('.dual-cover-media img');
      var h3Link = dualSpot.querySelector('#home-featured-spotlight h3 a');
      var dekEl = dualSpot.querySelector('#home-featured-spotlight .dual-dek');
      var linkEl = dualSpot.querySelector('.dual-btn-article');
      if (imgWrap) imgWrap.href = storyUrl;
      if (img) { img.src = feat.localImage || feat.image || 'nasir%20.jpg'; img.alt = feat.alt || feat.name; }
      if (h3Link) { h3Link.textContent = feat.name; h3Link.href = storyUrl; }
      if (dekEl) dekEl.textContent = feat.summary || feat.headline || '';
      if (linkEl) linkEl.href = storyUrl;
    }
  }

  /* 2. Custom Ad Placements (Top Leaderboard & Secondary Banner) */
  function applyAdToSlot(slotEl, cfg) {
    if (!slotEl || !cfg) return;
    if (cfg.disabled) { slotEl.style.display = 'none'; return; }
    if (cfg.href) { slotEl.href = cfg.href; }
    var left = slotEl.querySelector('.ad-row-left');
    var copy = slotEl.querySelector('.ad-row-copy');
    var cta = slotEl.querySelector('.ad-cta');
    if (cfg.mediaType === 'image' && cfg.mediaUrl) {
      slotEl.innerHTML = '<div style="width:100%;display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
        '<img src="' + cfg.mediaUrl.replace(/"/g, '&quot;') + '" alt="' + (cfg.title || 'Sponsored').replace(/"/g, '&quot;') + '" style="max-height:110px;width:auto;max-width:340px;border-radius:10px;object-fit:cover">' +
        '<div style="flex:1;min-width:200px"><span class="ad-label">SPONSORED</span><p class="ad-title" style="margin:4px 0">' + (cfg.title || '') + '</p><p class="ad-text">' + (cfg.text || '') + '</p></div>' +
        '<div class="ad-contact"><span class="ad-button ad-cta">' + (cfg.cta || 'Learn More →') + '</span></div></div>';
      return;
    }
    if (cfg.mediaType === 'video' && cfg.mediaUrl) {
      slotEl.innerHTML = '<div style="width:100%;display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
        '<video src="' + cfg.mediaUrl.replace(/"/g, '&quot;') + '" autoplay muted loop playsinline style="max-height:120px;max-width:320px;border-radius:10px"></video>' +
        '<div style="flex:1;min-width:200px"><span class="ad-label">SPONSORED VIDEO</span><p class="ad-title" style="margin:4px 0">' + (cfg.title || '') + '</p><p class="ad-text">' + (cfg.text || '') + '</p></div>' +
        '<div class="ad-contact"><span class="ad-button ad-cta">' + (cfg.cta || 'Visit Sponsor →') + '</span></div></div>';
      return;
    }
    if (copy) {
      var tEl = copy.querySelector('.ad-title');
      var dEl = copy.querySelector('.ad-text');
      if (tEl && cfg.title) tEl.textContent = cfg.title;
      if (dEl && cfg.text) dEl.textContent = cfg.text;
    }
    if (cta && cfg.cta) cta.textContent = cfg.cta;
    if (left && cfg.label) {
      var lEl = left.querySelector('.ad-label');
      if (lEl) lEl.textContent = cfg.label;
    }
  }

  var placements = state.adPlacements || {};
  if (placements.top_leaderboard) {
    applyAdToSlot(document.querySelector('.ad-fullrow'), placements.top_leaderboard);
  }
  if (placements.inline_banner) {
    applyAdToSlot(document.querySelector('.ad-inline-banner, .ad-leaderboard:not(.ad-fullrow)'), placements.inline_banner);
  }

  /* 3. Custom Homepage Sections */
  var newsletterSec = document.getElementById('newsletter');
  if (newsletterSec && Array.isArray(state.customSections) && state.customSections.length) {
    state.customSections.forEach(function (sec) {
      var s = document.createElement('section');
      s.className = 'section wrap custom-nr-section theme-' + (sec.theme || 'violet');
      s.setAttribute('data-custom-sec', sec.id);
      s.innerHTML = '<div class="custom-nr-inner">' +
        '<p class="eyebrow"></p><h2></h2><p class="custom-nr-body"></p>' +
        '<a class="button navy custom-nr-cta" href="#"></a></div>';
      s.querySelector('.eyebrow').textContent = sec.eyebrow || 'FEATURED';
      s.querySelector('h2').textContent = sec.title || '';
      s.querySelector('.custom-nr-body').textContent = sec.body || '';
      var a = s.querySelector('.custom-nr-cta');
      a.textContent = sec.ctaText || 'Explore →';
      a.href = sec.ctaHref || 'articles.html';
      newsletterSec.parentNode.insertBefore(s, newsletterSec);
    });
  }

  /* 4. Timed Site-Wide Popup */
  function hydratePopupAndAds() {
  var freshState = nr.load();
  var pop = freshState.popup;
  var existingPop = document.querySelector('.rise-popup-overlay');
  if (!(pop && pop.active && pop.title)) {
    if (existingPop) existingPop.remove();
  } else if (!existingPop) {
    var now = Date.now();
    var startMs = pop.startAt ? Date.parse(pop.startAt) : 0;
    var endMs = pop.endAt ? Date.parse(pop.endAt) : Infinity;
    var dismissedKey = 'rise_popup_dismissed_' + (pop.updatedAt || '1');
    var alreadyClosed = false;
    try { alreadyClosed = sessionStorage.getItem(dismissedKey) === '1'; } catch (e) {}

    if (!alreadyClosed && now >= startMs && now <= endMs) {
      var overlay = document.createElement('div');
      overlay.className = 'rise-popup-overlay';
      overlay.innerHTML = '<div class="rise-popup-card" role="dialog" aria-modal="true">' +
        '<button type="button" class="rise-popup-close" aria-label="Close popup">×</button>' +
        (pop.imageUrl ? '<img class="rise-popup-img" src="" alt="">' : '') +
        '<div class="rise-popup-content"><span class="eyebrow">ANNOUNCEMENT</span><h3></h3><p></p>' +
        '<div class="rise-popup-actions"><a class="button navy rise-popup-cta" href="#"></a></div></div></div>';
      if (pop.imageUrl) {
        var pImg = overlay.querySelector('.rise-popup-img');
        pImg.src = pop.imageUrl;
        pImg.alt = pop.title;
      }
      overlay.querySelector('h3').textContent = pop.title;
      overlay.querySelector('p').textContent = pop.message || '';
      var pCta = overlay.querySelector('.rise-popup-cta');
      if (pop.ctaText && pop.ctaHref) {
        pCta.textContent = pop.ctaText;
        pCta.href = pop.ctaHref;
      } else {
        pCta.style.display = 'none';
      }
      function closePop() {
        try { sessionStorage.setItem(dismissedKey, '1'); } catch (e) {}
        overlay.remove();
      }
      overlay.querySelector('.rise-popup-close').addEventListener('click', closePop);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closePop(); });
      document.body.appendChild(overlay);
    }
  }

  /* 5. Breaking News / Ticker Bar Hydration */
  var tickerTrack = document.querySelector('.ticker-track');
  if (tickerTrack && Array.isArray(state.tickerItems) && state.tickerItems.length) {
    var doubleItems = state.tickerItems.concat(state.tickerItems);
    tickerTrack.innerHTML = doubleItems.map(function (t) {
      var s = document.createElement('span');
      s.textContent = t;
      return s.outerHTML;
    }).join('');
  }

  /* 6. Meta-Style Section-Wise Ad Campaign Targeting & Live Impression/Click Tracking */
  var nowTs = Date.now();
  var activeCamps = (freshState.adCampaigns || []).filter(function (c) {
    if (c.status !== 'active') return false;
    var s = c.startAt ? Date.parse(c.startAt) : 0;
    var e = c.endAt ? Date.parse(c.endAt) : Infinity;
    return nowTs >= s && nowTs <= e;
  });

  function renderTargetedCampaign(slotEl, camp) {
    if (!slotEl || !camp) return;
    slotEl.href = camp.href || 'https://therisebd.com';
    slotEl.target = '_blank';
    slotEl.rel = 'noopener noreferrer';
    var maxH = camp.bannerSize === '728x90' ? '90px' : (camp.bannerSize === '300x250' ? '250px' : '120px');
    var mediaHtml = '';
    if (camp.mediaType === 'image' && camp.mediaUrl) {
      mediaHtml = '<img src="' + camp.mediaUrl.replace(/"/g, '&quot;') + '" alt="' + (camp.title || camp.name).replace(/"/g, '&quot;') + '" style="max-height:' + maxH + ';width:auto;max-width:340px;border-radius:10px;object-fit:cover">';
    } else if (camp.mediaType === 'video' && camp.mediaUrl) {
      mediaHtml = '<video src="' + camp.mediaUrl.replace(/"/g, '&quot;') + '" autoplay muted loop playsinline style="max-height:' + maxH + ';max-width:320px;border-radius:10px"></video>';
    }
    slotEl.innerHTML = '<div style="width:100%;display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      mediaHtml +
      '<div style="flex:1;min-width:200px"><span class="ad-label">SPONSORED · ' + (camp.advertiser || 'PARTNER').replace(/</g, '&lt;') + '</span>' +
      '<p class="ad-title" style="margin:4px 0">' + (camp.title || camp.name).replace(/</g, '&lt;') + '</p>' +
      '<p class="ad-text">' + (camp.text || '').replace(/</g, '&lt;') + '</p></div>' +
      '<div class="ad-contact"><span class="ad-button ad-cta">' + (camp.cta || 'Learn More →').replace(/</g, '&lt;') + '</span></div></div>';
    nr.recordAdImpression(camp.id);
    slotEl.addEventListener('click', function () { nr.recordAdClick(camp.id); });
  }

  function findCampaignFor(targetKey) {
    return activeCamps.find(function (c) {
      return Array.isArray(c.targets) && (c.targets.indexOf(targetKey) !== -1 || c.targets.indexOf('all_pages') !== -1);
    });
  }

  var allPagesCamp = findCampaignFor('all_pages');
  if (allPagesCamp) {
    document.querySelectorAll('.ad-slot').forEach(function (sl) {
      renderTargetedCampaign(sl, allPagesCamp);
    });
  }
  if (path === 'index.html' || path === '') {
    var topCamp = findCampaignFor('home_top');
    if (topCamp) renderTargetedCampaign(document.querySelector('.ad-fullrow'), topCamp);
    var lowerCamp = findCampaignFor('home_lower');
    if (lowerCamp) {
      var targetLower = document.querySelector('#newsletter');
      var existingLower = document.getElementById('nr-lower-ad-slot');
      if (targetLower && !existingLower) {
        var lowerSlot = document.createElement('a');
        lowerSlot.id = 'nr-lower-ad-slot';
        lowerSlot.className = 'ad-slot ad-leaderboard ad-fullrow wrap';
        targetLower.parentNode.insertBefore(lowerSlot, targetLower);
        renderTargetedCampaign(lowerSlot, lowerCamp);
      } else if (existingLower) {
        renderTargetedCampaign(existingLower, lowerCamp);
      }
    }
  } else if (path === 'article.html') {
    var artCamp = findCampaignFor('article_inside');
    if (artCamp) {
      var artSlot = document.querySelector('#article-page-root .ad-slot') || document.querySelector('.ad-slot');
      if (artSlot) {
        renderTargetedCampaign(artSlot, artCamp);
      } else {
        var artMain = document.getElementById('article-page-root');
        if (artMain) {
          var newArtAd = document.createElement('a');
          newArtAd.className = 'ad-slot ad-leaderboard ad-fullrow';
          newArtAd.style.marginTop = '24px';
          artMain.appendChild(newArtAd);
          renderTargetedCampaign(newArtAd, artCamp);
        }
      }
    }
  } else if (path === 'articles.html') {
    var frontCamp = findCampaignFor('articles_front');
    if (frontCamp) renderTargetedCampaign(document.querySelector('.ad-slot'), frontCamp);
  } else if (path === 'spotlights.html') {
    var spotCamp = findCampaignFor('spotlights_page');
    if (spotCamp) renderTargetedCampaign(document.querySelector('.ad-slot'), spotCamp);
  }
  }
  hydratePopupAndAds();
  window.addEventListener('rise:cloud-synced', hydratePopupAndAds);
})();

/* Homepage Latest News Articles (First 3 + See More) */
(function () {
  var grid = document.getElementById('home-news-grid');
  if (!grid || typeof newsArticles === 'undefined') return;
  var seeMoreRow = document.getElementById('home-news-see-more-row');
  var seeMoreBtn = document.getElementById('home-news-see-more');
  var expanded = false;

  function renderHomeNews() {
    var list = expanded ? newsArticles : newsArticles.slice(0, 3);
    grid.innerHTML = list.map(function (art) {
      return '<article class="news-card">' +
        '<a class="news-card-media" href="article.html?id=' + encodeURIComponent(art.id) + '">' +
        '<img src="' + (art.image || '') + '" alt="' + String(art.headline || '').replace(/"/g, '&quot;') + '" loading="lazy">' +
        '<span class="news-topic-tag ' + (art.badgeClass || 'policy') + '">' + String(art.topic || 'News') + '</span></a>' +
        '<div class="news-card-body"><div class="news-card-meta"><span>' + (art.date || '') + '</span><span>· ' + (art.readTime || '5 min read') + '</span></div>' +
        '<a class="news-card-title" href="article.html?id=' + encodeURIComponent(art.id) + '">' + String(art.headline || '') + '</a>' +
        '<p class="news-card-dek">' + String(art.dek || '') + '</p>' +
        '<div class="news-card-foot"><span class="news-card-author">By ' + String(art.author || '') + '</span>' +
        '<a class="news-card-link" href="article.html?id=' + encodeURIComponent(art.id) + '">Read article →</a></div></div></article>';
    }).join('');
    if (seeMoreRow) seeMoreRow.hidden = newsArticles.length <= 3;
    if (seeMoreBtn) seeMoreBtn.textContent = expanded ? 'Show fewer articles' : 'See more articles (' + (newsArticles.length - 3) + ' more)';
  }

  if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', function () {
      expanded = !expanded;
      renderHomeNews();
    });
  }
  renderHomeNews();
  window.addEventListener('rise:cloud-synced', function () {
    if (typeof newsArticles !== 'undefined') window.RiseNewsroom.hydrateArticles(newsArticles);
    renderHomeNews();
  });
})();

/* Site-Wide Social Links Sync + Article Share Bar + Category Dropdown + Reader Follow Strip */
(function () {
  var nr = window.RiseNewsroom;
  var links = nr ? nr.load().socialLinks : {
    facebook: 'https://www.facebook.com/',
    linkedin: 'https://www.linkedin.com/',
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/',
    x: 'https://x.com/'
  };

  /* Sync Footer Social Links */
  document.querySelectorAll('.site-footer a[href*="facebook.com"]').forEach(function (a) { if (links.facebook) a.href = links.facebook; });
  document.querySelectorAll('.site-footer a[href*="linkedin.com"]').forEach(function (a) { if (links.linkedin) a.href = links.linkedin; });
  document.querySelectorAll('.site-footer a[href*="instagram.com"]').forEach(function (a) { if (links.instagram) a.href = links.instagram; });
  document.querySelectorAll('.site-footer a[href*="youtube.com"]').forEach(function (a) { if (links.youtube) a.href = links.youtube; });

  /* Contact Page Social Links + Form */
  var contactSoc = document.getElementById('contact-social-links');
  if (contactSoc) {
    var items = [
      ['Facebook', links.facebook],
      ['LinkedIn', links.linkedin],
      ['Instagram', links.instagram],
      ['YouTube', links.youtube],
      ['X', links.x]
    ].filter(function (x) { return Boolean(x[1]); });
    contactSoc.innerHTML = items.map(function (x) {
      return '<a href="' + x[1] + '" target="_blank" rel="noopener noreferrer">' + x[0] + '</a>';
    }).join('');
  }
  var copyEmailBtn = document.getElementById('ct-copy-email');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText('hello@therisebd.com');
      copyEmailBtn.textContent = 'Copied!';
      setTimeout(function () { copyEmailBtn.textContent = 'Copy Email'; }, 2000);
    });
  }
  var contactForm = document.getElementById('contact-page-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('ct-name').value.trim();
      var email = document.getElementById('ct-email').value.trim();
      var msg = document.getElementById('ct-message').value.trim();
      if (nr) {
        nr.submitAd({ name: name, company: email, slot: 'General Contact Message', message: msg });
      }
      var ctStatus = document.getElementById('ct-status');
      if (ctStatus) ctStatus.textContent = 'Sending your message…';
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'contact_message', name: name, email: email, message: msg })
      }).then(function (r) {
        if (ctStatus) ctStatus.textContent = r.ok ? 'Message sent to hello@therisebd.com & logged in Newsroom!' : 'Message logged in Newsroom!';
      }).catch(function () {
        if (ctStatus) ctStatus.textContent = 'Message logged in The Rise BD Newsroom!';
      });
      contactForm.reset();
    });
  }

  function buildFollowBox() {
    var box = document.createElement('section');
    box.className = 'reader-follow-box';
    var btns = [
      ['Facebook', links.facebook],
      ['LinkedIn', links.linkedin],
      ['Instagram', links.instagram],
      ['YouTube', links.youtube],
      ['X', links.x]
    ].filter(function (x) { return Boolean(x[1]); }).map(function (x) {
      return '<a href="' + x[1] + '" target="_blank" rel="noopener noreferrer">' + x[0] + '</a>';
    }).join('');
    box.innerHTML = '<div><strong>Follow The Rise</strong><p style="font-size:13px;color:var(--muted)">Stay updated with our latest stories, research &amp; spotlights.</p></div>' +
      '<div class="reader-follow-links">' + btns + '</div>';
    return box;
  }

  /* Article Reader: Share Bar + Category Dropdown + Follow Us */
  var artRoot = document.getElementById('article-page-root');
  if (artRoot) {
    var pageUrl = window.location.href;
    var artTitle = document.title;
    var shareBar = document.createElement('section');
    shareBar.className = 'art-share-bar';
    shareBar.innerHTML =
      '<div><strong>Share this article</strong><p style="font-size:12px;color:var(--muted)">Send via email, social media, or copy link</p></div>' +
      '<div class="art-share-btns">' +
      '<a class="art-share-btn" href="mailto:?subject=' + encodeURIComponent(artTitle) + '&body=' + encodeURIComponent(pageUrl) + '">✉ Email</a>' +
      '<a class="art-share-btn" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener">Facebook</a>' +
      '<a class="art-share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener">LinkedIn</a>' +
      '<a class="art-share-btn" href="https://wa.me/?text=' + encodeURIComponent(artTitle + ' ' + pageUrl) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a class="art-share-btn" href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(artTitle) + '&url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener">X</a>' +
      '<button type="button" class="art-share-btn" id="art-copy-link-btn">🔗 Copy Link</button>' +
      '</div>';

    var catJump = document.createElement('div');
    catJump.className = 'art-cat-jump';
    var cats = ['Policy & Society', 'AI & Tech', 'Science & Research', 'Climate & Environment', 'Startups & Business', 'Education & Careers', 'Health & Public Policy', 'Culture & Youth', 'World & Diplomacy', 'Analysis & Opinion'];
    catJump.innerHTML = '<label for="art-cat-select" style="font-size:13px;font-weight:700">Browse Category:</label>' +
      '<select id="art-cat-select"><option value="">Select any category…</option>' +
      cats.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
      '</select>';

    artRoot.append(shareBar, catJump, buildFollowBox());

    /* Also add compact inline share icons right inside the top byline bar (matching reference) */
    var bylineBar = artRoot.querySelector('.story-byline-bar');
    if (bylineBar && !bylineBar.querySelector('.art-top-share')) {
      var topShare = document.createElement('div');
      topShare.className = 'art-top-share';
      topShare.innerHTML =
        '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener" title="Share on Facebook" aria-label="Share on Facebook">f</a>' +
        '<a href="https://twitter.com/intent/tweet?text=' + encodeURIComponent(artTitle) + '&url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener" title="Share on X" aria-label="Share on X">𝕏</a>' +
        '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl) + '" target="_blank" rel="noopener" title="Share on LinkedIn" aria-label="Share on LinkedIn">in</a>' +
        '<a href="https://wa.me/?text=' + encodeURIComponent(artTitle + ' ' + pageUrl) + '" target="_blank" rel="noopener" title="Share on WhatsApp" aria-label="Share on WhatsApp">💬</a>' +
        '<button type="button" id="art-top-copy-btn" title="Copy link" aria-label="Copy link">🔗</button>';
      bylineBar.appendChild(topShare);
      var topCopyBtn = document.getElementById('art-top-copy-btn');
      if (topCopyBtn) {
        topCopyBtn.addEventListener('click', function () {
          if (navigator.clipboard) navigator.clipboard.writeText(pageUrl);
          topCopyBtn.textContent = '✓';
          setTimeout(function () { topCopyBtn.textContent = '🔗'; }, 2000);
        });
      }
    }

    var copyBtn = document.getElementById('art-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) navigator.clipboard.writeText(pageUrl);
        copyBtn.textContent = '✓ Link Copied!';
        setTimeout(function () { copyBtn.textContent = '🔗 Copy Link'; }, 2200);
      });
    }
    var catSel = document.getElementById('art-cat-select');
    if (catSel) {
      catSel.addEventListener('change', function () {
        if (catSel.value) window.location.href = 'articles.html';
      });
    }
  }

  /* Story Reader: Follow Us */
  var storyRoot = document.getElementById('story-article-root');
  if (storyRoot) {
    storyRoot.append(buildFollowBox());
  }
})();

/* Homepage 4-Card Select Grids (The Rise Select + Featured Spotlights + Latest Published Articles) */
(function () {
  function renderSelectGrid(containerId, items) {
    var grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = items.slice(0, 4).map(function (item, i) {
      var visual = item.img
        ? '<img src="' + item.img + '" alt="' + String(item.title || '').replace(/"/g, '&quot;') + '" loading="lazy" onerror="this.src=\'nasir%20.jpg\'">'
        : '<div class="rise-select-mono" style="background:' + (item.color || '#111827') + '">' + String(item.monogram || 'TR') + '</div>';
      return '<a class="rise-select-card" href="' + item.href + '">' +
        '<span class="rise-select-num">0' + (i + 1) + '</span>' +
        visual +
        '<div class="rise-select-copy"><span class="rise-select-cat">' + String(item.cat || '').replace(/</g, '&lt;') + '</span>' +
        '<h3>' + String(item.title || '').replace(/</g, '&lt;') + '</h3></div></a>';
    }).join('');
  }

  function mapStory(st) {
    return {
      cat: st.category || 'Spotlight',
      title: st.headline || (st.name + ' — ' + st.achievement),
      img: st.localImage || st.image || '',
      monogram: st.monogram || '',
      color: st.color || '#111827',
      href: 'story.html?id=' + encodeURIComponent(st.id)
    };
  }

  function mapArticle(art) {
    return {
      cat: art.topic || 'Newsroom',
      title: art.headline,
      img: art.image || 'nasir%20.jpg',
      href: 'article.html?id=' + encodeURIComponent(art.id)
    };
  }

  /* 1. The Rise Select (4 cards: Admin-selected first, filled to 4 with top articles & stories) */
  var nr = window.RiseNewsroom;
  var selected = nr ? (nr.load().riseSelectIds || []) : [];
  var riseSelectItems = [];
  var usedKeys = {};

  selected.forEach(function (sel) {
    if (riseSelectItems.length >= 4) return;
    if (sel.type === 'article' && typeof newsArticles !== 'undefined') {
      var a = newsArticles.find(function (x) { return x.id === sel.id; });
      if (a) { riseSelectItems.push(mapArticle(a)); usedKeys['article:' + a.id] = true; }
    } else if (sel.type === 'story' && typeof stories !== 'undefined') {
      var s = stories.find(function (x) { return x.id === sel.id; });
      if (s) { riseSelectItems.push(mapStory(s)); usedKeys['story:' + s.id] = true; }
    }
  });

  if (typeof newsArticles !== 'undefined') {
    newsArticles.forEach(function (a) {
      if (riseSelectItems.length < 4 && !usedKeys['article:' + a.id]) {
        riseSelectItems.push(mapArticle(a));
        usedKeys['article:' + a.id] = true;
      }
    });
  }
  if (typeof stories !== 'undefined') {
    stories.forEach(function (s) {
      if (riseSelectItems.length < 4 && !usedKeys['story:' + s.id]) {
        riseSelectItems.push(mapStory(s));
        usedKeys['story:' + s.id] = true;
      }
    });
  }
  renderSelectGrid('home-rise-select-grid', riseSelectItems);

  /* 2. Featured Spotlights (4 cards) */
  if (typeof stories !== 'undefined' && stories.length) {
    renderSelectGrid('home-select-spotlights', stories.slice(0, 4).map(mapStory));
  }

  /* 3. Latest Published Articles (4 cards) */
  if (typeof newsArticles !== 'undefined' && newsArticles.length) {
    renderSelectGrid('home-select-articles', newsArticles.slice(0, 4).map(mapArticle));
  }
})();

/* Newsletter 2x2 Topic Selector Logic */
(function () {
  var box = document.getElementById('nl-topic-cards');
  var countEl = document.getElementById('nl-selected-count');
  var selectAllBtn = document.getElementById('nl-select-all');
  if (!box) return;

  function syncCount() {
    var boxes = box.querySelectorAll('input[type="checkbox"]');
    var checked = 0;
    boxes.forEach(function (cb) {
      cb.closest('.nl-topic-card').classList.toggle('active', cb.checked);
      if (cb.checked) checked += 1;
    });
    if (countEl) countEl.textContent = checked + ' of ' + boxes.length + ' selected';
    if (selectAllBtn) selectAllBtn.textContent = checked === boxes.length ? 'Clear all' : 'Select all';
  }

  box.addEventListener('change', syncCount);
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () {
      var boxes = box.querySelectorAll('input[type="checkbox"]');
      var allChecked = Array.prototype.every.call(boxes, function (cb) { return cb.checked; });
      boxes.forEach(function (cb) { cb.checked = !allChecked; });
      syncCount();
    });
  }
  syncCount();
})();

/* Supabase Cloud Sync Hooks for Public Forms & Live Content Pull */
(function () {
  var sb = window.RiseSupabase;
  var nr = window.RiseNewsroom;
  if (!sb || !nr) return;

  /* Wrap public submission methods to also persist to Supabase Cloud */
  var origSubmitArt = nr.submitArticle;
  nr.submitArticle = function (payload) {
    var res = origSubmitArt(payload);
    sb.restFetch('article_submissions', {
      method: 'POST',
      body: {
        author: res.author, email: res.email, whatsapp: res.whatsapp,
        affiliation: res.affiliation, topic: res.topic, city: res.city,
        headline: res.headline, dek: res.dek, body_text: res.bodyText, sources: res.sources
      }
    }).catch(function () {});
    return res;
  };

  var origSubmitNom = nr.submitNomination;
  nr.submitNomination = function (payload) {
    var res = origSubmitNom(payload);
    sb.restFetch('nomination_submissions', {
      method: 'POST',
      body: {
        name: res.name, email: res.email, whatsapp: res.whatsapp,
        address: res.address, category: res.category, achievement: res.achievement,
        headline: res.headline, body_text: res.bodyText, proof_link: res.proofLink
      }
    }).catch(function () {});
    return res;
  };

  var origSubmitAd = nr.submitAd;
  nr.submitAd = function (payload) {
    var res = origSubmitAd(payload);
    sb.restFetch('ad_inquiries', {
      method: 'POST',
      body: { name: res.name, company: res.company, slot: res.slot, message: res.message }
    }).catch(function () {});
    return res;
  };

  var origAddSub = nr.addSubscriber;
  nr.addSubscriber = function (email, source, topics) {
    var clean = origAddSub(email, source, topics);
    if (clean) {
      sb.restFetch('newsletter_subscribers', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: { email: clean, source: source || 'index.html', topics: topics || ['Latest Stories'] }
      }).catch(function () {});
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe_welcome',
          email: clean,
          topics: topics || ['Latest Stories']
        })
      }).catch(function () {});
    }
    return clean;
  };

  function pruneDeletedFromDom() {
    var st = nr.load();
    var delS = st.deletedStoryIds || [];
    var delA = st.deletedArticleIds || [];
    (st.recycleBin || []).forEach(function (entry) {
      if (entry.kind === 'story' && entry.item && entry.item.id && delS.indexOf(entry.item.id) === -1) delS.push(entry.item.id);
      if (entry.kind === 'article' && entry.item && entry.item.id && delA.indexOf(entry.item.id) === -1) delA.push(entry.item.id);
    });
    delS.forEach(function (did) {
      document.querySelectorAll('a[href*="story.html?id=' + did + '"]').forEach(function (a) {
        var card = a.closest('article, .spotlight-card, .dual-card, .story-card');
        if (card) card.remove();
      });
    });
    delA.forEach(function (did) {
      document.querySelectorAll('a[href*="article.html?id=' + did + '"]').forEach(function (a) {
        var card = a.closest('article, .news-card');
        if (card) card.remove();
      });
    });
    var sg = document.getElementById('story-grid');
    if (sg) {
      var visCount = sg.querySelectorAll('.spotlight-card:not([hidden])').length;
      var fs = document.getElementById('filter-status');
      if (fs) fs.textContent = visCount ? ('Showing ' + visCount + ' spotlight' + (visCount === 1 ? '' : 's')) : 'No spotlights published right now.';
      document.querySelectorAll('.count-pill').forEach(function (p) { p.textContent = String(visCount); });
    }
  }
  pruneDeletedFromDom();

  /* Pull latest cloud content on public pages */
  var path = window.location.pathname.split('/').pop() || 'index.html';
  if (!document.getElementById('nr-lock-screen')) {
    sb.pullPublicContent().then(function (changed) {
      if (!changed) return;
      var st = nr.load();
      if (typeof newsArticles !== 'undefined') nr.hydrateArticles(newsArticles);
      if (typeof stories !== 'undefined') nr.hydrateStories(stories);
      if (typeof newsAuthors !== 'undefined') nr.hydrateAuthors(newsAuthors);
      pruneDeletedFromDom();
      if (path === 'careers.html' && Array.isArray(st.jobCirculars) && st.jobCirculars.length) {
        var cGrid = document.querySelector('#circulars .circular-grid');
        var roleSel = document.getElementById('car-role');
        if (cGrid) {
          cGrid.innerHTML = st.jobCirculars.map(function (job) {
            return '<article class="circular-card">' +
              '<div class="circular-top"><span class="circular-badge">' + String(job.type || 'OPENING').toUpperCase() + '</span><span class="circular-loc">' + String(job.location || 'Dhaka / Remote') + '</span></div>' +
              '<h3>' + String(job.title || '') + '</h3>' +
              '<p>' + String(job.description || '') + '</p>' +
              (job.deadline ? '<p class="circular-meta"><strong>Deadline:</strong> ' + String(job.deadline) + '</p>' : '') +
              '<button class="button navy apply-role-btn" type="button" data-role="' + String(job.title || '').replace(/"/g, '&quot;') + '">Apply Now →</button>' +
              '</article>';
          }).join('');
          cGrid.querySelectorAll('.apply-role-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
              if (roleSel) roleSel.value = btn.getAttribute('data-role') || '';
              var ap = document.getElementById('apply');
              if (ap) ap.scrollIntoView({ behavior: 'smooth' });
            });
          });
        }
        if (roleSel) {
          st.jobCirculars.forEach(function (job) {
            if (!Array.from(roleSel.options).some(function (o) { return o.value === job.title; })) {
              var opt = document.createElement('option');
              opt.value = job.title;
              opt.textContent = job.title;
              roleSel.appendChild(opt);
            }
          });
        }
      }
      if (path === 'ambassador.html' && Array.isArray(st.ambassadorCirculars) && st.ambassadorCirculars.length) {
        var tGrid = document.querySelector('.ambassador-page .standards-grid');
        var trSel = document.getElementById('amb-track');
        if (tGrid) {
          tGrid.innerHTML = st.ambassadorCirculars.map(function (tr) {
            return '<article class="standard-card">' +
              '<span class="eyebrow">' + String(tr.campus || 'BANGLADESH').toUpperCase() + '</span>' +
              '<h3>' + String(tr.title || '') + '</h3>' +
              '<p>' + String(tr.description || '') + '</p>' +
              (tr.perks ? '<p style="font-size:13px;opacity:.8"><strong>Perks:</strong> ' + String(tr.perks) + '</p>' : '') +
              '<a class="button navy small" href="#amb-apply">Apply Now →</a>' +
              '</article>';
          }).join('');
        }
        if (trSel) {
          st.ambassadorCirculars.forEach(function (tr) {
            if (!Array.from(trSel.options).some(function (o) { return o.value === tr.title; })) {
              var opt = document.createElement('option');
              opt.value = tr.title;
              opt.textContent = tr.title;
              trSel.appendChild(opt);
            }
          });
        }
      }
    });
    var params = new URLSearchParams(window.location.search);
    sb.restFetch('analytics_events', {
      method: 'POST',
      body: { page: path, item_id: params.get('id') || '', event_type: 'pageview' }
    }).catch(function () {});
  }
})();
