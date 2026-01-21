// Annotation system for Claude Code transcripts
(function() {
    // State
    var annotationMode = false;
    var annotations = { version: '1.0', annotations: {} };
    var currentTargetId = null;
    var fileHandle = null; // For File System Access API
    var currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Get localStorage key for this transcript
    function getStorageKey() {
        var path = window.location.pathname;
        var dir = path.substring(0, path.lastIndexOf('/') + 1);
        return 'annotations:' + dir;
    }

    // Auto-save annotations to localStorage
    function autoSave() {
        try {
            var key = getStorageKey();
            localStorage.setItem(key, JSON.stringify(annotations));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    // Elements
    var menu = document.getElementById('annotation-menu');
    var modal = document.getElementById('annotation-modal');
    var input = document.getElementById('annotation-input');
    var targetLabel = document.getElementById('annotation-target-label');
    var closeBtn = document.getElementById('annotation-close-btn');
    var saveBtn = document.getElementById('annotation-save-btn');
    var deleteBtn = document.getElementById('annotation-delete-btn');
    var annotateIcon = document.getElementById('annotate-icon');
    var marginContainer = document.getElementById('annotation-margin');
    var statusBar = document.getElementById('annotation-status');
    var statusText = document.getElementById('annotation-status-text');
    var doneBtn = document.getElementById('annotation-done-btn');
    var startBtn = document.getElementById('annotation-start-btn');
    var loadBtn = document.getElementById('annotation-load-btn');
    var exportBtn = document.getElementById('annotation-export-btn');
    var cancelBtn = document.getElementById('annotation-cancel-btn');
    var badge = annotateIcon ? annotateIcon.querySelector('.annotation-badge') : null;

    // Count annotations for current page
    function countPageAnnotations() {
        var count = 0;
        for (var id in annotations.annotations) {
            // Count all annotations (they belong to this transcript)
            count++;
        }
        return count;
    }

    // Update badge display
    function updateBadge() {
        if (!badge || !annotateIcon) return;
        var count = countPageAnnotations();
        badge.textContent = count;
        if (count > 0) {
            annotateIcon.classList.add('has-annotations');
        } else {
            annotateIcon.classList.remove('has-annotations');
        }
    }

    // Get element ID for annotation storage
    function getAnnotationId(element) {
        if (element.classList.contains('message') && element.id) {
            return element.id;
        }
        if (element.classList.contains('index-item')) {
            var promptNum = element.getAttribute('data-prompt-num');
            if (promptNum) {
                return 'index-' + promptNum;
            }
        }
        return null;
    }

    // Get display label for target
    function getTargetLabel(id) {
        if (id.startsWith('msg-')) {
            return 'Message: ' + id.replace('msg-', '').replace(/-/g, ':').slice(0, 19);
        }
        if (id.startsWith('index-')) {
            return 'Prompt #' + id.replace('index-', '');
        }
        return id;
    }

    // Simple markdown to HTML parser
    function parseMarkdown(text) {
        if (!text) return '';
        var html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        var paragraphs = html.split(/\n\n+/);
        html = paragraphs.map(function(p) {
            return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
        }).join('');
        return html;
    }

    // Find element by annotation ID
    function findElementById(id) {
        if (id.startsWith('msg-')) {
            return document.getElementById(id);
        }
        if (id.startsWith('index-')) {
            var promptNum = id.replace('index-', '');
            return document.querySelector('.index-item[data-prompt-num="' + promptNum + '"]');
        }
        return null;
    }

    // Create margin bubble for an annotation
    function createBubble(id, content, element) {
        if (!marginContainer || !element) return null;

        var bubble = document.createElement('div');
        bubble.className = 'annotation-bubble';
        bubble.setAttribute('data-annotation-id', id);
        bubble.innerHTML = '<div class="annotation-bubble-connector"></div>' + parseMarkdown(content);

        // Position bubble relative to element
        var wrapperRect = marginContainer.parentElement.getBoundingClientRect();
        var elementRect = element.getBoundingClientRect();
        var marginRect = marginContainer.getBoundingClientRect();

        // Calculate top position relative to margin container
        var topOffset = elementRect.top - wrapperRect.top;
        bubble.style.top = topOffset + 'px';

        // Click bubble to edit
        bubble.addEventListener('click', function() {
            if (annotationMode) {
                openModal(id);
            }
        });

        marginContainer.appendChild(bubble);

        // Mark element as having annotation
        element.classList.add('has-annotation');

        return bubble;
    }

    // Remove all bubbles
    function clearBubbles() {
        if (!marginContainer) return;
        marginContainer.innerHTML = '';
        document.querySelectorAll('.has-annotation').forEach(function(el) {
            el.classList.remove('has-annotation');
        });
    }

    // Render all annotations as margin bubbles
    function renderAnnotations() {
        clearBubbles();
        for (var id in annotations.annotations) {
            var annotation = annotations.annotations[id];
            var element = findElementById(id);
            if (element && annotation.content) {
                createBubble(id, annotation.content, element);
            }
        }
        updateBadge();
    }

    // Reposition bubbles on scroll/resize
    function repositionBubbles() {
        if (!marginContainer) return;
        var wrapperRect = marginContainer.parentElement.getBoundingClientRect();
        var bubbles = marginContainer.querySelectorAll('.annotation-bubble');
        bubbles.forEach(function(bubble) {
            var id = bubble.getAttribute('data-annotation-id');
            var element = findElementById(id);
            if (element) {
                var elementRect = element.getBoundingClientRect();
                var topOffset = elementRect.top - wrapperRect.top;
                bubble.style.top = topOffset + 'px';
            }
        });
    }

    // Open menu dialog
    function openMenu() {
        if (menu) menu.showModal();
    }

    // Close menu dialog
    function closeMenu() {
        if (menu) menu.close();
    }

    // Start annotation mode
    function startAnnotating() {
        closeMenu();
        annotationMode = true;
        document.body.classList.add('annotation-mode-active');
        annotateIcon.classList.add('active');
        statusBar.classList.add('visible');
        updateStatusText();
    }

    // Exit annotation mode (annotations are auto-saved to localStorage on each change)
    function finishAnnotating() {
        annotationMode = false;
        document.body.classList.remove('annotation-mode-active');
        annotateIcon.classList.remove('active');
        statusBar.classList.remove('visible');
        // No need to prompt - annotations are auto-saved to localStorage
    }

    // Update status bar text
    function updateStatusText() {
        var count = countPageAnnotations();
        statusText.textContent = count + ' annotation' + (count !== 1 ? 's' : '');
    }

    // Open modal for a target
    function openModal(targetId) {
        currentTargetId = targetId;
        targetLabel.textContent = getTargetLabel(targetId);
        var existing = annotations.annotations[targetId];
        input.value = existing ? existing.content : '';
        deleteBtn.style.display = existing ? 'block' : 'none';
        modal.showModal();
        input.focus();
    }

    // Close modal
    function closeModal() {
        modal.close();
        currentTargetId = null;
    }

    // Save annotation (to memory and localStorage)
    function saveAnnotationToMemory() {
        var content = input.value.trim();
        if (!currentTargetId) return;

        if (!annotations.created_at) {
            annotations.created_at = new Date().toISOString();
        }

        if (content) {
            annotations.annotations[currentTargetId] = {
                content: content,
                created_at: annotations.annotations[currentTargetId]
                    ? annotations.annotations[currentTargetId].created_at
                    : new Date().toISOString()
            };
        } else {
            delete annotations.annotations[currentTargetId];
        }

        annotations.modified_at = new Date().toISOString();
        autoSave();
        renderAnnotations();
        updateStatusText();
        closeModal();
    }

    // Delete annotation
    function deleteAnnotation() {
        if (!currentTargetId) return;
        if (!confirm('Delete this annotation?')) return;

        delete annotations.annotations[currentTargetId];
        annotations.modified_at = new Date().toISOString();
        autoSave();
        renderAnnotations();
        updateStatusText();
        closeModal();
    }

    // Export annotations to file (for sharing/backup)
    async function exportAnnotations() {
        if (countPageAnnotations() === 0) {
            alert('No annotations to export.');
            return;
        }

        annotations.modified_at = new Date().toISOString();
        var json = JSON.stringify(annotations, null, 2);

        // Try File System Access API first (Chrome/Edge)
        if ('showSaveFilePicker' in window) {
            try {
                var handle = await window.showSaveFilePicker({
                    suggestedName: 'annotations.json',
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                var writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                console.log('Annotations exported via File System Access API');
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return; // User cancelled
                }
                console.log('File System Access API failed, falling back to download');
            }
        }

        // Fallback to download
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'annotations.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Load annotations from file
    function loadAnnotationsFromFile() {
        closeMenu();

        // Try File System Access API first
        if ('showOpenFilePicker' in window) {
            window.showOpenFilePicker({
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            }).then(async function(handles) {
                fileHandle = handles[0];
                var file = await fileHandle.getFile();
                var text = await file.text();
                processLoadedAnnotations(text);
            }).catch(function(err) {
                if (err.name !== 'AbortError') {
                    // Fallback to regular file input
                    loadWithFileInput();
                }
            });
        } else {
            loadWithFileInput();
        }
    }

    // Fallback file input method
    function loadWithFileInput() {
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                processLoadedAnnotations(e.target.result);
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    // Process loaded annotations JSON
    function processLoadedAnnotations(text) {
        try {
            var data = JSON.parse(text);
            if (data.annotations) {
                annotations = data;
                autoSave(); // Save to localStorage
                renderAnnotations();
                alert('Loaded ' + countPageAnnotations() + ' annotations.');
            } else {
                alert('Invalid annotations file format.');
            }
        } catch (err) {
            alert('Error parsing annotations file: ' + err.message);
        }
    }

    // Auto-load annotations from localStorage (primary) or annotations.json (fallback)
    function autoLoadAnnotations() {
        // Try localStorage first (works on both file:// and http://)
        try {
            var key = getStorageKey();
            var stored = localStorage.getItem(key);
            if (stored) {
                var data = JSON.parse(stored);
                if (data.annotations) {
                    annotations = data;
                    renderAnnotations();
                    console.log('Auto-loaded ' + countPageAnnotations() + ' annotations from localStorage.');
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not load from localStorage:', e);
        }

        // Fall back to fetch on HTTP (for server-side annotations.json)
        if (window.location.protocol === 'file:') return;
        fetch('annotations.json')
            .then(function(response) {
                if (response.ok) return response.json();
                throw new Error('Not found');
            })
            .then(function(data) {
                if (data.annotations) {
                    annotations = data;
                    autoSave(); // Migrate to localStorage
                    renderAnnotations();
                    console.log('Auto-loaded ' + countPageAnnotations() + ' annotations from annotations.json.');
                }
            })
            .catch(function() {
                // No annotations.json found
            });
    }

    // Handle click on annotatable elements
    function handleAnnotatableClick(e) {
        if (!annotationMode) return;

        var target = e.target.closest('.message, .index-item');
        if (!target) return;

        // Don't trigger for clicks on links
        if (e.target.closest('a')) return;

        e.preventDefault();
        e.stopPropagation();

        var id = getAnnotationId(target);
        if (id) {
            openModal(id);
        }
    }

    // Handle icon click
    function handleIconClick() {
        if (annotationMode) {
            // Already annotating - finish and save
            finishAnnotating();
        } else {
            // Show menu
            openMenu();
        }
    }

    // Initialize
    function init() {
        if (!annotateIcon) return;

        // Icon click handler
        annotateIcon.addEventListener('click', handleIconClick);

        // Menu handlers
        if (startBtn) startBtn.addEventListener('click', startAnnotating);
        if (loadBtn) loadBtn.addEventListener('click', loadAnnotationsFromFile);
        if (exportBtn) exportBtn.addEventListener('click', function() { closeMenu(); exportAnnotations(); });
        if (cancelBtn) cancelBtn.addEventListener('click', closeMenu);

        // Menu backdrop click
        if (menu) {
            menu.addEventListener('click', function(e) {
                if (e.target === menu) closeMenu();
            });
        }

        // Done button
        if (doneBtn) doneBtn.addEventListener('click', finishAnnotating);

        // Modal handlers
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (saveBtn) saveBtn.addEventListener('click', saveAnnotationToMemory);
        if (deleteBtn) deleteBtn.addEventListener('click', deleteAnnotation);

        // Modal backdrop click
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeModal();
            });
        }

        // Click handler for annotatable elements
        document.addEventListener('click', handleAnnotatableClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (modal && modal.open) closeModal();
                else if (menu && menu.open) closeMenu();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && modal && modal.open) {
                e.preventDefault();
                saveAnnotationToMemory();
            }
        });

        // Reposition bubbles on scroll/resize
        var repositionTimeout;
        function debouncedReposition() {
            clearTimeout(repositionTimeout);
            repositionTimeout = setTimeout(repositionBubbles, 50);
        }
        window.addEventListener('scroll', debouncedReposition);
        window.addEventListener('resize', debouncedReposition);

        // Auto-load annotations
        autoLoadAnnotations();

        // Initial badge update
        updateBadge();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
