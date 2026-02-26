(function() {
    var searchBox = document.getElementById('archive-search-box');
    var searchInput = document.getElementById('archive-search-input');
    var searchBtn = document.getElementById('archive-search-btn');
    var modal = document.getElementById('archive-search-modal');
    var modalInput = document.getElementById('archive-modal-search-input');
    var modalSearchBtn = document.getElementById('archive-modal-search-btn');
    var modalCloseBtn = document.getElementById('archive-modal-close-btn');
    var searchStatus = document.getElementById('archive-search-status');
    var searchResults = document.getElementById('archive-search-results');

    if (!searchBox || !modal) return;

    // Hide search on file:// protocol (doesn't work due to CORS restrictions)
    if (window.location.protocol === 'file:') return;

    // Show search box (progressive enhancement)
    searchBox.style.display = 'flex';

    // Current project filter (set by template if on project page)
    var currentProject = window.currentArchiveProject || null;

    // Search index cache
    var searchIndex = null;
    var indexLoading = false;
    var indexLoadPromise = null;

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function openModal(query) {
        modalInput.value = query || '';
        searchResults.innerHTML = '';
        searchStatus.textContent = '';
        modal.showModal();
        modalInput.focus();
        if (query) {
            performSearch(query);
        }
    }

    function closeModal() {
        modal.close();
        // Update URL to remove search fragment
        if (window.location.hash.startsWith('#search=')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    function updateUrlHash(query) {
        if (query) {
            history.replaceState(null, '', window.location.pathname + window.location.search + '#search=' + encodeURIComponent(query));
        }
    }

    function highlightText(text, searchTerm) {
        if (!text || !searchTerm) return escapeHtml(text);
        var regex = new RegExp('(' + escapeRegex(searchTerm) + ')', 'gi');
        var escaped = escapeHtml(text);
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    async function loadSearchIndex() {
        if (searchIndex) return searchIndex;
        if (indexLoadPromise) return indexLoadPromise;

        indexLoadPromise = (async function() {
            indexLoading = true;
            try {
                // Determine index path based on current location
                var indexPath = currentProject ? '../search-index.json' : 'search-index.json';
                var response = await fetch(indexPath);
                if (!response.ok) throw new Error('Failed to load search index');
                searchIndex = await response.json();
                return searchIndex;
            } catch (e) {
                console.error('Failed to load search index:', e);
                throw e;
            } finally {
                indexLoading = false;
            }
        })();

        return indexLoadPromise;
    }

    function scoreMatch(session, query, queryLower) {
        var score = 0;
        var content = session.content || {};

        // Check summary (highest weight)
        if (session.summary && session.summary.toLowerCase().indexOf(queryLower) !== -1) {
            score += 100;
        }

        // Check prompts (high weight)
        var prompts = content.prompts || [];
        for (var i = 0; i < prompts.length; i++) {
            if (prompts[i].toLowerCase().indexOf(queryLower) !== -1) {
                score += 50;
                break;
            }
        }

        // Check responses
        var responses = content.responses || [];
        for (var i = 0; i < responses.length; i++) {
            if (responses[i].toLowerCase().indexOf(queryLower) !== -1) {
                score += 30;
                break;
            }
        }

        // Check tools (medium weight)
        var tools = content.tools || [];
        for (var i = 0; i < tools.length; i++) {
            if (tools[i].toLowerCase().indexOf(queryLower) !== -1) {
                score += 20;
                break;
            }
        }

        // Check files (medium weight)
        var files = content.files || [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].toLowerCase().indexOf(queryLower) !== -1) {
                score += 25;
                break;
            }
        }

        return score;
    }

    function getMatchContext(session, query) {
        var queryLower = query.toLowerCase();
        var content = session.content || {};
        var context = [];

        // Check summary first
        if (session.summary && session.summary.toLowerCase().indexOf(queryLower) !== -1) {
            context.push({ type: 'summary', text: session.summary });
        }

        // Check prompts
        var prompts = content.prompts || [];
        for (var i = 0; i < prompts.length && context.length < 2; i++) {
            if (prompts[i].toLowerCase().indexOf(queryLower) !== -1) {
                context.push({ type: 'prompt', text: prompts[i] });
            }
        }

        // Check responses
        var responses = content.responses || [];
        for (var i = 0; i < responses.length && context.length < 2; i++) {
            if (responses[i].toLowerCase().indexOf(queryLower) !== -1) {
                context.push({ type: 'response', text: responses[i] });
            }
        }

        // Check files
        var files = content.files || [];
        var matchingFiles = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].toLowerCase().indexOf(queryLower) !== -1) {
                matchingFiles.push(files[i]);
            }
        }
        if (matchingFiles.length > 0 && context.length < 2) {
            context.push({ type: 'files', text: matchingFiles.join(', ') });
        }

        // Check tools
        var tools = content.tools || [];
        var matchingTools = [];
        for (var i = 0; i < tools.length; i++) {
            if (tools[i].toLowerCase().indexOf(queryLower) !== -1) {
                matchingTools.push(tools[i]);
            }
        }
        if (matchingTools.length > 0 && context.length < 2) {
            context.push({ type: 'tools', text: matchingTools.join(', ') });
        }

        // If no match found in specific fields, show summary as fallback
        if (context.length === 0 && session.summary) {
            context.push({ type: 'summary', text: session.summary });
        }

        return context;
    }

    function renderResult(project, session, query, basePath) {
        var contexts = getMatchContext(session, query);
        var contextHtml = '';

        for (var i = 0; i < contexts.length; i++) {
            var ctx = contexts[i];
            var label = ctx.type.charAt(0).toUpperCase() + ctx.type.slice(1);
            var truncatedText = ctx.text.length > 150 ? ctx.text.substring(0, 150) + '...' : ctx.text;
            contextHtml += '<div class="search-result-context">' +
                '<span class="search-result-label">' + escapeHtml(label) + ':</span> ' +
                highlightText(truncatedText, query) +
                '</div>';
        }

        var sessionPath = basePath + session.path;

        var resultDiv = document.createElement('div');
        resultDiv.className = 'archive-search-result';
        resultDiv.innerHTML = '<a href="' + escapeHtml(sessionPath) + '">' +
            '<div class="search-result-header">' +
            '<span class="search-result-project">' + escapeHtml(project.name) + '</span>' +
            '<span class="search-result-date">' + escapeHtml(session.date) + '</span>' +
            '</div>' +
            '<div class="search-result-content">' + contextHtml + '</div>' +
            '</a>';

        return resultDiv;
    }

    async function performSearch(query) {
        if (!query.trim()) {
            searchStatus.textContent = 'Enter a search term';
            return;
        }

        updateUrlHash(query);
        searchResults.innerHTML = '';
        searchStatus.textContent = 'Loading search index...';

        var index;
        try {
            index = await loadSearchIndex();
        } catch (e) {
            searchStatus.textContent = 'Failed to load search index. Try again later.';
            return;
        }

        searchStatus.textContent = 'Searching...';

        var queryLower = query.toLowerCase().trim();
        var results = [];

        // Determine base path for links
        var basePath = currentProject ? '../' : '';

        // Search through all projects (or just current project if filtered)
        var projectsToSearch = index.projects || [];
        if (currentProject) {
            projectsToSearch = projectsToSearch.filter(function(p) {
                return p.name === currentProject;
            });
        }

        for (var i = 0; i < projectsToSearch.length; i++) {
            var project = projectsToSearch[i];
            var sessions = project.sessions || [];

            for (var j = 0; j < sessions.length; j++) {
                var session = sessions[j];
                var score = scoreMatch(session, query, queryLower);

                if (score > 0) {
                    results.push({
                        project: project,
                        session: session,
                        score: score
                    });
                }
            }
        }

        // Sort by score (descending)
        results.sort(function(a, b) {
            return b.score - a.score;
        });

        // Display results (limit to 50)
        var maxResults = 50;
        var displayResults = results.slice(0, maxResults);

        for (var i = 0; i < displayResults.length; i++) {
            var r = displayResults[i];
            var resultEl = renderResult(r.project, r.session, query, basePath);
            searchResults.appendChild(resultEl);
        }

        var statusText = 'Found ' + results.length + ' session(s)';
        if (currentProject) {
            statusText += ' in ' + currentProject;
        }
        if (results.length > maxResults) {
            statusText += ' (showing first ' + maxResults + ')';
        }
        searchStatus.textContent = statusText;
    }

    // Event listeners
    searchBtn.addEventListener('click', function() {
        openModal(searchInput.value);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            openModal(searchInput.value);
        }
    });

    modalSearchBtn.addEventListener('click', function() {
        performSearch(modalInput.value);
    });

    modalInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            performSearch(modalInput.value);
        }
    });

    modalCloseBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Check for #search= in URL on page load
    if (window.location.hash.startsWith('#search=')) {
        var query = decodeURIComponent(window.location.hash.substring(8));
        if (query) {
            searchInput.value = query;
            openModal(query);
        }
    }
})();
