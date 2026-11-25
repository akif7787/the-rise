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
    Admin: ['insights', 'articles', 'spotlights', 'authors', 'ads', 'newsletter', 'sections', 'team', 'settings'],
    Editor: ['insights', 'articles', 'spotlights', 'authors'],
    Moderator: ['insights', 'articles', 'spotlights', 'newsletter']
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

  try {
    var savedUser = sessionStorage.getItem(SESSION_USER_KEY);
    if (savedUser) {
      unlock(JSON.parse(savedUser));
    }
  } catch (e) {}

  if (lockForm) {
    lockForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = nr.authenticateUser(emailInput ? emailInput.value : '', passInput ? passInput.value : '');
      if (user) {
        if (lockError) lockError.textContent = '';
        unlock(user);
      } else {
        if (lockError) lockError.textContent = 'Invalid email or password. Default Admin: admin@therisebd.com / rise2026';
      }
    });
  }

  var logoutBtn = document.getElementById('nr-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', lock);

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
    set('nr-pill-articles', state.articlesQueue.filter(function (a) { return a.status === 'pending'; }).length);
    set('nr-pill-nominations', state.nominationsQueue.filter(function (n) { return n.status === 'pending'; }).length);
    set('nr-pill-ads', state.adsQueue.filter(function (a) { return a.status === 'new'; }).length);
    set('nr-pill-subs', state.subscribers.length);
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
        lineBox.innerHTML = '<p class="nr-empty">No daily telemetry yet. Click "+ Sample Activity" or browse pages to see the live trend line.</p>';
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
        qBox.querySelectorAll('[data-accept-art]').forEach(function (b) { b.addEventListener('click', function () { nr.acceptArticle(b.getAttribute('data-accept-art')); renderAll(); }); });
        qBox.querySelectorAll('[data-reject-art]').forEach(function (b) { b.addEventListener('click', function () { nr.rejectArticle(b.getAttribute('data-reject-art')); renderAll(); }); });
      }
    }

    /* Published Articles Manage & Delete */
    var pubBox = document.getElementById('nr-published-articles-list');
    if (pubBox && typeof newsArticles !== 'undefined') {
      var list = newsArticles.slice();
      pubBox.innerHTML = list.length ? list.map(function (art) {
        var delBtn = currentUser && currentUser.role !== 'Moderator'
          ? '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-pub-art="' + esc(art.id) + '">Delete</button>'
          : '';
        return '<div class="nr-clean-row"><div><a href="article.html?id=' + encodeURIComponent(art.id) + '" target="_blank"><strong>' + esc(art.headline) + '</strong></a><br><small>' + esc(art.author) + ' · ' + esc(art.topic) + ' · ' + esc(art.date) + '</small></div><div class="nr-row-actions">' + delBtn + '</div></div>';
      }).join('') : '<p class="nr-empty">No published articles.</p>';

      pubBox.querySelectorAll('[data-del-pub-art]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-pub-art');
          nr.deletePublishedArticle(id);
          var idx = newsArticles.findIndex(function (x) { return x.id === id; });
          if (idx !== -1) newsArticles.splice(idx, 1);
          renderAll();
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
        qBox.querySelectorAll('[data-accept-nom]').forEach(function (b) { b.addEventListener('click', function () { nr.acceptNomination(b.getAttribute('data-accept-nom')); renderAll(); }); });
        qBox.querySelectorAll('[data-reject-nom]').forEach(function (b) { b.addEventListener('click', function () { nr.rejectNomination(b.getAttribute('data-reject-nom')); renderAll(); }); });
      }
    }

    var pubBox = document.getElementById('nr-published-stories-list');
    if (pubBox && typeof stories !== 'undefined') {
      pubBox.innerHTML = stories.map(function (s) {
        var isFeat = state.featuredSpotlightId === s.id;
        var featBtn = isFeat
          ? '<span class="nr-trend up">★ Featured</span>'
          : '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-feat-story="' + esc(s.id) + '">Highlight on Home</button>';
        var delBtn = currentUser && currentUser.role !== 'Moderator'
          ? '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-story="' + esc(s.id) + '">Delete</button>'
          : '';
        return '<div class="nr-clean-row"><div><a href="story.html?id=' + encodeURIComponent(s.id) + '" target="_blank"><strong>' + esc(s.name) + '</strong></a><br><small>' + esc(s.achievement) + '</small></div><div class="nr-row-actions">' + featBtn + delBtn + '</div></div>';
      }).join('');
      pubBox.querySelectorAll('[data-feat-story]').forEach(function (b) {
        b.addEventListener('click', function () { nr.setFeaturedSpotlight(b.getAttribute('data-feat-story')); renderAll(); });
      });
      pubBox.querySelectorAll('[data-del-story]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-del-story');
          nr.deletePublishedStory(id);
          var idx = stories.findIndex(function (x) { return x.id === id; });
          if (idx !== -1) stories.splice(idx, 1);
          renderAll();
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
        nr.deleteAuthor(id);
        delete newsAuthors[id];
        renderAll();
      });
    });
  }

  function renderAdsTab(state) {
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
          '<button type="button" class="nr-btn nr-btn-ghost nr-sm" data-toggle-camp="' + esc(c.id) + '">' + (c.status === 'active' ? 'Pause' : 'Resume') + '</button>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-camp="' + esc(c.id) + '">Delete</button>' +
          '</div></div>';
      }).join('') : '<p class="nr-empty">No active ad campaigns yet. Launch your first targeted ad above.</p>';

      campBox.querySelectorAll('[data-toggle-camp]').forEach(function (b) {
        b.addEventListener('click', function () { nr.toggleAdCampaign(b.getAttribute('data-toggle-camp')); renderAll(); });
      });
      campBox.querySelectorAll('[data-del-camp]').forEach(function (b) {
        b.addEventListener('click', function () { nr.deleteAdCampaign(b.getAttribute('data-del-camp')); renderAll(); });
      });
    }

    var box = document.getElementById('nr-ads-list');
    if (!box) return;
    box.innerHTML = state.adsQueue.length ? state.adsQueue.map(function (item) {
      return '<div class="nr-q-card"><div><strong>' + esc(item.company || item.name) + '</strong> <span class="nr-pill-soft">' + esc(item.slot) + '</span><p class="nr-sub-caption">' + esc(item.message) + '</p></div>' +
        '<select data-ad-status="' + esc(item.id) + '">' +
        ['new', 'contacted', 'active'].map(function (st) { return '<option value="' + st + '"' + (item.status === st ? ' selected' : '') + '>' + st.toUpperCase() + '</option>'; }).join('') +
        '</select></div>';
    }).join('') : '<p class="nr-empty">No advertiser enquiries yet.</p>';
    box.querySelectorAll('[data-ad-status]').forEach(function (s) {
      s.addEventListener('change', function () { nr.updateAdStatus(s.getAttribute('data-ad-status'), s.value); renderPills(nr.load()); });
    });
  }

  function renderNewsletterTab(state) {
    var subBox = document.getElementById('nr-subs-list');
    if (subBox) {
      subBox.innerHTML = state.subscribers.length ? state.subscribers.map(function (s) {
        return '<div class="nr-clean-row"><div><strong>' + esc(s.email) + '</strong><br><small>Subscribed via ' + esc(friendlyPageName(s.source)) + ' · ' + esc(fmtDate(s.subscribedAt)) + '</small></div>' +
          '<button type="button" class="nr-btn nr-btn-danger nr-sm" data-del-sub="' + esc(s.id) + '">Remove</button></div>';
      }).join('') : '<p class="nr-empty">No subscribers yet.</p>';
      subBox.querySelectorAll('[data-del-sub]').forEach(function (b) {
        b.addEventListener('click', function () { nr.deleteSubscriber(b.getAttribute('data-del-sub')); renderAll(); });
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
      b.addEventListener('click', function () { nr.deleteCustomSection(b.getAttribute('data-del-sec')); renderAll(); });
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
      b.addEventListener('click', function () { nr.deleteTeamMember(b.getAttribute('data-del-tm')); renderAll(); });
    });
  }

  function renderAll() {
    var state = nr.load();
    renderPills(state);
    renderInsights(state);
    renderArticlesTab(state);
    renderSpotlightsTab(state);
    renderAuthorsTab();
    renderAdsTab(state);
    renderNewsletterTab(state);
    renderSectionsTab(state);
    renderTeamTab(state);
  }

  /* Form Handlers */
  var dirArtForm = document.getElementById('nr-direct-article-form');
  if (dirArtForm) {
    dirArtForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var authorId = document.getElementById('nr-art-author-select').value;
      var authorObj = (typeof newsAuthors !== 'undefined' && authorId) ? newsAuthors[authorId] : null;
      var art = nr.publishArticleDirect({
        headline: document.getElementById('nr-art-headline').value.trim(),
        dek: document.getElementById('nr-art-dek').value.trim(),
        topic: document.getElementById('nr-art-topic').value,
        authorId: authorId,
        author: authorObj ? authorObj.name : 'The Rise Editorial Desk',
        affiliation: authorObj ? authorObj.institution : 'Dhaka, Bangladesh',
        image: document.getElementById('nr-art-image').value.trim(),
        bodyText: document.getElementById('nr-art-body').value.trim(),
        sources: document.getElementById('nr-art-sources').value.trim()
      });
      if (typeof newsArticles !== 'undefined') newsArticles.unshift(art);
      document.getElementById('nr-art-pub-msg').textContent = 'Published live to articles.html & homepage!';
      dirArtForm.reset();
      renderAll();
    });
  }

  var dirSpotForm = document.getElementById('nr-direct-spotlight-form');
  if (dirSpotForm) {
    dirSpotForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var story = nr.publishSpotlightDirect({
        name: document.getElementById('nr-spot-name').value.trim(),
        category: document.getElementById('nr-spot-category').value,
        location: document.getElementById('nr-spot-location').value.trim(),
        achievement: document.getElementById('nr-spot-achievement').value.trim(),
        image: document.getElementById('nr-spot-image').value.trim(),
        bodyText: document.getElementById('nr-spot-body').value.trim(),
        setFeatured: document.getElementById('nr-spot-featured').checked
      });
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
      if (typeof newsAuthors !== 'undefined') newsAuthors[au.id] = au;
      document.getElementById('nr-auth-msg').textContent = 'Author profile created!';
      authForm.reset();
      renderAll();
    });
  }

  var adCampForm = document.getElementById('nr-ad-campaign-form');
  if (adCampForm) {
    adCampForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var targets = [];
      adCampForm.querySelectorAll('input[name="nr-ac-target"]:checked').forEach(function (cb) { targets.push(cb.value); });
      var fileInput = document.getElementById('nr-ac-file');
      var file = fileInput && fileInput.files && fileInput.files[0];

      function launch(mediaUrl) {
        nr.createAdCampaign({
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
        });
        document.getElementById('nr-ac-msg').textContent = 'Ad campaign launched! Live on selected placements.';
        adCampForm.reset();
        renderAll();
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function () { launch(reader.result); };
        reader.readAsDataURL(file);
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
        var cfg = nr.load().partnershipConfig || {};
        var arr = Array.isArray(cfg.collabs) ? cfg.collabs : [];
        arr.splice(Number(b.getAttribute('data-del-col')), 1);
        nr.savePartnershipConfig({ collabs: arr });
        renderCollabsList();
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
      document.getElementById('nr-pop-status').textContent = 'Popup scheduled & active on public pages!';
    });
  }
  var popClearBtn = document.getElementById('nr-pop-clear-btn');
  if (popClearBtn) {
    popClearBtn.addEventListener('click', function () {
      nr.clearPopup();
      document.getElementById('nr-pop-status').textContent = 'Popup disabled.';
    });
  }

  var campForm = document.getElementById('nr-campaign-form');
  if (campForm) {
    campForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var state = nr.load();
      var subject = document.getElementById('nr-camp-subject').value.trim();
      var headline = document.getElementById('nr-camp-headline').value.trim();
      var body = document.getElementById('nr-camp-body').value.trim();
      nr.saveCampaign({ subject: subject, headline: headline, body: body });
      var bcc = state.subscribers.map(function (s) { return s.email; }).join(',');
      if (bcc) {
        window.location.href = 'mailto:hello@therisebd.com?bcc=' + encodeURIComponent(bcc) + '&subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(headline + '\n\n' + body);
      }
      document.getElementById('nr-camp-msg').textContent = 'Campaign logged' + (bcc ? ' & opening email client with ' + state.subscribers.length + ' subscribers.' : ' (add subscribers first to mailto).');
      campForm.reset();
      renderAll();
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
      document.getElementById('nr-sec-msg').textContent = 'Section added to homepage!';
      secForm.reset();
      renderAll();
    });
  }

  var teamForm = document.getElementById('nr-team-form');
  if (teamForm) {
    teamForm.addEventListener('submit', function (e) {
      e.preventDefault();
      nr.saveTeamMember({
        name: document.getElementById('nr-tm-name').value.trim(),
        email: document.getElementById('nr-tm-email').value.trim(),
        password: document.getElementById('nr-tm-pass').value.trim(),
        role: document.getElementById('nr-tm-role').value
      });
      document.getElementById('nr-tm-msg').textContent = 'Team member saved! They can now sign in with their email & password.';
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
      nr.saveSocialLinks({
        facebook: document.getElementById('nr-soc-facebook').value.trim(),
        linkedin: document.getElementById('nr-soc-linkedin').value.trim(),
        instagram: document.getElementById('nr-soc-instagram').value.trim(),
        youtube: document.getElementById('nr-soc-youtube').value.trim(),
        x: document.getElementById('nr-soc-x').value.trim()
      });
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
