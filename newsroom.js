"use strict";

(function () {
  var nr = window.RiseNewsroom;
  if (!nr) return;

  var SESSION_USER_KEY = 'rise_nr_session_user';
  var lockScreen = document.getElementById('nr-lock-screen');
  var workspace = document.getElementById('nr-workspace');
  var lockForm = document.getElementById('nr-lock-form');
  var emailInput = document.getElementById('nr-login-email');
  var passInput = document.getElementById('nr-passcode-input');
  var lockError = document.getElementById('nr-lock-error');

  var ROLE_TABS = {
    Admin: ['insights', 'riseselect', 'articles', 'spotlights', 'authors', 'ads', 'newsletter', 'sections', 'team', 'recruitment', 'contacts', 'recyclebin', 'settings'],
    Editor: ['insights', 'riseselect', 'articles', 'spotlights', 'authors', 'recruitment', 'contacts', 'recyclebin'],
    Moderator: ['insights', 'articles', 'spotlights', 'newsletter', 'recruitment', 'contacts', 'recyclebin']
  };

  var currentUser = null;

  function applyRolePermissions(user) {
    currentUser = user;
    var allowed = ROLE_TABS[user.role] || ROLE_TABS.Moderator;
    var uName = document.getElementById('nr-user-name');
    var uEmail = document.getElementById('nr-user-email');
    var uRole = document.getElementById('nr-user-role');
    var uAvatar = document.getElementById('nr-user-avatar');
    if (uName) uName.textContent = user.name || 'Admin';
    if (uEmail) uEmail.textContent = user.email || '';
    if (uRole) uRole.textContent = String(user.role || 'ADMIN').toUpperCase();
    if (uAvatar) uAvatar.textContent = (user.name || 'A').charAt(0).toUpperCase();

    document.querySelectorAll('[data-nr-tab]').forEach(function (btn) {
      var tab = btn.getAttribute('data-nr-tab');
      btn.style.display = allowed.indexOf(tab) !== -1 ? '' : 'none';
    });

    /* Moderators can review queues but cannot direct-publish or delete live items */
    var isMod = user.role === 'Moderator';
    var directArt = document.getElementById('nr-direct-article-form');
    var directSpot = document.getElementById('nr-direct-spotlight-form');
    if (directArt) directArt.closest('.nr-panel').style.display = isMod ? 'none' : '';
    if (directSpot) directSpot.closest('.nr-panel').style.display = isMod ? 'none' : '';
  }

  function sbReady() {
    return window.RiseSupabase || null;
  }

  function sbRest(path, opts) {
    var sb = sbReady();
    if (!sb || typeof sb.getAccessToken !== 'function') return Promise.resolve(null);
    return sb.getAccessToken().then(function (tok) {
      if (!tok) return null;
      return sb.restFetch(path, Object.assign({ token: tok }, opts || {}));
    }).catch(function (err) {
      console.warn('Supabase sync skipped:', err && err.message ? err.message : err);
      return null;
    });
  }

  function sbSaveSetting(key, value) {
    return sbRest('site_settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { key: key, value: value, updated_at: new Date().toISOString() }
    });
  }

  function sbUpsertArticle(art) {
    if (!art) return;
    sbRest('news_articles?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: {
        id: art.id, topic: art.topic || 'Policy & Society', badge_class: art.badgeClass || 'policy',
        headline: art.headline, dek: art.dek || '', author_id: art.authorId || '',
        author: art.author || 'The Rise Editorial Desk', affiliation: art.affiliation || '',
        date_label: art.date || 'Today', read_time: art.readTime || '5 min read',
        image_url: art.image || '', image_caption: art.imageCaption || '',
        body: art.body || [], sources: art.sources || []
      }
    });
  }

  function sbUpsertSpotlight(story, isFeatured) {
    if (!story) return;
    sbRest('spotlights?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: {
        id: story.id, name: story.name, category: story.category || 'Research',
        cats: story.cats || story.category || 'Research', achievement: story.achievement || '',
        image_url: story.localImage || '', monogram: story.monogram || '', color: story.color || '#111827',
        summary: story.summary || '', headline: story.headline || story.name,
        featured_date: story.featuredDate || 'Featured', journey: story.journey || [],
        body: story.body || [], sources: story.sources || [], is_featured: !!isFeatured
      }
    });
  }

  function syncAdminFromSupabase() {
    var sb = sbReady();
    if (!sb) return Promise.resolve(false);
    return sb.getAccessToken().then(function (tok) {
      if (!tok) return false;
      return Promise.allSettled([
        sb.pullPublicContent(),
        sb.restFetch('article_submissions?select=*&order=submitted_at.desc', { token: tok }),
        sb.restFetch('nomination_submissions?select=*&order=submitted_at.desc', { token: tok }),
        sb.restFetch('ad_inquiries?select=*&order=submitted_at.desc', { token: tok }),
        sb.restFetch('newsletter_subscribers?select=*&order=subscribed_at.desc', { token: tok }),
        sb.restFetch('team_roles?select=*&order=created_at.asc', { token: tok }),
        sb.restFetch('ad_campaigns?select=*&order=created_at.desc', { token: tok }),
        sb.restFetch('analytics_events?select=*&order=created_at.desc&limit=500', { token: tok })
      ]).then(function (res) {
        var state = nr.load();
        if (res[1].status === 'fulfilled' && Array.isArray(res[1].value)) {
          state.articlesQueue = res[1].value.map(function (r) {
            return {
              id: r.id, status: r.status, author: r.author, email: r.email,
              whatsapp: r.whatsapp, affiliation: r.affiliation, topic: r.topic,
              city: r.city, headline: r.headline, dek: r.dek, bodyText: r.body_text,
              sources: r.sources, submittedAt: r.submitted_at
            };
          });
        }
        if (res[2].status === 'fulfilled' && Array.isArray(res[2].value)) {
          state.nominationsQueue = res[2].value.map(function (r) {
            return {
              id: r.id, status: r.status, name: r.name, email: r.email,
              whatsapp: r.whatsapp, address: r.address, category: r.category,
              achievement: r.achievement, headline: r.headline, bodyText: r.body_text,
              proofLink: r.proof_link, submittedAt: r.submitted_at
            };
          });
        }
        if (res[3].status === 'fulfilled' && Array.isArray(res[3].value)) {
          state.adsQueue = res[3].value.map(function (r) {
            return {
              id: r.id, status: r.status, name: r.name, company: r.company,
              slot: r.slot, message: r.message, submittedAt: r.submitted_at
            };
          });
        }
        if (res[4].status === 'fulfilled' && Array.isArray(res[4].value)) {
          state.subscribers = res[4].value.map(function (r) {
            return {
              id: r.id, email: r.email, source: r.source,
              topics: Array.isArray(r.topics) ? r.topics : ['Latest Stories'],
              subscribedAt: r.subscribed_at
            };
          });
        }
        if (res[5].status === 'fulfilled' && Array.isArray(res[5].value) && res[5].value.length) {
          state.team = res[5].value.map(function (r) {
            return { id: r.id, name: r.name, email: r.email, role: r.role };
          });
        }
        if (res[6].status === 'fulfilled' && Array.isArray(res[6].value)) {
          state.adCampaigns = res[6].value.map(function (c) {
            return {
              id: c.id, name: c.name, advertiser: c.advertiser, runBy: c.run_by,
              targets: Array.isArray(c.targets) ? c.targets : ['home_top'],
              bannerSize: c.banner_size, mediaType: c.media_type, mediaUrl: c.media_url,
              title: c.title, text: c.description, cta: c.cta, href: c.href,
              startAt: c.start_at, endAt: c.end_at, status: c.status,
              impressions: c.impressions, clicks: c.clicks, createdAt: c.created_at
            };
          });
        }
        if (res[7].status === 'fulfilled' && Array.isArray(res[7].value) && res[7].value.length) {
          var pageViews = {};
          var storyViews = {};
          var daily = {};
          var totalVisits = 0;
          res[7].value.forEach(function (ev) {
            var pg = ev.page || ev.target_id;
            var day = (ev.created_at || '').slice(0, 10);
            if (ev.event_type === 'pageview' && pg) {
              totalVisits += 1;
              pageViews[pg] = (pageViews[pg] || 0) + 1;
              if (day) {
                if (!daily[day]) daily[day] = { visits: 0, impressions: 0, unique: 0 };
                daily[day].visits += 1;
                daily[day].impressions += 4;
                daily[day].unique += 1;
              }
            }
            if (ev.event_type === 'story' && (ev.item_id || ev.target_id)) {
              var sid = ev.item_id || ev.target_id;
              storyViews[sid] = (storyViews[sid] || 0) + 1;
            }
          });
          state.analytics = state.analytics || { pageViews: {}, storyViews: {}, daily: {}, history: [] };
          state.analytics.totalVisits = Math.max(state.analytics.totalVisits || 0, totalVisits);
          state.analytics.uniqueVisitors = Math.max(state.analytics.uniqueVisitors || 0, totalVisits);
          state.analytics.totalImpressions = Math.max(state.analytics.totalImpressions || 0, totalVisits * 4);
          state.analytics.pageViews = Object.assign({}, state.analytics.pageViews, pageViews);
          state.analytics.storyViews = Object.assign({}, state.analytics.storyViews, storyViews);
          state.analytics.daily = Object.assign({}, state.analytics.daily, daily);
        }
        nr.save(state);
        if (typeof newsArticles !== 'undefined') nr.hydrateArticles(newsArticles);
        if (typeof stories !== 'undefined') nr.hydrateStories(stories);
        if (typeof newsAuthors !== 'undefined') nr.hydrateAuthors(newsAuthors);
        renderAll();
        return true;
      });
    }).catch(function () { return false; });
  }

  function unlock(user) {
    if (lockScreen) lockScreen.hidden = true;
    if (workspace) workspace.hidden = false;
    try { sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user)); } catch (e) {}
    applyRolePermissions(user);
    switchTab('insights');
    renderAll();
  }

  function lock() {
    try { sessionStorage.removeItem(SESSION_USER_KEY); } catch (e) {}
    currentUser = null;
    if (workspace) workspace.hidden = true;
    if (lockScreen) lockScreen.hidden = false;
    if (passInput) passInput.value = '';
  }

  /* Protected route check: verify active Supabase Auth session on load */
  (function checkProtectedSession() {
    var sb = sbReady();
    if (sb && typeof sb.getCurrentSession === 'function') {
      sb.getCurrentSession().then(function (user) {
        if (user) {
          unlock(user);
          syncAdminFromSupabase();
        } else {
          lock();
        }
      }).catch(function () { lock(); });
    } else {
      try {
        var savedUser = sessionStorage.getItem(SESSION_USER_KEY);
        if (savedUser) unlock(JSON.parse(savedUser));
      } catch (e) {}
    }
  })();

  if (lockForm) {
    lockForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = emailInput ? emailInput.value.trim() : '';
      var pw = passInput ? passInput.value : '';
      var sb = sbReady();
      if (sb && typeof sb.signIn === 'function') {
        if (lockError) lockError.textContent = 'Signing in via Supabase Auth…';
        sb.signIn(em, pw).then(function (user) {
          if (lockError) lockError.textContent = '';
          unlock(user);
          syncAdminFromSupabase();
        }).catch(function (err) {
          if (lockError) {
            lockError.textContent = (err && err.message ? err.message : 'Invalid email or password.') +
              ' (Ensure supabase-schema.sql is run & user exists in Supabase Auth -> Users)';
          }
        });
      } else {
        var user = nr.authenticateUser(em, pw);
        if (user) {
          if (lockError) lockError.textContent = '';
          unlock(user);
        } else {
          if (lockError) lockError.textContent = 'Invalid email or password.';
        }
      }
    });
  }

  var logoutBtn = document.getElementById('nr-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      var sb = sbReady();
      if (sb && typeof sb.signOut === 'function') {
        sb.signOut().finally(lock);
      } else {
        lock();
      }
    });
  }

  function switchTab(target) {
    document.querySelectorAll('[data-nr-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nr-tab') === target);
    });
    document.querySelectorAll('.nr-tab-panel').forEach(function (panel) {
      var match = panel.id === 'nr-tab-' + target;
      panel.hidden = !match;
      panel.classList.toggle('active', match);
    });
  }

  document.querySelectorAll('[data-nr-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-nr-tab'));
    });
  });

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    try {
      return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    } catch (e) {
      return iso || '';
    }
  }

  var PAGE_NAMES = {
    'index.html': 'Homepage',
    'articles.html': 'Articles & Newsroom',
    'article.html': 'Article Reader',
    'spotlights.html': 'Achiever Spotlights',
    'story.html': 'Spotlight Story Reader',
    'advertise.html': 'Advertise With Us',
    'about.html': 'About The Rise',
    'nominate.html': 'Submit a Nomination',
    'submit-article.html': 'Submit an Article',
    'author.html': 'Author Profiles',
    'careers.html': 'Careers & Jobs',
    'ambassador.html': 'Campus Ambassador',
    'standards.html': 'Editorial Standards'
  };

  function friendlyPageName(path) {
    var clean = String(path || '').split('/').pop() || 'index.html';
    return PAGE_NAMES[clean] || clean.replace('.html', '').replace(/-/g, ' ');
  }

  var TARGET_LABELS = {
    home_top: 'Homepage Top Leaderboard',
    home_lower: 'Homepage Lower Banner',
    article_inside: 'Inside News Articles',
    articles_front: 'Articles Newsroom Page',
    spotlights_page: 'Achiever Spotlights Page',
    all_pages: 'All Pages'
  };

  function renderPills(state) {
    var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = String(val); };
    var artCount = typeof newsArticles !== 'undefined' ? newsArticles.length : (state.publishedArticles || []).length;
    var spotCount = typeof stories !== 'undefined' ? stories.length : (state.publishedStories || []).length;
    var activeAdsCount = (state.adCampaigns || []).filter(function (c) { return c.status === 'active'; }).length + (state.popup && state.popup.active ? 1 : 0);
    var recruitCount = (state.adsQueue || []).filter(function (x) {
      return String(x.slot || '').indexOf('CAREER:') === 0 || String(x.slot || '').indexOf('AMBASSADOR:') === 0;
    }).length;
    var contactsCount = (state.adsQueue || []).filter(function (x) { return x.slot === 'General Contact Message'; }).length;
    set('nr-pill-articles', artCount);
    set('nr-pill-nominations', spotCount);
    set('nr-pill-ads', activeAdsCount);
    set('nr-pill-subs', (state.subscribers || []).length);
    set('nr-pill-recruit', recruitCount);
    set('nr-pill-contacts', contactsCount);
    set('nr-pill-bin', (state.recycleBin || []).length);
  }

  function showConfirmModal(opts, onConfirm) {
    var modal = document.getElementById('nr-confirm-modal');
    if (!modal) {
      if (window.confirm(opts.message || 'Are you sure?')) onConfirm();
      return;
    }
    var titleEl = document.getElementById('nr-modal-title');
    var msgEl = document.getElementById('nr-modal-msg');
    var okBtn = document.getElementById('nr-modal-ok');
    var cancelBtn = document.getElementById('nr-modal-cancel');
    if (titleEl) titleEl.textContent = opts.title || 'Confirm Action';
    if (msgEl) msgEl.textContent = opts.message || '';
    if (okBtn) okBtn.textContent = opts.confirmText || 'OK';
    modal.hidden = false;

    function close() {
      modal.hidden = true;
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', close);
      modal.removeEventListener('click', handleBackdrop);
    }
    function handleOk() { close(); onConfirm(); }
    function handleBackdrop(e) { if (e.target === modal) close(); }

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', handleBackdrop);
  }

  function confirmDelete(label, onConfirm) {
    showConfirmModal({
      title: 'Move to Recycle Bin?',
      message: 'Are you sure you want to delete "' + (label || 'this item') + '"? It will be moved to the Recycle Bin so you can restore it anytime.',
      confirmText: 'Move to Bin'
    }, onConfirm);
  }

  function moveToRecycleBin(kind, label, sub, item) {
    var st = nr.load();
    if (!Array.isArray(st.recycleBin)) st.recycleBin = [];
    st.recycleBin.unshift({
      id: 'bin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      kind: kind,
      label: label || 'Deleted Item',
      sub: sub || '',
      item: item,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser ? currentUser.name : 'Admin'
    });
    nr.save(st);
    sbSaveSetting('recycleBin', st.recycleBin);
  }

  function restoreFromRecycleBin(binId) {
    var st = nr.load();
    if (!Array.isArray(st.recycleBin)) return;
    var idx = st.recycleBin.findIndex(function (x) { return x.id === binId; });
    if (idx === -1) return;
    var entry = st.recycleBin.splice(idx, 1)[0];
    var it = entry.item;
    if (entry.kind === 'article' && it) {
      if (!Array.isArray(st.publishedArticles)) st.publishedArticles = [];
      st.publishedArticles.unshift(it);
      if (typeof newsArticles !== 'undefined' && !newsArticles.some(function (x) { return x.id === it.id; })) newsArticles.unshift(it);
      sbUpsertArticle(it);
    } else if (entry.kind === 'story' && it) {
      if (!Array.isArray(st.publishedStories)) st.publishedStories = [];
      st.publishedStories.unshift(it);
      if (typeof stories !== 'undefined' && !stories.some(function (x) { return x.id === it.id; })) stories.unshift(it);
      sbUpsertSpotlight(it, false);
    } else if (entry.kind === 'author' && it) {
      st.customAuthors = st.customAuthors || {};
      st.customAuthors[it.id] = it;
      if (typeof newsAuthors !== 'undefined') newsAuthors[it.id] = it;
      sbRest('authors?on_conflict=id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: { id: it.id, name: it.name, role: it.role, institution: it.institution || '', photo_url: it.photo || '', bio: it.bio || '', email: it.email || '', links: it.links || [] }
      });
    } else if (entry.kind === 'adCampaign' && it) {
      if (!Array.isArray(st.adCampaigns)) st.adCampaigns = [];
      st.adCampaigns.unshift(it);
      sbRest('ad_campaigns', {
        method: 'POST',
        body: {
          name: it.name, advertiser: it.advertiser, run_by: it.runBy, targets: it.targets || ['home_top'],
          banner_size: it.bannerSize, media_type: it.mediaType, media_url: it.mediaUrl, title: it.title,
          description: it.text, cta: it.cta, href: it.href, status: it.status || 'active'
        }
      });
    } else if (entry.kind === 'subscriber' && it) {
      if (!Array.isArray(st.subscribers)) st.subscribers = [];
      st.subscribers.unshift(it);
      sbRest('newsletter_subscribers?on_conflict=email', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: { email: it.email, source: it.source || 'index.html', topics: it.topics || ['Latest Stories'] }
      });
    } else if (entry.kind === 'customSection' && it) {
      if (!Array.isArray(st.customSections)) st.customSections = [];
      st.customSections.push(it);
      sbSaveSetting('customSections', st.customSections);
    } else if (entry.kind === 'teamMember' && it) {
      if (!Array.isArray(st.team)) st.team = [];
      st.team.push(it);
      sbRest('team_roles?on_conflict=email', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: { name: it.name, email: it.email, role: it.role }
      });
    } else if (entry.kind === 'collab' && it) {
      st.partnershipConfig = st.partnershipConfig || {};
      if (!Array.isArray(st.partnershipConfig.collabs)) st.partnershipConfig.collabs = [];
      st.partnershipConfig.collabs.unshift(it);
      sbSaveSetting('partnershipConfig', st.partnershipConfig);
    } else if (entry.kind === 'jobCircular' && it) {
      if (!Array.isArray(st.jobCirculars)) st.jobCirculars = [];
      st.jobCirculars.unshift(it);
      sbSaveSetting('jobCirculars', st.jobCirculars);
    } else if (entry.kind === 'ambassadorCircular' && it) {
      if (!Array.isArray(st.ambassadorCirculars)) st.ambassadorCirculars = [];
      st.ambassadorCirculars.unshift(it);
      sbSaveSetting('ambassadorCirculars', st.ambassadorCirculars);
    } else if (entry.kind === 'applicant' && it) {
      if (!Array.isArray(st.adsQueue)) st.adsQueue = [];
      st.adsQueue.unshift(it);
      sbRest('ad_inquiries', {
        method: 'POST',
        body: { name: it.name, company: it.company || '', slot: it.slot || '', message: it.message || '', status: it.status || 'new' }
      });
    }
    nr.save(st);
    sbSaveSetting('recycleBin', st.recycleBin);
  }

  function renderInsights(state) {
    var a = state.analytics || {};
    var pubCount = (typeof stories !== 'undefined' ? stories.length : 0) + (typeof newsArticles !== 'undefined' ? newsArticles.length : 0);
    var pendingCount = state.articlesQueue.filter(function (x) { return x.status === 'pending'; }).length +
      state.nominationsQueue.filter(function (x) { return x.status === 'pending'; }).length;

    /* 5-Column KPI Row matching reference */
    var kpiGrid = document.getElementById('nr-kpi-grid');
    if (kpiGrid) {
      var kpis = [
        { label: 'Total Page Views', value: a.totalVisits || 0, badge: 'Live', pos: true, sub: 'Across all pages' },
        { label: 'Unique Reach', value: a.uniqueVisitors || 0, badge: 'Sessions', pos: true, sub: 'Distinct visitors' },
        { label: 'Impressions', value: a.totalImpressions || 0, badge: 'Cards & Ads', pos: true, sub: 'Content exposures' },
        { label: 'Published Items', value: pubCount, badge: pendingCount + ' pending', pos: pendingCount === 0, sub: 'Articles + Spotlights' },
        { label: 'Mail Subscribers', value: state.subscribers.length, badge: 'Active List', pos: true, sub: 'Newsletter reach' }
      ];
      kpiGrid.innerHTML = kpis.map(function (k) {
        return '<div class="nr-kpi">' +
          '<span class="nr-kpi-lbl">' + esc(k.label) + '</span>' +
          '<strong class="nr-kpi-num">' + esc(k.value) + '</strong>' +
          '<div class="nr-kpi-foot"><span class="nr-trend ' + (k.pos ? 'up' : 'warn') + '">' + esc(k.badge) + '</span><span>' + esc(k.sub) + '</span></div>' +
          '</div>';
      }).join('');
    }

    /* Smooth SVG Line Chart */
    var lineBox = document.getElementById('nr-line-chart');
    if (lineBox) {
      var days = Object.keys(a.daily || {}).sort().slice(-7);
      if (!days.length) {
        lineBox.innerHTML = '<p class="nr-empty">No daily telemetry yet. Browse pages to see the live trend line.</p>';
      } else {
        if (days.length === 1) {
          var only = days[0];
          days = ['Prev', only];
          a.daily['Prev'] = { visits: 0, impressions: 0 };
        }
        var w = 540, h = 190, padX = 28, padY = 20;
        var maxY = Math.max.apply(null, days.map(function (d) { return Math.max(a.daily[d].impressions || 0, a.daily[d].visits || 0, 5); }));
        var ptsV = [], ptsI = [];
        days.forEach(function (d, idx) {
          var x = padX + (idx * (w - padX * 2)) / (days.length - 1);
          var yV = h - padY - ((a.daily[d].visits || 0) / maxY) * (h - padY * 2);
          var yI = h - padY - ((a.daily[d].impressions || 0) / maxY) * (h - padY * 2);
          ptsV.push(x.toFixed(1) + ',' + yV.toFixed(1));
          ptsI.push(x.toFixed(1) + ',' + yI.toFixed(1));
        });
        var circlesV = ptsV.map(function (pt, idx) {
          var xy = pt.split(',');
          return '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="4" fill="#111827" stroke="#fff" stroke-width="2"><title>' + esc(days[idx]) + ': ' + (a.daily[days[idx]].visits || 0) + ' visits</title></circle>';
        }).join('');
        var xLabels = days.map(function (d, idx) {
          var x = padX + (idx * (w - padX * 2)) / (days.length - 1);
          return '<text x="' + x.toFixed(1) + '" y="' + (h - 2) + '" text-anchor="middle" font-size="10" fill="#9CA3AF">' + esc(d === 'Prev' ? 'Start' : d.slice(5)) + '</text>';
        }).join('');
        lineBox.innerHTML =
          '<div class="nr-chart-meta"><span><i class="nr-dot dark"></i> Visits</span><span><i class="nr-dot purple"></i> Impressions</span></div>' +
          '<svg viewBox="0 0 ' + w + ' ' + h + '" class="nr-svg-chart">' +
          '<line x1="' + padX + '" y1="' + (h - padY) + '" x2="' + (w - padX) + '" y2="' + (h - padY) + '" stroke="#ECEEF2" stroke-width="1"/>' +
          '<line x1="' + padX + '" y1="' + (h / 2) + '" x2="' + (w - padX) + '" y2="' + (h / 2) + '" stroke="#F3F4F6" stroke-dasharray="4 4" stroke-width="1"/>' +
          '<polyline fill="none" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="5 4" points="' + ptsI.join(' ') + '"/>' +
          '<polyline fill="none" stroke="#111827" stroke-width="2.5" points="' + ptsV.join(' ') + '"/>' +
          circlesV + xLabels +
          '</svg>';
      }
    }

    /* Top Performing Content (Holdings-style table) */
    var topReads = document.getElementById('nr-top-reads');
    if (topReads) {
      var rows = [];
      Object.keys(a.articleReads || {}).forEach(function (id) {
        var f = typeof newsArticles !== 'undefined' ? newsArticles.find(function (x) { return x.id === id; }) : null;
        rows.push({ title: f ? f.headline : id, tag: 'ART', color: '#6335EB', reads: a.articleReads[id], href: 'article.html?id=' + encodeURIComponent(id) });
      });
      Object.keys(a.storyReads || {}).forEach(function (id) {
        var s = typeof stories !== 'undefined' ? stories.find(function (x) { return x.id === id; }) : null;
        rows.push({ title: s ? s.name : id, tag: 'SPT', color: '#10B981', reads: a.storyReads[id], href: 'story.html?id=' + encodeURIComponent(id) });
      });
      rows.sort(function (x, y) { return y.reads - x.reads; });
      if (!rows.length) {
        topReads.innerHTML = '<p class="nr-empty">Open any article or spotlight to track live read weights.</p>';
      } else {
        var totalR = rows.reduce(function (sum, r) { return sum + r.reads; }, 0) || 1;
        topReads.innerHTML = rows.slice(0, 5).map(function (r) {
          var pct = Math.round((r.reads / totalR) * 100);
          return '<div class="nr-holding-row">' +
            '<div class="nr-holding-left"><span class="nr-icon-circle" style="background:' + r.color + '">' + r.tag + '</span>' +
            '<a href="' + esc(r.href) + '" target="_blank">' + esc(r.title) + '</a></div>' +
            '<div class="nr-holding-right"><span class="nr-weight-bar"><i style="width:' + pct + '%;background:' + r.color + '"></i></span><strong>' + r.reads + '</strong><span class="nr-pct-chip">' + pct + '%</span></div>' +
            '</div>';
        }).join('');
      }
    }

    /* Donut Chart (Content Mix) */
    var donutBox = document.getElementById('nr-donut-chart');
    if (donutBox) {
      var artN = typeof newsArticles !== 'undefined' ? newsArticles.length : 1;
      var spotN = typeof stories !== 'undefined' ? stories.length : 1;
      var subN = state.subscribers.length;
      var adN = state.adsQueue.length;
      var sum = artN + spotN + subN + adN || 1;
      var p1 = Math.round((spotN / sum) * 100);
      var p2 = Math.round((artN / sum) * 100);
      var p3 = Math.max(0, 100 - p1 - p2);
      donutBox.innerHTML =
        '<div class="nr-donut" style="background:conic-gradient(#1F2937 0% ' + p1 + '%, #F59E0B ' + p1 + '% ' + (p1 + p2) + '%, #8B5CF6 ' + (p1 + p2) + '% 100%)"><div class="nr-donut-hole"><strong>' + sum + '</strong><small>Total</small></div></div>' +
        '<div class="nr-donut-legend">' +
        '<div><span><i style="background:#1F2937"></i>Spotlights</span><strong>' + spotN + '</strong></div>' +
        '<div><span><i style="background:#F59E0B"></i>Articles</span><strong>' + artN + '</strong></div>' +
        '<div><span><i style="background:#8B5CF6"></i>Subscribers &amp; Ads</span><strong>' + (subN + adN) + '</strong></div>' +
        '</div>';
    }

    /* Page Traffic */
    var pageBreak = document.getElementById('nr-page-breakdown');
    if (pageBreak) {
      var pages = Object.keys(a.pageViews || {}).map(function (p) { return { page: p, count: a.pageViews[p] }; }).sort(function (x, y) { return y.count - x.count; });
      pageBreak.innerHTML = pages.length
        ? pages.slice(0, 6).map(function (p) { return '<div class="nr-clean-row"><span><strong>' + esc(friendlyPageName(p.page)) + '</strong></span><strong>' + p.count + ' views</strong></div>'; }).join('')
        : '<p class="nr-empty">No page visits recorded yet.</p>';
    }

    /* Activity Feed */
    var feed = document.getElementById('nr-activity-feed');
    if (feed) {
      var items = [];
      state.articlesQueue.slice(0, 2).forEach(function (x) { items.push({ tag: 'ARTICLE', text: x.headline, time: fmtDate(x.submittedAt) }); });
      state.nominationsQueue.slice(0, 2).forEach(function (x) { items.push({ tag: 'NOMINATION', text: x.name + ' — ' + x.achievement, time: fmtDate(x.submittedAt) }); });
      state.adsQueue.slice(0, 2).forEach(function (x) { items.push({ tag: 'AD ENQUIRY', text: x.company || x.name, time: fmtDate(x.submittedAt) }); });
      feed.innerHTML = items.length
        ? items.slice(0, 4).map(function (it) { return '<div class="nr-feed-item"><span class="nr-feed-tag">' + esc(it.tag) + '</span><p>' + esc(it.text) + '</p><small>' + esc(it.time) + '</small></div>'; }).join('')
        : '<p class="nr-empty">No recent submissions yet.</p>';
    }
  }

  function renderArticlesTab(state) {
    /* Author select dropdown */
    var sel = document.getElementById('nr-art-author-select');
    if (sel && typeof newsAuthors !== 'undefined') {
      nr.hydrateAuthors(newsAuthors);
      var opts = Object.keys(newsAuthors).map(function (id) {
        return '<option value="' + esc(id) + '">' + esc(newsAuthors[id].name) + '</option>';
      }).join('');
      sel.innerHTML = opts + '<option value="">The Rise Editorial Desk</option>';
    }

    /* Queue */
    var qBox = document.getElementById('nr-articles-list');
    if (qBox) {
      if (!state.articlesQueue.length) {
        qBox.innerHTML = '<p class="nr-empty">No pending article submissions.</p>';
      } else {
        qBox.innerHTML = state.articlesQueue.map(function (item) {
          var actions = item.status === 'pending'
            ? '<button type="button" class="nr-btn nr-btn-primary nr-sm" data-accept-art="' + esc(item.id) + '">Accept &amp; Publish</button>' +
              '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-reject-art="' + esc(item.id) + '">Reject</button>'
            : '<span class="nr-pill-soft">' + esc(item.status.toUpperCase()) + '</span>';
          return '<div class="nr-q-card"><div><strong>' + esc(item.headline) + '</strong><p class="nr-sub-caption">By ' + esc(item.author) + ' · ' + esc(item.topic) + '</p></div><div class="nr-row-actions">' + actions + '</div></div>';
        }).join('');
        qBox.querySelectorAll('[data-accept-art]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-accept-art');
            var pub = nr.acceptArticle(id);
            sbRest('article_submissions?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'published' } });
            if (pub) sbUpsertArticle(pub);
            renderAll();
          });
        });
        qBox.querySelectorAll('[data-reject-art]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-reject-art');
            nr.rejectArticle(id);
            sbRest('article_submissions?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'rejected' } });
            renderAll();
          });
        });
      }
    }

    /* Published Articles Manage, Rise Select & Delete */
    var pubBox = document.getElementById('nr-published-articles-list');
    if (pubBox && typeof newsArticles !== 'undefined') {
      var list = newsArticles.slice();
      var selList = state.riseSelectIds || [];
      pubBox.innerHTML = list.length ? list.map(function (art) {
        var inSelect = selList.some(function (x) { return x.type === 'article' && x.id === art.id; });
        var selBtn = '<button type="button" class="nr-btn ' + (inSelect ? 'nr-btn-primary' : 'nr-btn-ghost') + ' nr-sm" data-sel-art="' + esc(art.id) + '">' + (inSelect ? '★ In Rise Select' : '+ Rise Select') + '</button>';
        var editBtn = currentUser && currentUser.role !== 'Moderator'
          ? '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-edit-pub-art="' + esc(art.id) + '">Edit</button>'
          : '';
        var delBtn = currentUser && currentUser.role !== 'Moderator'
          ? '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-pub-art="' + esc(art.id) + '">Delete</button>'
          : '';
        return '<div class="nr-clean-row"><div><a href="article.html?id=' + encodeURIComponent(art.id) + '" target="_blank"><strong>' + esc(art.headline) + '</strong></a><br><small>' + esc(art.author) + ' · ' + esc(art.topic) + ' · ' + esc(art.date) + '</small></div><div class="nr-row-actions">' + selBtn + editBtn + delBtn + '</div></div>';
      }).join('') : '<p class="nr-empty">No published articles.</p>';

      pubBox.querySelectorAll('[data-edit-pub-art]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-edit-pub-art');
          var art = newsArticles.find(function (x) { return x.id === id; });
          if (!art) return;
          var editIdEl = document.getElementById('nr-art-edit-id');
          if (editIdEl) editIdEl.value = art.id;
          document.getElementById('nr-art-headline').value = art.headline || '';
          document.getElementById('nr-art-dek').value = art.dek || '';
          document.getElementById('nr-art-topic').value = art.topic || 'Policy & Society';
          var authSel = document.getElementById('nr-art-author-select');
          if (authSel && art.authorId) authSel.value = art.authorId;
          var dateEl = document.getElementById('nr-art-date');
          if (dateEl) dateEl.value = art.date || '';
          document.getElementById('nr-art-image').value = art.image || '';
          document.getElementById('nr-art-sources').value = (art.sources && art.sources[0] && art.sources[0].url) ? art.sources[0].url : '';
          setArticleBlocksFromBody(art.body || []);
          var subBtn = document.getElementById('nr-art-submit-btn');
          var canBtn = document.getElementById('nr-art-cancel-edit');
          if (subBtn) subBtn.textContent = 'Save Article Changes →';
          if (canBtn) canBtn.hidden = false;
          var form = document.getElementById('nr-direct-article-form');
          if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      pubBox.querySelectorAll('[data-sel-art]').forEach(function (b) {
        b.addEventListener('click', function () {
          nr.toggleRiseSelect('article', b.getAttribute('data-sel-art'));
          sbSaveSetting('riseSelectIds', nr.load().riseSelectIds || []);
          renderAll();
        });
      });

      pubBox.querySelectorAll('[data-del-pub-art]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-pub-art');
          var art = newsArticles.find(function (x) { return x.id === id; });
          confirmDelete(art ? art.headline : 'this article', function () {
            if (art) moveToRecycleBin('article', art.headline, (art.author || '') + ' · ' + (art.topic || ''), Object.assign({}, art));
            nr.deletePublishedArticle(id);
            sbRest('news_articles?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
            var idx = newsArticles.findIndex(function (x) { return x.id === id; });
            if (idx !== -1) newsArticles.splice(idx, 1);
            renderAll();
          });
        });
      });
    }
  }

  function renderSpotlightsTab(state) {
    var qBox = document.getElementById('nr-nominations-list');
    if (qBox) {
      if (!state.nominationsQueue.length) {
        qBox.innerHTML = '<p class="nr-empty">No pending nominations.</p>';
      } else {
        qBox.innerHTML = state.nominationsQueue.map(function (item) {
          var actions = item.status === 'pending'
            ? '<button type="button" class="nr-btn nr-btn-primary nr-sm" data-accept-nom="' + esc(item.id) + '">Accept &amp; Publish</button>' +
              '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-reject-nom="' + esc(item.id) + '">Reject</button>'
            : '<span class="nr-pill-soft">' + esc(item.status.toUpperCase()) + '</span>';
          return '<div class="nr-q-card"><div><strong>' + esc(item.name) + '</strong><p class="nr-sub-caption">' + esc(item.achievement) + '</p></div><div class="nr-row-actions">' + actions + '</div></div>';
        }).join('');
        qBox.querySelectorAll('[data-accept-nom]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-accept-nom');
            var pub = nr.acceptNomination(id);
            sbRest('nomination_submissions?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'published' } });
            if (pub) sbUpsertSpotlight(pub, false);
            renderAll();
          });
        });
        qBox.querySelectorAll('[data-reject-nom]').forEach(function (b) {
          b.addEventListener('click', function () {
            var id = b.getAttribute('data-reject-nom');
            nr.rejectNomination(id);
            sbRest('nomination_submissions?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: 'rejected' } });
            renderAll();
          });
        });
      }
    }

    var pubBox = document.getElementById('nr-published-stories-list');
    if (pubBox && typeof stories !== 'undefined') {
      var selListS = state.riseSelectIds || [];
      pubBox.innerHTML = stories.map(function (s) {
        var inSel = selListS.some(function (x) { return x.type === 'story' && x.id === s.id; });
        var selBtn = '<button type="button" class="nr-btn ' + (inSel ? 'nr-btn-primary' : 'nr-btn-ghost') + ' nr-sm" data-sel-story="' + esc(s.id) + '">' + (inSel ? '★ In Rise Select' : '+ Rise Select') + '</button>';
        var delBtn = currentUser && currentUser.role !== 'Moderator'
          ? '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-story="' + esc(s.id) + '">Delete</button>'
          : '';
        return '<div class="nr-clean-row"><div><a href="story.html?id=' + encodeURIComponent(s.id) + '" target="_blank"><strong>' + esc(s.name) + '</strong></a><br><small>' + esc(s.achievement) + '</small></div><div class="nr-row-actions">' + selBtn + delBtn + '</div></div>';
      }).join('');
      pubBox.querySelectorAll('[data-sel-story]').forEach(function (b) {
        b.addEventListener('click', function () {
          nr.toggleRiseSelect('story', b.getAttribute('data-sel-story'));
          sbSaveSetting('riseSelectIds', nr.load().riseSelectIds || []);
          renderAll();
        });
      });
      pubBox.querySelectorAll('[data-del-story]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-story');
          var stObj = stories.find(function (x) { return x.id === id; });
          confirmDelete(stObj ? stObj.name : 'this spotlight', function () {
            if (stObj) moveToRecycleBin('story', stObj.name, stObj.achievement || '', Object.assign({}, stObj));
            nr.deletePublishedStory(id);
            sbRest('spotlights?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
            var idx = stories.findIndex(function (x) { return x.id === id; });
            if (idx !== -1) stories.splice(idx, 1);
            renderAll();
          });
        });
      });
    }
  }

  function renderAuthorsTab() {
    var box = document.getElementById('nr-authors-list');
    if (!box || typeof newsAuthors === 'undefined') return;
    nr.hydrateAuthors(newsAuthors);
    var keys = Object.keys(newsAuthors);
    box.innerHTML = keys.length ? keys.map(function (id) {
      var au = newsAuthors[id];
      return '<div class="nr-clean-row"><div><a href="author.html?id=' + encodeURIComponent(id) + '" target="_blank"><strong>' + esc(au.name) + '</strong></a><br><small>' + esc(au.role) + ' · ' + esc(au.institution) + '</small></div>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-author="' + esc(id) + '">Delete</button></div>';
    }).join('') : '<p class="nr-empty">No authors yet.</p>';
    box.querySelectorAll('[data-del-author]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-author');
        var au = newsAuthors[id];
        confirmDelete(au ? au.name : 'this author', function () {
          if (au) moveToRecycleBin('author', au.name, (au.role || '') + ' · ' + (au.institution || ''), Object.assign({}, au));
          nr.deleteAuthor(id);
          sbRest('authors?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          delete newsAuthors[id];
          renderAll();
        });
      });
    });
  }

  function renderAdsTab(state) {
    var sumBox = document.getElementById('nr-ads-summary-bar');
    if (sumBox) {
      var allCamps = state.adCampaigns || [];
      var activeCamps = allCamps.filter(function (x) { return x.status === 'active'; }).length;
      var totImps = allCamps.reduce(function (acc, x) { return acc + (x.impressions || 0); }, 0);
      var totClicks = allCamps.reduce(function (acc, x) { return acc + (x.clicks || 0); }, 0);
      var avgCtr = totImps ? ((totClicks / totImps) * 100).toFixed(1) : '0.0';
      var estReach = Math.round(totImps * 0.72);
      var popActive = state.popup && state.popup.active ? 'ON' : 'OFF';
      sumBox.innerHTML = [
        { lbl: 'Active Campaigns', val: activeCamps + ' / ' + allCamps.length },
        { lbl: 'Total Impressions', val: totImps },
        { lbl: 'Est. Ad Reach', val: estReach },
        { lbl: 'Clicks & Avg CTR', val: totClicks + ' (' + avgCtr + '%)' },
        { lbl: 'Site-Wide Popup', val: popActive }
      ].map(function (k) {
        return '<div class="nr-kpi"><span class="nr-kpi-lbl">' + esc(k.lbl) + '</span><strong class="nr-kpi-num" style="font-size:20px">' + esc(k.val) + '</strong></div>';
      }).join('');
    }

    var campBox = document.getElementById('nr-ad-campaigns-table');
    if (campBox) {
      var camps = state.adCampaigns || [];
      campBox.innerHTML = camps.length ? camps.map(function (c) {
        var imps = c.impressions || 0;
        var clicks = c.clicks || 0;
        var ctr = imps ? ((clicks / imps) * 100).toFixed(1) : '0.0';
        var startMs = c.startAt ? Date.parse(c.startAt) : Date.parse(c.createdAt);
        var daysRunning = Math.max(1, Math.ceil((Date.now() - startMs) / 86400000));
        var targetsText = (c.targets || []).map(function (t) { return TARGET_LABELS[t] || t; }).join(', ');
        return '<div class="nr-clean-row" style="flex-wrap:wrap">' +
          '<div style="min-width:220px;flex:1"><strong>' + esc(c.name) + '</strong> <span class="nr-trend ' + (c.status === 'active' ? 'up' : 'warn') + '">' + esc(c.status.toUpperCase()) + '</span>' +
          '<br><small>Sponsor: <strong>' + esc(c.advertiser) + '</strong> · Run by: ' + esc(c.runBy) + ' · ' + esc(c.bannerSize) + ' (' + esc(c.mediaType) + ')</small>' +
          '<br><small>Targets: ' + esc(targetsText) + ' · Running: <strong>' + daysRunning + ' day(s)</strong></small></div>' +
          '<div class="nr-row-actions">' +
          '<span class="nr-pill-soft">' + imps + ' Imps</span>' +
          '<span class="nr-pill-soft">' + clicks + ' Clicks (' + ctr + '% CTR)</span>' +
          '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-detail-camp="' + esc(c.id) + '">Details</button>' +
          '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-edit-camp="' + esc(c.id) + '">Edit</button>' +
          '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-toggle-camp="' + esc(c.id) + '">' + (c.status === 'active' ? 'Pause' : 'Resume') + '</button>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-camp="' + esc(c.id) + '">Delete</button>' +
          '</div></div>';
      }).join('') : '<p class="nr-empty">No active ad campaigns yet. Launch your first targeted ad above.</p>';

      campBox.querySelectorAll('[data-detail-camp]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-detail-camp');
          var camp = (nr.load().adCampaigns || []).find(function (x) { return x.id === id; });
          if (!camp) return;
          var dModal = document.getElementById('nr-camp-detail-modal');
          if (!dModal) return;
          var imps = camp.impressions || 0;
          var clicks = camp.clicks || 0;
          var ctr = imps ? ((clicks / imps) * 100).toFixed(1) : '0.0';
          var reach = Math.round(imps * 0.72);
          var startMs = camp.startAt ? Date.parse(camp.startAt) : Date.parse(camp.createdAt);
          var daysRunning = Math.max(1, Math.ceil((Date.now() - startMs) / 86400000));
          var targetsText = (camp.targets || []).map(function (t) { return TARGET_LABELS[t] || t; }).join(', ');
          document.getElementById('nr-cd-status').textContent = String(camp.status || 'active').toUpperCase() + ' CAMPAIGN';
          document.getElementById('nr-cd-title').textContent = camp.name || 'Campaign Details';
          var mediaHtml = '';
          if (camp.mediaUrl && camp.mediaType === 'video') {
            mediaHtml = '<video class="nr-detail-preview" src="' + esc(camp.mediaUrl) + '" controls muted></video>';
          } else if (camp.mediaUrl && camp.mediaType !== 'text') {
            mediaHtml = '<img class="nr-detail-preview" src="' + esc(camp.mediaUrl) + '" alt="' + esc(camp.name) + '">';
          }
          document.getElementById('nr-cd-body').innerHTML =
            mediaHtml +
            '<div class="nr-detail-grid">' +
              '<div><small>Sponsor / Brand</small><br><strong>' + esc(camp.advertiser) + '</strong></div>' +
              '<div><small>Launched By</small><br><strong>' + esc(camp.runBy || 'Admin') + '</strong></div>' +
              '<div><small>Started / Created</small><br><strong>' + esc(fmtDate(camp.startAt || camp.createdAt)) + '</strong></div>' +
              '<div><small>End Schedule</small><br><strong>' + (camp.endAt ? esc(fmtDate(camp.endAt)) : 'Continuous') + '</strong></div>' +
              '<div><small>Impressions &amp; Reach</small><br><strong>' + imps + ' Imps (~' + reach + ' Reach)</strong></div>' +
              '<div><small>Clicks &amp; CTR</small><br><strong>' + clicks + ' Clicks (' + ctr + '%)</strong></div>' +
              '<div><small>Format &amp; Size</small><br><strong>' + esc(camp.bannerSize) + ' · ' + esc(camp.mediaType) + '</strong></div>' +
              '<div><small>Active Duration</small><br><strong>' + daysRunning + ' day(s)</strong></div>' +
            '</div>' +
            '<div><small>Placements:</small> <strong>' + esc(targetsText) + '</strong></div>' +
            '<div><small>Headline:</small> <strong>' + esc(camp.title) + '</strong>' + (camp.text ? '<br><small>' + esc(camp.text) + '</small>' : '') + '</div>' +
            '<div><small>Destination:</small> <a href="' + esc(camp.href) + '" target="_blank" rel="noopener">' + esc(camp.href) + '</a></div>';
          dModal.hidden = false;
          var closeBtn = document.getElementById('nr-cd-close');
          var hideFn = function () { dModal.hidden = true; };
          closeBtn.onclick = hideFn;
          dModal.onclick = function (ev) { if (ev.target === dModal) hideFn(); };
        });
      });

      campBox.querySelectorAll('[data-edit-camp]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-edit-camp');
          var camp = (nr.load().adCampaigns || []).find(function (x) { return x.id === id; });
          if (!camp) return;
          var editIdEl = document.getElementById('nr-ac-edit-id');
          if (editIdEl) editIdEl.value = camp.id;
          document.getElementById('nr-ac-name').value = camp.name || '';
          document.getElementById('nr-ac-advertiser').value = camp.advertiser || '';
          document.getElementById('nr-ac-size').value = camp.bannerSize || '1280x120';
          document.getElementById('nr-ac-media-type').value = camp.mediaType || 'image';
          document.getElementById('nr-ac-media-url').value = camp.mediaUrl || '';
          document.getElementById('nr-ac-title').value = camp.title || '';
          document.getElementById('nr-ac-text').value = camp.text || '';
          document.getElementById('nr-ac-cta').value = camp.cta || '';
          document.getElementById('nr-ac-href').value = camp.href || '';
          document.getElementById('nr-ac-start').value = camp.startAt ? String(camp.startAt).slice(0, 16) : '';
          document.getElementById('nr-ac-end').value = camp.endAt ? String(camp.endAt).slice(0, 16) : '';
          var tgs = camp.targets || [];
          document.querySelectorAll('input[name="nr-ac-target"]').forEach(function (cb) {
            cb.checked = tgs.indexOf(cb.value) !== -1;
          });
          var subBtn = document.getElementById('nr-ac-submit-btn');
          var canBtn = document.getElementById('nr-ac-cancel-edit');
          if (subBtn) subBtn.textContent = 'Save Ad Campaign Changes →';
          if (canBtn) canBtn.hidden = false;
          var form = document.getElementById('nr-ad-campaign-form');
          if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      campBox.querySelectorAll('[data-toggle-camp]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-toggle-camp');
          nr.toggleAdCampaign(id);
          var updated = (nr.load().adCampaigns || []).find(function (x) { return x.id === id; });
          if (updated) sbRest('ad_campaigns?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: updated.status } });
          renderAll();
        });
      });
      campBox.querySelectorAll('[data-del-camp]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-camp');
          var camp = (nr.load().adCampaigns || []).find(function (x) { return x.id === id; });
          confirmDelete(camp ? camp.name : 'this ad campaign', function () {
            if (camp) moveToRecycleBin('adCampaign', camp.name, camp.advertiser || '', Object.assign({}, camp));
            nr.deleteAdCampaign(id);
            sbRest('ad_campaigns?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
            renderAll();
          });
        });
      });
    }

    var box = document.getElementById('nr-ads-list');
    if (!box) return;
    var adInquiriesOnly = (state.adsQueue || []).filter(function (x) {
      var sl = String(x.slot || '');
      return sl.indexOf('CAREER:') !== 0 && sl.indexOf('AMBASSADOR:') !== 0 && sl !== 'General Contact Message';
    });
    box.innerHTML = adInquiriesOnly.length ? adInquiriesOnly.map(function (item) {
      return '<div class="nr-q-card"><div><strong>' + esc(item.company || item.name) + '</strong> <span class="nr-pill-soft">' + esc(item.slot) + '</span><p class="nr-sub-caption">' + esc(item.message) + '</p></div>' +
        '<select data-ad-status="' + esc(item.id) + '">' +
        ['new', 'contacted', 'active'].map(function (st) { return '<option value="' + st + '"' + (item.status === st ? ' selected' : '') + '>' + st.toUpperCase() + '</option>'; }).join('') +
        '</select></div>';
    }).join('') : '<p class="nr-empty">No advertiser enquiries yet.</p>';
    box.querySelectorAll('[data-ad-status]').forEach(function (s) {
      s.addEventListener('change', function () {
        var id = s.getAttribute('data-ad-status');
        nr.updateAdStatus(id, s.value);
        sbRest('ad_inquiries?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: s.value } });
        renderPills(nr.load());
      });
    });
  }

  function renderNewsletterTab(state) {
    var subBox = document.getElementById('nr-subs-list');
    if (subBox) {
      subBox.innerHTML = state.subscribers.length ? state.subscribers.map(function (s) {
        var topicsTxt = Array.isArray(s.topics) && s.topics.length ? s.topics.join(', ') : 'Latest Stories';
        return '<div class="nr-clean-row"><div><strong>' + esc(s.email) + '</strong><br><small>Topics: <strong>' + esc(topicsTxt) + '</strong> · via ' + esc(friendlyPageName(s.source)) + ' · ' + esc(fmtDate(s.subscribedAt)) + '</small></div>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-sub="' + esc(s.id) + '">Remove</button></div>';
      }).join('') : '<p class="nr-empty">No subscribers yet.</p>';
      subBox.querySelectorAll('[data-del-sub]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-sub');
          var sub = (nr.load().subscribers || []).find(function (x) { return x.id === id; });
          confirmDelete(sub ? sub.email : 'this subscriber', function () {
            if (sub) moveToRecycleBin('subscriber', sub.email, 'Source: ' + (sub.source || 'index.html'), Object.assign({}, sub));
            nr.deleteSubscriber(id);
            sbRest('newsletter_subscribers?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
            renderAll();
          });
        });
      });
    }
    var histBox = document.getElementById('nr-campaigns-history');
    if (histBox) {
      histBox.innerHTML = (state.campaigns || []).slice(0, 5).map(function (c) {
        return '<div class="nr-clean-row"><div><strong>' + esc(c.subject) + '</strong><br><small>Sent to ' + c.recipientCount + ' subscribers · ' + esc(fmtDate(c.sentAt)) + '</small></div></div>';
      }).join('');
    }
  }

  function renderSectionsTab(state) {
    var box = document.getElementById('nr-sections-list');
    if (!box) return;
    box.innerHTML = state.customSections.length ? state.customSections.map(function (sec) {
      return '<div class="nr-clean-row"><div><strong>' + esc(sec.title) + '</strong><br><small>' + esc(sec.eyebrow) + ' · Theme: ' + esc(sec.theme) + '</small></div>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-sec="' + esc(sec.id) + '">Delete</button></div>';
    }).join('') : '<p class="nr-empty">No custom homepage sections added yet.</p>';
    box.querySelectorAll('[data-del-sec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-sec');
        var sec = (nr.load().customSections || []).find(function (x) { return x.id === id; });
        confirmDelete(sec ? sec.title : 'this section', function () {
          if (sec) moveToRecycleBin('customSection', sec.title, sec.eyebrow || '', Object.assign({}, sec));
          nr.deleteCustomSection(id);
          sbSaveSetting('customSections', nr.load().customSections || []);
          renderAll();
        });
      });
    });
  }

  function renderTeamTab(state) {
    var box = document.getElementById('nr-team-list');
    if (!box) return;
    box.innerHTML = state.team.map(function (t) {
      return '<div class="nr-clean-row"><div><strong>' + esc(t.name) + '</strong> <span class="nr-pill-soft">' + esc(t.role) + '</span><br><small>' + esc(t.email) + '</small></div>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-tm="' + esc(t.id) + '">Remove</button></div>';
    }).join('');
    box.querySelectorAll('[data-del-tm]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-tm');
        var tm = (nr.load().team || []).find(function (x) { return x.id === id; });
        confirmDelete(tm ? tm.name : 'this team member', function () {
          if (tm) moveToRecycleBin('teamMember', tm.name, (tm.role || '') + ' · ' + (tm.email || ''), Object.assign({}, tm));
          nr.deleteTeamMember(id);
          sbRest('team_roles?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          renderAll();
        });
      });
    });
  }

  function renderRiseSelectTab(state) {
    var activeBox = document.getElementById('nr-riseselect-active');
    var pickerBox = document.getElementById('nr-riseselect-picker');
    if (!activeBox || !pickerBox) return;
    var selList = state.riseSelectIds || [];

    activeBox.innerHTML = selList.length ? selList.map(function (sel, i) {
      var title = sel.id;
      if (sel.type === 'article' && typeof newsArticles !== 'undefined') {
        var a = newsArticles.find(function (x) { return x.id === sel.id; });
        if (a) title = a.headline;
      } else if (sel.type === 'story' && typeof stories !== 'undefined') {
        var s = stories.find(function (x) { return x.id === sel.id; });
        if (s) title = s.name + ' — ' + s.achievement;
      }
      return '<div class="nr-clean-row"><div><span class="nr-pill-soft">0' + (i + 1) + ' · ' + esc(sel.type.toUpperCase()) + '</span> <strong>' + esc(title) + '</strong></div>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-rs-toggle="' + esc(sel.type) + ':' + esc(sel.id) + '">Remove</button></div>';
    }).join('') : '<p class="nr-empty">No custom selections yet — pick any 4 items on the right to highlight at the top of the homepage.</p>';

    var allItems = [];
    if (typeof newsArticles !== 'undefined') {
      newsArticles.forEach(function (a) { allItems.push({ type: 'article', id: a.id, title: a.headline, sub: 'Article · ' + a.topic }); });
    }
    if (typeof stories !== 'undefined') {
      stories.forEach(function (s) { allItems.push({ type: 'story', id: s.id, title: s.name + ' — ' + s.achievement, sub: 'Spotlight · ' + s.category }); });
    }

    pickerBox.innerHTML = allItems.map(function (it) {
      var isOn = selList.some(function (x) { return x.type === it.type && x.id === it.id; });
      return '<div class="nr-clean-row"><div><strong>' + esc(it.title) + '</strong><br><small>' + esc(it.sub) + '</small></div>' +
        '<button type="button" class="nr-btn ' + (isOn ? 'nr-btn-primary' : 'nr-btn-ghost') + ' nr-sm" data-rs-toggle="' + esc(it.type) + ':' + esc(it.id) + '">' + (isOn ? '★ Selected' : '+ Select') + '</button></div>';
    }).join('');

    [activeBox, pickerBox].forEach(function (container) {
      container.querySelectorAll('[data-rs-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          var parts = b.getAttribute('data-rs-toggle').split(':');
          nr.toggleRiseSelect(parts[0], parts.slice(1).join(':'));
          renderAll();
        });
      });
    });
  }

  function renderRecycleBinTab(state) {
    var box = document.getElementById('nr-recycle-list');
    if (!box) return;
    var bin = state.recycleBin || [];
    box.innerHTML = bin.length ? bin.map(function (entry) {
      return '<div class="nr-clean-row"><div><span class="nr-pill-soft">' + esc(String(entry.kind || '').toUpperCase()) + '</span> <strong>' + esc(entry.label) + '</strong>' +
        '<br><small>' + (entry.sub ? esc(entry.sub) + ' · ' : '') + 'Deleted by ' + esc(entry.deletedBy || 'Admin') + ' · ' + esc(fmtDate(entry.deletedAt)) + '</small></div>' +
        '<div class="nr-row-actions">' +
        '<button type="button" class="nr-btn nr-btn-primary nr-sm" data-bin-restore="' + esc(entry.id) + '">↺ Restore</button>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-bin-purge="' + esc(entry.id) + '">Delete Forever</button>' +
        '</div></div>';
    }).join('') : '<p class="nr-empty">Recycle Bin is empty. Deleted items will appear here.</p>';

    box.querySelectorAll('[data-bin-restore]').forEach(function (b) {
      b.addEventListener('click', function () {
        restoreFromRecycleBin(b.getAttribute('data-bin-restore'));
        renderAll();
      });
    });
    box.querySelectorAll('[data-bin-purge]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pid = b.getAttribute('data-bin-purge');
        showConfirmModal({
          title: 'Delete Forever?',
          message: 'This will permanently erase the item from your Recycle Bin and cannot be undone.',
          confirmText: 'Delete Forever'
        }, function () {
          var st = nr.load();
          st.recycleBin = (st.recycleBin || []).filter(function (x) { return x.id !== pid; });
          nr.save(st);
          sbSaveSetting('recycleBin', st.recycleBin);
          renderAll();
        });
      });
    });
  }

  var emptyBinBtn = document.getElementById('nr-empty-bin-btn');
  if (emptyBinBtn) {
    emptyBinBtn.addEventListener('click', function () {
      var st = nr.load();
      if (!(st.recycleBin || []).length) return;
      showConfirmModal({
        title: 'Empty Recycle Bin?',
        message: 'Permanently delete all ' + st.recycleBin.length + ' items in the Recycle Bin? This cannot be undone.',
        confirmText: 'Empty Bin'
      }, function () {
        st.recycleBin = [];
        nr.save(st);
        sbSaveSetting('recycleBin', []);
        renderAll();
      });
    });
  }

  function parseApplicantDetails(item) {
    var parsed = {};
    try { parsed = JSON.parse(item.message || '{}'); } catch (e) {}
    if (!parsed || typeof parsed !== 'object') parsed = {};
    return {
      email: parsed['Email Address'] || '',
      whatsapp: parsed['WhatsApp Number'] || '',
      city: parsed['City / Country'] || parsed['City / District'] || '',
      inst: parsed['University / College / Workplace'] || '',
      portfolio: parsed['Portfolio / CV / LinkedIn'] || parsed['LinkedIn / Facebook Profile'] || '',
      note: parsed['Short Pitch'] || parsed['Motivation & Impact Plan'] || item.message || '',
      roleOrTrack: String(item.slot || '').replace(/^(CAREER:|AMBASSADOR:)/, '')
    };
  }

  function openInterviewModal(appItem, info) {
    var modal = document.getElementById('nr-interview-modal');
    if (!modal) return;
    document.getElementById('nr-iv-app-id').value = appItem.id;
    document.getElementById('nr-iv-email').value = info.email || '';
    document.getElementById('nr-iv-name').value = appItem.name || '';
    document.getElementById('nr-iv-role').value = info.roleOrTrack || '';
    document.getElementById('nr-iv-msg').textContent = '';
    modal.hidden = false;
  }

  function renderApplicantList(boxId, items, emptyText) {
    var box = document.getElementById(boxId);
    if (!box) return;
    box.innerHTML = items.length ? items.map(function (item) {
      var info = parseApplicantDetails(item);
      var metaParts = [info.email, info.whatsapp, info.city, info.inst].filter(Boolean).join(' · ');
      var statusLabel = item.status === 'contacted' ? 'INTERVIEW SENT' : (item.status === 'active' ? 'ACCEPTED' : 'NEW');
      return '<div class="nr-q-card" style="flex-wrap:wrap">' +
        '<div style="flex:1;min-width:240px"><strong>' + esc(item.name) + '</strong> <span class="nr-pill-soft">' + esc(info.roleOrTrack) + '</span> <span class="nr-trend ' + (item.status === 'active' ? 'up' : 'warn') + '">' + esc(statusLabel) + '</span>' +
        '<p class="nr-sub-caption" style="margin:4px 0">' + esc(metaParts || item.company) + '</p>' +
        (info.portfolio ? '<p class="nr-sub-caption"><a href="' + esc(info.portfolio) + '" target="_blank" rel="noopener">View Portfolio / Profile ↗</a></p>' : '') +
        '<p class="nr-sub-caption">' + esc(info.note) + '</p></div>' +
        '<div class="nr-row-actions">' +
        '<button type="button" class="nr-btn nr-btn-primary nr-sm" data-iv-app="' + esc(item.id) + '">📅 Interview &amp; Email</button>' +
        '<select data-app-status="' + esc(item.id) + '">' +
        '<option value="new"' + (item.status === 'new' ? ' selected' : '') + '>NEW</option>' +
        '<option value="contacted"' + (item.status === 'contacted' ? ' selected' : '') + '>INTERVIEW SENT</option>' +
        '<option value="active"' + (item.status === 'active' ? ' selected' : '') + '>ACCEPTED</option>' +
        '</select>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-app="' + esc(item.id) + '">Delete</button>' +
        '</div></div>';
    }).join('') : '<p class="nr-empty">' + esc(emptyText) + '</p>';

    box.querySelectorAll('[data-iv-app]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-iv-app');
        var item = (nr.load().adsQueue || []).find(function (x) { return x.id === id; });
        if (item) openInterviewModal(item, parseApplicantDetails(item));
      });
    });
    box.querySelectorAll('[data-app-status]').forEach(function (s) {
      s.addEventListener('change', function () {
        var id = s.getAttribute('data-app-status');
        nr.updateAdStatus(id, s.value);
        sbRest('ad_inquiries?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: s.value } });
        renderAll();
      });
    });
    box.querySelectorAll('[data-del-app]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-app');
        var item = (nr.load().adsQueue || []).find(function (x) { return x.id === id; });
        confirmDelete(item ? item.name : 'this applicant', function () {
          if (item) moveToRecycleBin('applicant', item.name, item.slot || '', Object.assign({}, item));
          var st = nr.load();
          st.adsQueue = (st.adsQueue || []).filter(function (x) { return x.id !== id; });
          nr.save(st);
          sbRest('ad_inquiries?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          renderAll();
        });
      });
    });
  }

  function renderRecruitmentTab(state) {
    var jobsBox = document.getElementById('nr-jobs-list');
    if (jobsBox) {
      var jobs = state.jobCirculars || [];
      jobsBox.innerHTML = jobs.length ? jobs.map(function (j) {
        return '<div class="nr-clean-row"><div><strong>' + esc(j.title) + '</strong> <span class="nr-pill-soft">' + esc(j.type || 'Opening') + '</span><br><small>' + esc(j.location || 'Remote') + (j.deadline ? ' · Deadline: ' + esc(j.deadline) : '') + '</small></div>' +
          '<div class="nr-row-actions"><button type="button" class="nr-btn nr-btn-ghost nr-sm" data-edit-job="' + esc(j.id) + '">Edit</button>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-job="' + esc(j.id) + '">Delete</button></div></div>';
      }).join('') : '<p class="nr-empty">No custom job circulars posted yet.</p>';
      jobsBox.querySelectorAll('[data-edit-job]').forEach(function (b) {
        b.addEventListener('click', function () {
          var j = (nr.load().jobCirculars || []).find(function (x) { return x.id === b.getAttribute('data-edit-job'); });
          if (!j) return;
          document.getElementById('nr-job-edit-id').value = j.id;
          document.getElementById('nr-job-title').value = j.title || '';
          document.getElementById('nr-job-type').value = j.type || 'Part-Time';
          document.getElementById('nr-job-location').value = j.location || '';
          document.getElementById('nr-job-deadline').value = j.deadline || '';
          document.getElementById('nr-job-desc').value = j.description || '';
          document.getElementById('nr-job-submit-btn').textContent = 'Save Job Circular →';
          document.getElementById('nr-job-cancel-edit').hidden = false;
        });
      });
      jobsBox.querySelectorAll('[data-del-job]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-job');
          var st = nr.load();
          var j = (st.jobCirculars || []).find(function (x) { return x.id === id; });
          confirmDelete(j ? j.title : 'this job circular', function () {
            if (j) moveToRecycleBin('jobCircular', j.title, j.type || '', Object.assign({}, j));
            st = nr.load();
            st.jobCirculars = (st.jobCirculars || []).filter(function (x) { return x.id !== id; });
            nr.save(st);
            sbSaveSetting('jobCirculars', st.jobCirculars);
            renderAll();
          });
        });
      });
    }

    var ambBox = document.getElementById('nr-amb-circulars-list');
    if (ambBox) {
      var tracks = state.ambassadorCirculars || [];
      ambBox.innerHTML = tracks.length ? tracks.map(function (t) {
        return '<div class="nr-clean-row"><div><strong>' + esc(t.title) + '</strong> <span class="nr-pill-soft">' + esc(t.campus || 'All Campuses') + '</span><br><small>' + esc(t.perks || '') + '</small></div>' +
          '<div class="nr-row-actions"><button type="button" class="nr-btn nr-btn-ghost nr-sm" data-edit-amb="' + esc(t.id) + '">Edit</button>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-amb="' + esc(t.id) + '">Delete</button></div></div>';
      }).join('') : '<p class="nr-empty">No custom ambassador/volunteer calls posted yet.</p>';
      ambBox.querySelectorAll('[data-edit-amb]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = (nr.load().ambassadorCirculars || []).find(function (x) { return x.id === b.getAttribute('data-edit-amb'); });
          if (!t) return;
          document.getElementById('nr-amb-edit-id').value = t.id;
          document.getElementById('nr-amb-title').value = t.title || '';
          document.getElementById('nr-amb-campus').value = t.campus || '';
          document.getElementById('nr-amb-perks').value = t.perks || '';
          document.getElementById('nr-amb-desc').value = t.description || '';
          document.getElementById('nr-amb-submit-btn').textContent = 'Save Track Call →';
          document.getElementById('nr-amb-cancel-edit').hidden = false;
        });
      });
      ambBox.querySelectorAll('[data-del-amb]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-amb');
          var st = nr.load();
          var t = (st.ambassadorCirculars || []).find(function (x) { return x.id === id; });
          confirmDelete(t ? t.title : 'this track call', function () {
            if (t) moveToRecycleBin('ambassadorCircular', t.title, t.campus || '', Object.assign({}, t));
            st = nr.load();
            st.ambassadorCirculars = (st.ambassadorCirculars || []).filter(function (x) { return x.id !== id; });
            nr.save(st);
            sbSaveSetting('ambassadorCirculars', st.ambassadorCirculars);
            renderAll();
          });
        });
      });
    }

    var jobApps = (state.adsQueue || []).filter(function (x) { return String(x.slot || '').indexOf('CAREER:') === 0; });
    var ambApps = (state.adsQueue || []).filter(function (x) { return String(x.slot || '').indexOf('AMBASSADOR:') === 0; });
    renderApplicantList('nr-job-applicants-list', jobApps, 'No job applications yet.');
    renderApplicantList('nr-amb-applicants-list', ambApps, 'No ambassador or volunteer applications yet.');
  }

  function renderContactsTab(state) {
    var box = document.getElementById('nr-contact-messages-list');
    if (!box) return;
    var msgs = (state.adsQueue || []).filter(function (x) { return x.slot === 'General Contact Message'; });
    box.innerHTML = msgs.length ? msgs.map(function (m) {
      var email = m.company || '';
      var stLabel = m.status === 'contacted' ? 'REPLIED' : (m.status === 'active' ? 'RESOLVED' : 'NEW');
      return '<div class="nr-q-card" style="flex-wrap:wrap">' +
        '<div style="flex:1;min-width:240px"><strong>' + esc(m.name) + '</strong> <span class="nr-pill-soft">' + esc(email) + '</span> <span class="nr-trend ' + (m.status === 'active' ? 'up' : 'warn') + '">' + esc(stLabel) + '</span>' +
        (m.submittedAt ? '<br><small>' + esc(fmtDate(m.submittedAt)) + '</small>' : '') +
        '<p class="nr-sub-caption" style="margin-top:6px">' + esc(m.message) + '</p></div>' +
        '<div class="nr-row-actions">' +
        (email ? '<a class="nr-btn nr-btn-primary nr-sm" href="mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Re: Your message to The Rise BD') + '">✉ Reply</a>' : '') +
        '<select data-ct-status="' + esc(m.id) + '">' +
        '<option value="new"' + (m.status === 'new' ? ' selected' : '') + '>NEW</option>' +
        '<option value="contacted"' + (m.status === 'contacted' ? ' selected' : '') + '>REPLIED</option>' +
        '<option value="active"' + (m.status === 'active' ? ' selected' : '') + '>RESOLVED</option>' +
        '</select>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-ct="' + esc(m.id) + '">Delete</button>' +
        '</div></div>';
    }).join('') : '<p class="nr-empty">No Contact Us messages yet.</p>';

    box.querySelectorAll('[data-ct-status]').forEach(function (s) {
      s.addEventListener('change', function () {
        var id = s.getAttribute('data-ct-status');
        nr.updateAdStatus(id, s.value);
        sbRest('ad_inquiries?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: { status: s.value } });
        renderAll();
      });
    });
    box.querySelectorAll('[data-del-ct]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-ct');
        var item = (nr.load().adsQueue || []).find(function (x) { return x.id === id; });
        confirmDelete(item ? ('message from ' + item.name) : 'this message', function () {
          if (item) moveToRecycleBin('applicant', item.name, 'Contact Message · ' + (item.company || ''), Object.assign({}, item));
          var st = nr.load();
          st.adsQueue = (st.adsQueue || []).filter(function (x) { return x.id !== id; });
          nr.save(st);
          sbRest('ad_inquiries?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          renderAll();
        });
      });
    });
  }

  function renderAll() {
    var state = nr.load();
    renderPills(state);
    renderInsights(state);
    renderRiseSelectTab(state);
    renderArticlesTab(state);
    renderSpotlightsTab(state);
    renderAuthorsTab();
    renderAdsTab(state);
    renderNewsletterTab(state);
    renderSectionsTab(state);
    renderTeamTab(state);
    renderRecruitmentTab(state);
    renderContactsTab(state);
    renderRecycleBinTab(state);
  }

  /* Form Handlers */
  function uploadFileToMedia(file, onUrl, statusEl) {
    if (!file) return;
    if (statusEl) statusEl.textContent = 'Uploading image…';
    var sb = sbReady();
    if (sb && typeof sb.uploadMedia === 'function') {
      sb.uploadMedia(file).then(function (url) {
        if (url) {
          onUrl(url);
          if (statusEl) statusEl.textContent = 'Image uploaded!';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () { onUrl(reader.result); if (statusEl) statusEl.textContent = 'Image attached!'; };
        reader.readAsDataURL(file);
      }).catch(function () {
        var reader = new FileReader();
        reader.onload = function () { onUrl(reader.result); if (statusEl) statusEl.textContent = 'Image attached!'; };
        reader.readAsDataURL(file);
      });
    } else {
      var reader = new FileReader();
      reader.onload = function () { onUrl(reader.result); if (statusEl) statusEl.textContent = 'Image attached!'; };
      reader.readAsDataURL(file);
    }
  }

  /* Alternating Text + Optional Image Section Builder (standard editorial font) */
  var blocksBox = document.getElementById('nr-art-blocks');
  var addBlockBtn = document.getElementById('nr-add-art-block');
  var rteToolbar = document.getElementById('nr-rte-toolbar');
  var activeBlockEditor = null;

  function createArticleBlockEl(idx, initial) {
    var data = initial || {};
    var wrap = document.createElement('div');
    wrap.className = 'nr-art-block';
    wrap.innerHTML =
      '<div class="nr-art-block-head"><span>Section ' + (idx + 1) + '</span>' +
      (idx > 0 ? '<button type="button" class="nr-btn nr-btn-danger nr-sm nr-remove-block">Remove</button>' : '') +
      '</div>' +
      '<div class="nr-rte-editor" contenteditable="true" data-placeholder="Write paragraphs for this section..."></div>' +
      '<div class="nr-upload-row">' +
        '<input type="text" class="nr-block-img-url" placeholder="Optional photo after this section (URL or upload →)" value="' + esc(data.imageUrl || '') + '">' +
        '<label class="nr-upload-btn">📷 Photo<input type="file" class="nr-block-img-file" accept="image/*" hidden></label>' +
      '</div>' +
      '<input type="text" class="nr-block-img-cap" placeholder="Optional photo caption" value="' + esc(data.caption || '') + '"' + (data.imageUrl ? '' : ' hidden') + '>' +
      '<img class="nr-art-block-preview" alt="Section preview"' + (data.imageUrl ? ' src="' + esc(data.imageUrl) + '"' : ' hidden') + '>';

    var ed = wrap.querySelector('.nr-rte-editor');
    if (data.html) ed.innerHTML = data.html;
    ed.addEventListener('focus', function () { activeBlockEditor = ed; });

    var urlIn = wrap.querySelector('.nr-block-img-url');
    var fileIn = wrap.querySelector('.nr-block-img-file');
    var capIn = wrap.querySelector('.nr-block-img-cap');
    var prevImg = wrap.querySelector('.nr-art-block-preview');

    function syncPreview(val) {
      var clean = String(val || '').trim();
      if (clean) {
        prevImg.src = clean;
        prevImg.hidden = false;
        capIn.hidden = false;
      } else {
        prevImg.removeAttribute('src');
        prevImg.hidden = true;
        capIn.hidden = true;
      }
    }
    urlIn.addEventListener('input', function () { syncPreview(urlIn.value); });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      uploadFileToMedia(f, function (url) {
        urlIn.value = url;
        syncPreview(url);
      }, document.getElementById('nr-art-pub-msg'));
    });

    var remBtn = wrap.querySelector('.nr-remove-block');
    if (remBtn) {
      remBtn.addEventListener('click', function () {
        wrap.remove();
        renumberArticleBlocks();
      });
    }
    return wrap;
  }

  function renumberArticleBlocks() {
    if (!blocksBox) return;
    blocksBox.querySelectorAll('.nr-art-block').forEach(function (blk, i) {
      var sp = blk.querySelector('.nr-art-block-head span');
      if (sp) sp.textContent = 'Section ' + (i + 1);
    });
  }

  function initDefaultArticleBlocks() {
    if (!blocksBox) return;
    blocksBox.innerHTML = '';
    blocksBox.appendChild(createArticleBlockEl(0, {}));
    blocksBox.appendChild(createArticleBlockEl(1, {}));
    activeBlockEditor = blocksBox.querySelector('.nr-rte-editor');
  }

  function setArticleBlocksFromBody(bodyArr) {
    if (!blocksBox) return;
    var combined = (bodyArr || []).map(function (p) {
      var t = String(p || '').trim();
      return /^<[a-z]/i.test(t) ? t : '<p>' + esc(t) + '</p>';
    }).join('');
    var tmp = document.createElement('div');
    tmp.innerHTML = combined;
    var sections = [];
    var curHtml = '';
    Array.from(tmp.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && node.tagName === 'FIGURE' && node.querySelector('img')) {
        var img = node.querySelector('img');
        var cap = node.querySelector('figcaption');
        sections.push({
          html: curHtml,
          imageUrl: img.getAttribute('src') || '',
          caption: cap ? cap.textContent : ''
        });
        curHtml = '';
      } else {
        curHtml += node.outerHTML || esc(node.textContent || '');
      }
    });
    if (curHtml.trim() || !sections.length) {
      sections.push({ html: curHtml, imageUrl: '', caption: '' });
    }
    blocksBox.innerHTML = '';
    sections.forEach(function (sec, i) {
      blocksBox.appendChild(createArticleBlockEl(i, sec));
    });
    activeBlockEditor = blocksBox.querySelector('.nr-rte-editor');
  }

  function collectArticleBlocksContent() {
    if (!blocksBox) return { bodyHtml: '', bodyText: '' };
    var htmlParts = [];
    var textParts = [];
    blocksBox.querySelectorAll('.nr-art-block').forEach(function (blk) {
      var ed = blk.querySelector('.nr-rte-editor');
      var urlIn = blk.querySelector('.nr-block-img-url');
      var capIn = blk.querySelector('.nr-block-img-cap');
      var h = ed ? ed.innerHTML.trim() : '';
      var t = ed ? (ed.innerText || '').trim() : '';
      var imgUrl = urlIn ? urlIn.value.trim() : '';
      var cap = capIn ? capIn.value.trim() : '';
      if (t) {
        htmlParts.push(h);
        textParts.push(t);
      }
      if (imgUrl) {
        htmlParts.push('<figure class="story-inline-figure"><img src="' + esc(imgUrl) + '" alt="' + esc(cap || 'Article photo') + '" loading="lazy">' + (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>');
      }
    });
    return { bodyHtml: htmlParts.join('\n'), bodyText: textParts.join('\n\n') };
  }

  if (blocksBox) initDefaultArticleBlocks();
  if (addBlockBtn) {
    addBlockBtn.addEventListener('click', function () {
      var count = blocksBox.querySelectorAll('.nr-art-block').length;
      var el = createArticleBlockEl(count, {});
      blocksBox.appendChild(el);
      var ed = el.querySelector('.nr-rte-editor');
      if (ed) { activeBlockEditor = ed; ed.focus(); }
    });
  }

  if (rteToolbar) {
    rteToolbar.querySelectorAll('[data-rte-cmd]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ed = activeBlockEditor || (blocksBox && blocksBox.querySelector('.nr-rte-editor'));
        if (ed) ed.focus();
        document.execCommand(btn.getAttribute('data-rte-cmd'), false, null);
      });
    });
    var sizeSel = document.getElementById('nr-rte-size');
    if (sizeSel) sizeSel.addEventListener('change', function () {
      if (!sizeSel.value) return;
      var ed = activeBlockEditor || (blocksBox && blocksBox.querySelector('.nr-rte-editor'));
      if (ed) ed.focus();
      document.execCommand('fontSize', false, sizeSel.value);
      sizeSel.value = '';
    });
    var blockSel = document.getElementById('nr-rte-block');
    if (blockSel) blockSel.addEventListener('change', function () {
      var ed = activeBlockEditor || (blocksBox && blocksBox.querySelector('.nr-rte-editor'));
      if (ed) ed.focus();
      document.execCommand('formatBlock', false, blockSel.value);
    });
    var linkBtn = document.getElementById('nr-rte-link-btn');
    if (linkBtn) linkBtn.addEventListener('click', function () {
      var url = prompt('Enter link URL (https://...)');
      if (url) {
        var ed = activeBlockEditor || (blocksBox && blocksBox.querySelector('.nr-rte-editor'));
        if (ed) ed.focus();
        document.execCommand('createLink', false, url);
      }
    });
  }

  var artCoverInput = document.getElementById('nr-art-image-file');
  if (artCoverInput) {
    artCoverInput.addEventListener('change', function () {
      var f = artCoverInput.files && artCoverInput.files[0];
      if (!f) return;
      uploadFileToMedia(f, function (url) {
        document.getElementById('nr-art-image').value = url;
      }, document.getElementById('nr-art-pub-msg'));
    });
  }

  var spotPhotoInput = document.getElementById('nr-spot-image-file');
  if (spotPhotoInput) {
    spotPhotoInput.addEventListener('change', function () {
      var f = spotPhotoInput.files && spotPhotoInput.files[0];
      if (!f) return;
      uploadFileToMedia(f, function (url) {
        document.getElementById('nr-spot-image').value = url;
      }, document.getElementById('nr-spot-pub-msg'));
    });
  }

  var dirArtForm = document.getElementById('nr-direct-article-form');
  var cancelEditBtn = document.getElementById('nr-art-cancel-edit');
  function resetArticleFormMode() {
    var editIdEl = document.getElementById('nr-art-edit-id');
    if (editIdEl) editIdEl.value = '';
    initDefaultArticleBlocks();
    var subBtn = document.getElementById('nr-art-submit-btn');
    if (subBtn) subBtn.textContent = 'Publish Article Now →';
    if (cancelEditBtn) cancelEditBtn.hidden = true;
    if (dirArtForm) dirArtForm.reset();
  }
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetArticleFormMode);

  if (dirArtForm) {
    dirArtForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var editIdEl = document.getElementById('nr-art-edit-id');
      var editId = editIdEl ? editIdEl.value.trim() : '';
      var collected = collectArticleBlocksContent();
      var bodyHtml = collected.bodyHtml;
      var bodyText = collected.bodyText;
      if (!bodyText && !/<img/i.test(bodyHtml)) {
        document.getElementById('nr-art-pub-msg').textContent = 'Please write your article content first.';
        return;
      }
      var authorId = document.getElementById('nr-art-author-select').value;
      var authorObj = (typeof newsAuthors !== 'undefined' && authorId) ? newsAuthors[authorId] : null;
      var dateInput = document.getElementById('nr-art-date');
      var payload = {
        headline: document.getElementById('nr-art-headline').value.trim(),
        dek: document.getElementById('nr-art-dek').value.trim(),
        topic: document.getElementById('nr-art-topic').value,
        authorId: authorId,
        author: authorObj ? authorObj.name : 'The Rise Editorial Desk',
        affiliation: authorObj ? authorObj.institution : 'Dhaka, Bangladesh',
        date: dateInput ? dateInput.value.trim() : '',
        image: document.getElementById('nr-art-image').value.trim(),
        bodyHtml: bodyHtml,
        bodyText: bodyText,
        sources: document.getElementById('nr-art-sources').value.trim()
      };
      var art;
      if (editId && typeof nr.updatePublishedArticle === 'function') {
        art = nr.updatePublishedArticle(editId, payload);
        if (typeof newsArticles !== 'undefined') {
          var idx = newsArticles.findIndex(function (x) { return x.id === editId; });
          if (idx !== -1) newsArticles[idx] = art;
        }
        document.getElementById('nr-art-pub-msg').textContent = 'Article updated live!';
      } else {
        art = nr.publishArticleDirect(payload);
        if (typeof newsArticles !== 'undefined') newsArticles.unshift(art);
        document.getElementById('nr-art-pub-msg').textContent = 'Published live to articles.html & homepage!';
      }
      sbUpsertArticle(art);
      resetArticleFormMode();
      renderAll();
    });
  }

  var dirSpotForm = document.getElementById('nr-direct-spotlight-form');
  if (dirSpotForm) {
    dirSpotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var isFeatured = document.getElementById('nr-spot-featured').checked;
      var story = nr.publishSpotlightDirect({
        name: document.getElementById('nr-spot-name').value.trim(),
        category: document.getElementById('nr-spot-category').value,
        location: document.getElementById('nr-spot-location').value.trim(),
        achievement: document.getElementById('nr-spot-achievement').value.trim(),
        image: document.getElementById('nr-spot-image').value.trim(),
        bodyText: document.getElementById('nr-spot-body').value.trim(),
        setFeatured: isFeatured
      });
      sbUpsertSpotlight(story, isFeatured);
      if (typeof stories !== 'undefined') stories.unshift(story);
      document.getElementById('nr-spot-pub-msg').textContent = 'Spotlight published & highlighted!';
      dirSpotForm.reset();
      renderAll();
    });
  }

  var authForm = document.getElementById('nr-author-form');
  if (authForm) {
    authForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var au = nr.saveCustomAuthor({
        name: document.getElementById('nr-auth-name').value.trim(),
        role: document.getElementById('nr-auth-role').value.trim(),
        institution: document.getElementById('nr-auth-inst').value.trim(),
        email: document.getElementById('nr-auth-email').value.trim(),
        photo: document.getElementById('nr-auth-photo').value.trim(),
        website: document.getElementById('nr-auth-web').value.trim(),
        bio: document.getElementById('nr-auth-bio').value.trim()
      });
      sbRest('authors?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: {
          id: au.id, name: au.name, role: au.role, institution: au.institution || '',
          photo_url: au.photo || '', bio: au.bio || '', email: au.email || '', links: au.links || []
        }
      });
      if (typeof newsAuthors !== 'undefined') newsAuthors[au.id] = au;
      document.getElementById('nr-auth-msg').textContent = 'Author profile created!';
      authForm.reset();
      renderAll();
    });
  }

  var adCampForm = document.getElementById('nr-ad-campaign-form');
  var adCampCancelBtn = document.getElementById('nr-ac-cancel-edit');
  function resetAdCampFormMode() {
    var editIdEl = document.getElementById('nr-ac-edit-id');
    if (editIdEl) editIdEl.value = '';
    var subBtn = document.getElementById('nr-ac-submit-btn');
    if (subBtn) subBtn.textContent = 'Launch Ad Campaign →';
    if (adCampCancelBtn) adCampCancelBtn.hidden = true;
    if (adCampForm) adCampForm.reset();
  }
  if (adCampCancelBtn) adCampCancelBtn.addEventListener('click', resetAdCampFormMode);

  if (adCampForm) {
    adCampForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var editIdEl = document.getElementById('nr-ac-edit-id');
      var editId = editIdEl ? editIdEl.value.trim() : '';
      var targets = [];
      adCampForm.querySelectorAll('input[name="nr-ac-target"]:checked').forEach(function (cb) { targets.push(cb.value); });
      var fileInput = document.getElementById('nr-ac-file');
      var file = fileInput && fileInput.files && fileInput.files[0];

      function launch(mediaUrl) {
        var campPayload = {
          name: document.getElementById('nr-ac-name').value.trim(),
          advertiser: document.getElementById('nr-ac-advertiser').value.trim(),
          runBy: currentUser ? currentUser.name : 'Newsroom Admin',
          bannerSize: document.getElementById('nr-ac-size').value,
          mediaType: document.getElementById('nr-ac-media-type').value,
          mediaUrl: mediaUrl || document.getElementById('nr-ac-media-url').value.trim(),
          title: document.getElementById('nr-ac-title').value.trim(),
          text: document.getElementById('nr-ac-text').value.trim(),
          cta: document.getElementById('nr-ac-cta').value.trim(),
          href: document.getElementById('nr-ac-href').value.trim(),
          targets: targets,
          startAt: document.getElementById('nr-ac-start').value || '',
          endAt: document.getElementById('nr-ac-end').value || ''
        };
        var sbBody = {
          name: campPayload.name, advertiser: campPayload.advertiser, run_by: campPayload.runBy,
          targets: campPayload.targets, banner_size: campPayload.bannerSize, media_type: campPayload.mediaType,
          media_url: campPayload.mediaUrl, title: campPayload.title, description: campPayload.text,
          cta: campPayload.cta, href: campPayload.href,
          start_at: campPayload.startAt ? new Date(campPayload.startAt).toISOString() : null,
          end_at: campPayload.endAt ? new Date(campPayload.endAt).toISOString() : null
        };
        if (editId && typeof nr.updateAdCampaign === 'function') {
          nr.updateAdCampaign(editId, campPayload);
          sbRest('ad_campaigns?id=eq.' + encodeURIComponent(editId), { method: 'PATCH', body: sbBody });
          document.getElementById('nr-ac-msg').textContent = 'Ad campaign updated!';
        } else {
          nr.createAdCampaign(campPayload);
          sbRest('ad_campaigns', { method: 'POST', body: Object.assign({ status: 'active' }, sbBody) });
          document.getElementById('nr-ac-msg').textContent = 'Ad campaign launched! Live on selected placements.';
        }
        resetAdCampFormMode();
        renderAll();
      }

      if (file) {
        var sb = sbReady();
        if (sb && typeof sb.uploadMedia === 'function') {
          sb.uploadMedia(file).then(function (publicUrl) {
            if (publicUrl) { launch(publicUrl); return; }
            var reader = new FileReader();
            reader.onload = function () { launch(reader.result); };
            reader.readAsDataURL(file);
          }).catch(function () {
            var reader = new FileReader();
            reader.onload = function () { launch(reader.result); };
            reader.readAsDataURL(file);
          });
        } else {
          var reader = new FileReader();
          reader.onload = function () { launch(reader.result); };
          reader.readAsDataURL(file);
        }
      } else {
        launch('');
      }
    });
  }

  var tickerForm = document.getElementById('nr-ticker-form');
  if (tickerForm) {
    tickerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var lines = document.getElementById('nr-ticker-input').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      nr.saveTickerItems(lines);
      sbSaveSetting('tickerItems', lines);
      document.getElementById('nr-ticker-msg').textContent = 'Homepage ticker bar updated!';
    });
  }

  /* Partnerships Page Editor */
  var partnerStatsForm = document.getElementById('nr-partner-stats-form');
  if (partnerStatsForm) {
    var curP = (nr.load().partnershipConfig || {});
    if (Array.isArray(curP.stats)) {
      curP.stats.forEach(function (st, idx) {
        var vEl = document.getElementById('nr-ps-v' + (idx + 1));
        var lEl = document.getElementById('nr-ps-l' + (idx + 1));
        if (vEl && st.val) vEl.value = st.val;
        if (lEl && st.lbl) lEl.value = st.lbl;
      });
    }
    if (curP.subtitle && document.getElementById('nr-ps-title')) {
      document.getElementById('nr-ps-title').value = curP.subtitle;
    }
    partnerStatsForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var stats = [1, 2, 3, 4].map(function (n) {
        return {
          val: document.getElementById('nr-ps-v' + n).value.trim(),
          lbl: document.getElementById('nr-ps-l' + n).value.trim()
        };
      }).filter(function (x) { return x.val; });
      nr.savePartnershipConfig({
        subtitle: document.getElementById('nr-ps-title').value.trim(),
        stats: stats
      });
      sbSaveSetting('partnershipConfig', nr.load().partnershipConfig);
      document.getElementById('nr-ps-msg').textContent = 'Partnership stats updated on advertise.html!';
    });
  }

  function renderCollabsList() {
    var box = document.getElementById('nr-collabs-list');
    if (!box) return;
    var list = (nr.load().partnershipConfig || {}).collabs || [];
    box.innerHTML = list.map(function (c, i) {
      return '<div class="nr-clean-row"><div><strong>' + esc(c.tab || c.title) + '</strong> · <small>' + esc(c.tag) + '</small></div>' +
        '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-col="' + i + '">Delete</button></div>';
    }).join('');
    box.querySelectorAll('[data-del-col]').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = Number(b.getAttribute('data-del-col'));
        var cfg = nr.load().partnershipConfig || {};
        var arr = Array.isArray(cfg.collabs) ? cfg.collabs : [];
        var removed = arr[idx];
        confirmDelete(removed ? (removed.tab || removed.title) : 'this collaboration slide', function () {
          if (removed) moveToRecycleBin('collab', removed.tab || removed.title, removed.tag || '', Object.assign({}, removed));
          arr.splice(idx, 1);
          nr.savePartnershipConfig({ collabs: arr });
          sbSaveSetting('partnershipConfig', nr.load().partnershipConfig);
          renderCollabsList();
          renderAll();
        });
      });
    });
  }
  renderCollabsList();

  var collabForm = document.getElementById('nr-collab-form');
  if (collabForm) {
    collabForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var cfg = nr.load().partnershipConfig || {};
      var arr = Array.isArray(cfg.collabs) ? cfg.collabs.slice() : [];
      var splitM = function (raw, defL) {
        var parts = String(raw || '').trim().split(/\s+/);
        return { m: parts[0] || '—', l: parts.slice(1).join(' ') || defL };
      };
      var m1 = splitM(document.getElementById('nr-col-m1').value, 'REACH');
      var m2 = splitM(document.getElementById('nr-col-m2').value, 'IMPRESSIONS');
      var m3 = splitM(document.getElementById('nr-col-m3').value, 'PLACEMENTS');
      arr.unshift({
        tab: document.getElementById('nr-col-tab').value.trim(),
        tag: document.getElementById('nr-col-tag').value.trim(),
        kicker: document.getElementById('nr-col-tag').value.trim(),
        banner: document.getElementById('nr-col-banner').value.trim(),
        sub: 'Multi-platform editorial & brand campaign on The Rise.',
        title: document.getElementById('nr-col-title').value.trim(),
        desc: document.getElementById('nr-col-desc').value.trim(),
        m1: m1.m, l1: m1.l, m2: m2.m, l2: m2.l, m3: m3.m, l3: m3.l
      });
      nr.savePartnershipConfig({ collabs: arr });
      sbSaveSetting('partnershipConfig', nr.load().partnershipConfig);
      document.getElementById('nr-col-msg').textContent = 'Collaboration slide added to advertise.html!';
      collabForm.reset();
      renderCollabsList();
    });
  }

  var popForm = document.getElementById('nr-popup-form');
  if (popForm) {
    popForm.addEventListener('submit', function (e) {
      e.preventDefault();
      nr.savePopup({
        title: document.getElementById('nr-pop-title').value.trim(),
        message: document.getElementById('nr-pop-msg').value.trim(),
        imageUrl: document.getElementById('nr-pop-img').value.trim(),
        ctaText: document.getElementById('nr-pop-cta').value.trim(),
        ctaHref: document.getElementById('nr-pop-href').value.trim(),
        startAt: document.getElementById('nr-pop-start').value || '',
        endAt: document.getElementById('nr-pop-end').value || '',
        active: document.getElementById('nr-pop-active').checked
      });
      sbSaveSetting('popup', nr.load().popup);
      document.getElementById('nr-pop-status').textContent = 'Popup scheduled & active on public pages!';
    });
  }
  var popClearBtn = document.getElementById('nr-pop-clear-btn');
  if (popClearBtn) {
    popClearBtn.addEventListener('click', function () {
      nr.clearPopup();
      sbSaveSetting('popup', null);
      document.getElementById('nr-pop-status').textContent = 'Popup disabled.';
    });
  }

  var campForm = document.getElementById('nr-campaign-form');
  if (campForm) {
    campForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var state = nr.load();
      var topicFilter = document.getElementById('nr-camp-topic') ? document.getElementById('nr-camp-topic').value : 'ALL';
      var subject = document.getElementById('nr-camp-subject').value.trim();
      var headline = document.getElementById('nr-camp-headline').value.trim();
      var body = document.getElementById('nr-camp-body').value.trim();
      var targets = state.subscribers.filter(function (s) {
        if (topicFilter === 'ALL') return true;
        return Array.isArray(s.topics) ? s.topics.indexOf(topicFilter) !== -1 : topicFilter === 'Latest Stories';
      });
      nr.saveCampaign({ subject: '[' + topicFilter + '] ' + subject, headline: headline, body: body });
      var msgEl = document.getElementById('nr-camp-msg');
      var emails = targets.map(function (s) { return s.email; });
      if (!emails.length) {
        if (msgEl) msgEl.textContent = 'Campaign logged (no matching subscribers yet).';
        campForm.reset();
        renderAll();
        return;
      }
      if (msgEl) msgEl.textContent = 'Sending to ' + emails.length + ' subscriber(s) via Resend…';
      (sbReady() && typeof sbReady().getAccessToken === 'function' ? sbReady().getAccessToken() : Promise.resolve(null)).then(function (tok) {
        return fetch('/api/send-email', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
          body: JSON.stringify({
            action: 'broadcast',
            recipients: emails,
            subject: subject,
            headline: headline,
            body: body
          })
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      }).then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          if (msgEl) msgEl.textContent = 'Sent to ' + res.data.sent + ' subscriber(s) via Resend!';
          campForm.reset();
          renderAll();
        } else {
          var errMsg = (res.data && res.data.error) || 'Resend API unavailable';
          if (msgEl) msgEl.textContent = 'Logged locally. Resend pending: ' + errMsg;
        }
      }).catch(function () {
        if (msgEl) msgEl.textContent = 'Logged locally. Deploy on Vercel with RESEND_API_KEY to send via Resend.';
      });
    });
  }

  var secForm = document.getElementById('nr-section-form');
  if (secForm) {
    secForm.addEventListener('submit', function (e) {
      e.preventDefault();
      nr.addCustomSection({
        eyebrow: document.getElementById('nr-sec-eyebrow').value.trim(),
        title: document.getElementById('nr-sec-title').value.trim(),
        body: document.getElementById('nr-sec-body').value.trim(),
        ctaText: document.getElementById('nr-sec-cta').value.trim(),
        ctaHref: document.getElementById('nr-sec-href').value.trim(),
        theme: document.getElementById('nr-sec-theme').value
      });
      sbSaveSetting('customSections', nr.load().customSections || []);
      document.getElementById('nr-sec-msg').textContent = 'Section added to homepage!';
      secForm.reset();
      renderAll();
    });
  }

  var teamForm = document.getElementById('nr-team-form');
  if (teamForm) {
    teamForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var tm = {
        name: document.getElementById('nr-tm-name').value.trim(),
        email: document.getElementById('nr-tm-email').value.trim(),
        password: document.getElementById('nr-tm-pass').value.trim(),
        role: document.getElementById('nr-tm-role').value
      };
      nr.saveTeamMember(tm);
      sbRest('team_roles?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: { name: tm.name, email: tm.email, role: tm.role }
      });
      document.getElementById('nr-tm-msg').textContent = 'Team member saved! Also invite/add them in Supabase Auth -> Users so they can sign in.';
      teamForm.reset();
      renderAll();
    });
  }

  var exportBtn = document.getElementById('nr-export-subs');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      var subs = nr.load().subscribers;
      var csv = 'Email,Source,SubscribedAt\n' + subs.map(function (s) { return '"' + s.email + '","' + s.source + '","' + s.subscribedAt + '"'; }).join('\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'therisebd-subscribers.csv';
      a.click();
    });
  }

  var passForm = document.getElementById('nr-passcode-form');
  if (passForm) {
    passForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = document.getElementById('nr-new-passcode').value.trim();
      if (val.length < 4) return;
      var st = nr.load();
      st.passcode = val;
      nr.save(st);
      document.getElementById('nr-passcode-msg').textContent = 'Quick passcode updated!';
      passForm.reset();
    });
  }

  var socialForm = document.getElementById('nr-social-form');
  if (socialForm) {
    var curLinks = nr.load().socialLinks || {};
    var setSoc = function (id, val) { var el = document.getElementById(id); if (el && val) el.value = val; };
    setSoc('nr-soc-facebook', curLinks.facebook);
    setSoc('nr-soc-linkedin', curLinks.linkedin);
    setSoc('nr-soc-instagram', curLinks.instagram);
    setSoc('nr-soc-youtube', curLinks.youtube);
    setSoc('nr-soc-x', curLinks.x);

    socialForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var socPayload = {
        facebook: document.getElementById('nr-soc-facebook').value.trim(),
        linkedin: document.getElementById('nr-soc-linkedin').value.trim(),
        instagram: document.getElementById('nr-soc-instagram').value.trim(),
        youtube: document.getElementById('nr-soc-youtube').value.trim(),
        x: document.getElementById('nr-soc-x').value.trim()
      };
      nr.saveSocialLinks(socPayload);
      sbSaveSetting('socialLinks', socPayload);
      document.getElementById('nr-soc-msg').textContent = 'Social links updated across the entire website!';
    });
  }

  var resetBtn = document.getElementById('nr-reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (confirm('Reset all local Newsroom data?')) {
        localStorage.removeItem('rise_newsroom_v1');
        renderAll();
      }
    });
  }

  var seedBtn = document.getElementById('nr-seed-demo-btn');
  if (seedBtn) {
    seedBtn.addEventListener('click', function () {
      nr.submitArticle({
        author: 'Tasnim Tabassum', email: 'tasnim@example.com', whatsapp: '+8801700000000',
        affiliation: 'CSE, BUET · Dhaka', topic: 'AI & Tech', city: 'Dhaka',
        headline: 'How Bangla Voice AI Is Improving Rural Telemedicine Access',
        summary: 'A field pilot tests speech-enabled triage tools for community health workers.',
        bodyText: 'Community clinics across rural Bangladesh face a shortage of specialist doctors.\n\nBangla speech-enabled triage helps health workers record symptoms accurately.',
        sources: 'https://therisebd.com'
      });
      nr.submitNomination({
        name: 'Rafiqul Islam', email: 'rafiq@example.com', whatsapp: '+8801800000000',
        address: 'Rajshahi, Bangladesh', category: 'Innovation',
        achievement: 'National Clean-Tech Prototype Winner 2026',
        headline: 'Low-Cost Solar Cold Storage for Mango Farmers',
        bodyText: 'Built an off-grid solar cooling unit cutting mango spoilage by 40%.',
        proofLink: 'https://therisebd.com'
      });
      nr.submitAd({ name: 'Sadia Rahman', company: 'NextGen EdTech BD', slot: '728×90 Leaderboard', message: 'Sponsoring December STEM issue.' });
      nr.addSubscriber('reader.demo@therisebd.com', 'index.html');
      renderAll();
    });
  }

  /* Recruitment: Job Circulars, Ambassador/Volunteer Calls & Interview Email Modal */
  var jobForm = document.getElementById('nr-job-form');
  var jobCancelBtn = document.getElementById('nr-job-cancel-edit');
  function resetJobFormMode() {
    document.getElementById('nr-job-edit-id').value = '';
    document.getElementById('nr-job-submit-btn').textContent = 'Publish Job Circular →';
    if (jobCancelBtn) jobCancelBtn.hidden = true;
    if (jobForm) jobForm.reset();
  }
  if (jobCancelBtn) jobCancelBtn.addEventListener('click', resetJobFormMode);
  if (jobForm) {
    jobForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = nr.load();
      if (!Array.isArray(st.jobCirculars)) st.jobCirculars = [];
      var editId = document.getElementById('nr-job-edit-id').value.trim();
      var item = {
        id: editId || ('job-' + Date.now()),
        title: document.getElementById('nr-job-title').value.trim(),
        type: document.getElementById('nr-job-type').value,
        location: document.getElementById('nr-job-location').value.trim() || 'Dhaka / Remote',
        deadline: document.getElementById('nr-job-deadline').value.trim(),
        description: document.getElementById('nr-job-desc').value.trim()
      };
      if (editId) {
        var idx = st.jobCirculars.findIndex(function (x) { return x.id === editId; });
        if (idx !== -1) st.jobCirculars[idx] = item; else st.jobCirculars.unshift(item);
      } else {
        st.jobCirculars.unshift(item);
      }
      nr.save(st);
      sbSaveSetting('jobCirculars', st.jobCirculars);
      document.getElementById('nr-job-msg').textContent = editId ? 'Job circular updated!' : 'Job circular published to careers.html!';
      resetJobFormMode();
      renderAll();
    });
  }

  var ambForm = document.getElementById('nr-amb-form');
  var ambCancelBtn = document.getElementById('nr-amb-cancel-edit');
  function resetAmbFormMode() {
    document.getElementById('nr-amb-edit-id').value = '';
    document.getElementById('nr-amb-submit-btn').textContent = 'Publish Track Call →';
    if (ambCancelBtn) ambCancelBtn.hidden = true;
    if (ambForm) ambForm.reset();
  }
  if (ambCancelBtn) ambCancelBtn.addEventListener('click', resetAmbFormMode);
  if (ambForm) {
    ambForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = nr.load();
      if (!Array.isArray(st.ambassadorCirculars)) st.ambassadorCirculars = [];
      var editId = document.getElementById('nr-amb-edit-id').value.trim();
      var item = {
        id: editId || ('amb-' + Date.now()),
        title: document.getElementById('nr-amb-title').value.trim(),
        campus: document.getElementById('nr-amb-campus').value.trim() || 'All Universities',
        perks: document.getElementById('nr-amb-perks').value.trim(),
        description: document.getElementById('nr-amb-desc').value.trim()
      };
      if (editId) {
        var idx = st.ambassadorCirculars.findIndex(function (x) { return x.id === editId; });
        if (idx !== -1) st.ambassadorCirculars[idx] = item; else st.ambassadorCirculars.unshift(item);
      } else {
        st.ambassadorCirculars.unshift(item);
      }
      nr.save(st);
      sbSaveSetting('ambassadorCirculars', st.ambassadorCirculars);
      document.getElementById('nr-amb-msg').textContent = editId ? 'Track call updated!' : 'Track call published to ambassador.html!';
      resetAmbFormMode();
      renderAll();
    });
  }

  var ivModal = document.getElementById('nr-interview-modal');
  var ivForm = document.getElementById('nr-iv-form');
  var ivCancel = document.getElementById('nr-iv-cancel');
  if (ivCancel && ivModal) ivCancel.addEventListener('click', function () { ivModal.hidden = true; });
  if (ivModal) ivModal.addEventListener('click', function (ev) { if (ev.target === ivModal) ivModal.hidden = true; });
  if (ivForm) {
    ivForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var appId = document.getElementById('nr-iv-app-id').value;
      var to = document.getElementById('nr-iv-email').value.trim();
      var name = document.getElementById('nr-iv-name').value.trim();
      var role = document.getElementById('nr-iv-role').value.trim();
      var date = document.getElementById('nr-iv-date').value;
      var time = document.getElementById('nr-iv-time').value;
      var location = document.getElementById('nr-iv-location').value.trim();
      var note = document.getElementById('nr-iv-note').value.trim();
      var msgEl = document.getElementById('nr-iv-msg');
      msgEl.textContent = 'Sending interview email via Resend…';

      (sbReady() && typeof sbReady().getAccessToken === 'function' ? sbReady().getAccessToken() : Promise.resolve(null)).then(function (tok) {
        return fetch('/api/send-email', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { 'Authorization': 'Bearer ' + tok } : {}),
          body: JSON.stringify({ action: 'interview_invite', to: to, name: name, role: role, date: date, time: time, location: location, note: note })
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
      }).then(function (res) {
        if (res.ok && res.data && res.data.ok) {
          nr.updateAdStatus(appId, 'contacted');
          sbRest('ad_inquiries?id=eq.' + encodeURIComponent(appId), { method: 'PATCH', body: { status: 'contacted' } });
          msgEl.textContent = 'Interview invitation sent to ' + to + '!';
          renderAll();
          setTimeout(function () { if (ivModal) ivModal.hidden = true; }, 1200);
        } else {
          msgEl.textContent = (res.data && res.data.error) || 'Could not send via Resend yet (check RESEND_API_KEY in Vercel).';
        }
      }).catch(function () {
        msgEl.textContent = 'Email API unavailable locally; deploy on Vercel with RESEND_API_KEY.';
      });
    });
  }

  try {
    if ('BroadcastChannel' in window) {
      var bc = new BroadcastChannel('rise_newsroom_sync');
      bc.addEventListener('message', function () { renderAll(); });
    }
  } catch (e) {}

  window.addEventListener('storage', function (e) {
    if (e.key === 'rise_newsroom_v1') renderAll();
  });
})();
