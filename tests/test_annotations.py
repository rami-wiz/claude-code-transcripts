"""Tests for annotation system CSS and HTML generation."""

import json
import tempfile
from pathlib import Path

import pytest

from claude_code_transcripts import generate_html, get_styles
from claude_code_transcripts.theme import DEFAULT_THEME


class TestAnnotationThemeVariables:
    """Tests for annotation CSS variables in theme."""

    def test_default_theme_has_annotation_keys(self):
        """Test that DEFAULT_THEME has annotation color keys."""
        annotation_keys = [
            "annotation_bg",
            "annotation_border",
            "annotation_text",
        ]
        for key in annotation_keys:
            assert key in DEFAULT_THEME, f"Missing key: {key}"

    def test_annotation_values_are_valid_colors(self):
        """Test that annotation theme values are valid CSS hex colors."""
        annotation_keys = [
            "annotation_bg",
            "annotation_border",
            "annotation_text",
        ]
        for key in annotation_keys:
            value = DEFAULT_THEME[key]
            assert isinstance(value, str), f"{key} should be a string"
            assert value.startswith("#"), f"{key} should be a hex color"
            hex_part = value[1:]
            assert len(hex_part) in (3, 6), f"{key} should have 3 or 6 hex digits"
            assert all(
                c in "0123456789abcdefABCDEF" for c in hex_part
            ), f"{key} should be valid hex"


class TestAnnotationCSSGeneration:
    """Tests for annotation CSS class generation."""

    def test_get_styles_includes_annotation_variables(self):
        """Test that get_styles() includes annotation CSS variables."""
        css = get_styles()
        assert "--annotation-bg:" in css
        assert "--annotation-border:" in css
        assert "--annotation-text:" in css

    def test_get_styles_includes_annotation_classes(self):
        """Test that get_styles() includes annotation CSS classes."""
        css = get_styles()
        assert ".annotate-icon" in css
        assert ".annotate-icon.active" in css
        assert ".annotation-mode-active" in css
        assert ".annotation-bubble" in css
        assert ".annotation-margin" in css
        assert "#annotation-modal" in css
        assert "#annotation-menu" in css

    def test_get_styles_with_custom_annotation_colors(self):
        """Test that custom annotation colors are applied."""
        custom_theme = {
            **DEFAULT_THEME,
            "annotation_bg": "#ff0000",
            "annotation_border": "#00ff00",
            "annotation_text": "#0000ff",
        }
        css = get_styles(custom_theme)
        assert "--annotation-bg: #ff0000" in css
        assert "--annotation-border: #00ff00" in css
        assert "--annotation-text: #0000ff" in css


class TestAnnotationHTMLGeneration:
    """Tests for annotation HTML elements in generated pages."""

    def test_index_html_has_annotate_icon(self, tmp_path):
        """Test that index.html includes the annotate icon button."""
        # Create a simple session file
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-21T10:00:05.000Z",
                "message": {"content": [{"type": "text", "text": "Hi there!"}]},
            },
        ]
        session_file.write_text("\n".join(json.dumps(d) for d in session_data))

        # Generate HTML
        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        # Check index.html has annotate icon
        index_html = (output_dir / "index.html").read_text()
        assert 'class="annotate-icon"' in index_html
        assert 'id="annotate-icon"' in index_html

    def test_index_html_has_annotation_modal(self, tmp_path):
        """Test that index.html includes the annotation modal."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        assert 'id="annotation-modal"' in index_html
        assert 'id="annotation-input"' in index_html
        assert 'id="annotation-save-btn"' in index_html

    def test_index_html_has_annotation_menu(self, tmp_path):
        """Test that index.html includes the annotation menu dialog."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        assert 'id="annotation-menu"' in index_html
        assert 'id="annotation-start-btn"' in index_html
        assert 'id="annotation-load-btn"' in index_html
        assert "Start Annotating" in index_html
        assert "Load Annotations" in index_html

    def test_index_html_has_annotation_margin(self, tmp_path):
        """Test that index.html includes the annotation margin container."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        assert 'class="annotation-wrapper"' in index_html
        assert 'class="annotation-content"' in index_html
        assert 'id="annotation-margin"' in index_html

    def test_page_html_has_annotate_icon(self, tmp_path):
        """Test that page HTML files include the annotate icon."""
        # Create session with enough prompts for at least one page
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Test prompt"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-21T10:00:05.000Z",
                "message": {"content": [{"type": "text", "text": "Response"}]},
            },
        ]
        session_file.write_text("\n".join(json.dumps(d) for d in session_data))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        # Check page-001.html has annotate icon
        page_html = (output_dir / "page-001.html").read_text()
        assert 'class="annotate-icon"' in page_html
        assert 'id="annotate-icon"' in page_html

    def test_page_html_has_annotation_modal(self, tmp_path):
        """Test that page HTML files include the annotation modal."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Test"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        page_html = (output_dir / "page-001.html").read_text()
        assert 'id="annotation-modal"' in page_html

    def test_index_item_has_data_prompt_num(self, tmp_path):
        """Test that index items include data-prompt-num attribute."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "First prompt"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-21T10:00:05.000Z",
                "message": {"content": [{"type": "text", "text": "Response 1"}]},
            },
            {
                "type": "user",
                "timestamp": "2026-01-21T10:01:00.000Z",
                "message": {"content": "Second prompt"},
            },
            {
                "type": "assistant",
                "timestamp": "2026-01-21T10:01:05.000Z",
                "message": {"content": [{"type": "text", "text": "Response 2"}]},
            },
        ]
        session_file.write_text("\n".join(json.dumps(d) for d in session_data))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        assert 'data-prompt-num="1"' in index_html
        assert 'data-prompt-num="2"' in index_html


class TestAnnotationJavaScript:
    """Tests for annotation JavaScript in generated pages."""

    def test_annotations_js_included_in_index(self, tmp_path):
        """Test that annotations.js content is included in index.html."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        # Check for key JavaScript functions
        assert "startAnnotating" in index_html
        assert "finishAnnotating" in index_html
        assert "exportAnnotations" in index_html
        assert "parseMarkdown" in index_html
        assert "renderAnnotations" in index_html

    def test_annotations_js_has_localstorage_functions(self, tmp_path):
        """Test that annotations.js includes localStorage persistence functions."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        # Check for localStorage persistence functions
        assert "getStorageKey" in index_html
        assert "autoSave" in index_html
        assert "localStorage.setItem" in index_html
        assert "localStorage.getItem" in index_html

    def test_annotations_js_has_export_function(self, tmp_path):
        """Test that annotations.js includes export functionality."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Hello"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        index_html = (output_dir / "index.html").read_text()
        # Check for export functionality
        assert "exportAnnotations" in index_html

    def test_annotations_js_included_in_page(self, tmp_path):
        """Test that annotations.js content is included in page HTML."""
        session_file = tmp_path / "session.jsonl"
        session_data = [
            {
                "type": "user",
                "timestamp": "2026-01-21T10:00:00.000Z",
                "message": {"content": "Test"},
            },
        ]
        session_file.write_text(json.dumps(session_data[0]))

        output_dir = tmp_path / "output"
        generate_html(session_file, output_dir)

        page_html = (output_dir / "page-001.html").read_text()
        assert "annotationMode" in page_html
        assert "createBubble" in page_html
