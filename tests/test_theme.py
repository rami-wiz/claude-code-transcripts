"""Tests for theme loading and validation."""

import json
import tempfile
from pathlib import Path

import pytest

from claude_code_transcripts.theme import (
    DEFAULT_THEME,
    THEMES_DIR,
    load_theme,
    list_themes,
)


class TestDefaultTheme:
    """Tests for the default theme."""

    def test_default_theme_has_required_keys(self):
        """Test that DEFAULT_THEME has all required color keys."""
        required_keys = [
            "bg_color",
            "card_bg",
            "user_bg",
            "user_border",
            "assistant_bg",
            "assistant_border",
            "thinking_bg",
            "thinking_border",
            "tool_bg",
            "tool_border",
            "tool_result_bg",
            "tool_error_bg",
            "text_color",
            "text_muted",
            "code_bg",
            "code_text",
            "commit_bg",
            "commit_border",
            "commit_text",
            "link_color",
        ]
        for key in required_keys:
            assert key in DEFAULT_THEME, f"Missing key: {key}"

    def test_default_theme_values_are_valid_colors(self):
        """Test that DEFAULT_THEME values are valid CSS color values."""
        for key, value in DEFAULT_THEME.items():
            assert isinstance(value, str), f"{key} should be a string"
            # Should be a hex color
            assert value.startswith("#"), f"{key} should be a hex color"
            # Should be valid hex (3 or 6 characters after #)
            hex_part = value[1:]
            assert len(hex_part) in (3, 6), f"{key} should have 3 or 6 hex digits"
            assert all(
                c in "0123456789abcdefABCDEF" for c in hex_part
            ), f"{key} should be valid hex"


class TestLoadTheme:
    """Tests for load_theme function."""

    def test_load_theme_none_returns_default(self):
        """Test that load_theme(None) returns the default theme."""
        theme = load_theme(None)
        assert theme == DEFAULT_THEME

    def test_load_theme_none_returns_copy(self):
        """Test that load_theme(None) returns a copy, not the original."""
        theme = load_theme(None)
        theme["bg_color"] = "#000000"
        # Original should be unchanged
        assert DEFAULT_THEME["bg_color"] != "#000000"

    def test_load_theme_from_file_path(self, tmp_path):
        """Test loading a theme from an explicit file path."""
        theme_file = tmp_path / "custom.json"
        custom_theme = {"bg_color": "#111111", "user_bg": "#222222"}
        theme_file.write_text(json.dumps(custom_theme))

        theme = load_theme(str(theme_file))

        # Custom values should be used
        assert theme["bg_color"] == "#111111"
        assert theme["user_bg"] == "#222222"
        # Missing values should fall back to defaults
        assert theme["text_color"] == DEFAULT_THEME["text_color"]

    def test_load_theme_from_path_object(self, tmp_path):
        """Test loading a theme from a Path object."""
        theme_file = tmp_path / "custom.json"
        custom_theme = {"bg_color": "#333333"}
        theme_file.write_text(json.dumps(custom_theme))

        theme = load_theme(theme_file)
        assert theme["bg_color"] == "#333333"

    def test_load_theme_by_name(self, tmp_path, monkeypatch):
        """Test loading a theme by name from themes directory."""
        # Create a mock themes directory
        themes_dir = tmp_path / ".claude-code-transcripts" / "themes"
        themes_dir.mkdir(parents=True)

        # Create a named theme
        dark_theme = {"bg_color": "#1a1a1a", "text_color": "#ffffff"}
        (themes_dir / "dark.json").write_text(json.dumps(dark_theme))

        # Monkey-patch THEMES_DIR
        import claude_code_transcripts.theme as theme_module

        monkeypatch.setattr(theme_module, "THEMES_DIR", themes_dir)

        theme = load_theme("dark")

        assert theme["bg_color"] == "#1a1a1a"
        assert theme["text_color"] == "#ffffff"
        # Defaults should fill in missing values
        assert theme["user_bg"] == DEFAULT_THEME["user_bg"]

    def test_load_theme_not_found_raises_error(self, tmp_path, monkeypatch):
        """Test that load_theme raises FileNotFoundError for missing theme."""
        # Create a mock themes directory with no themes
        themes_dir = tmp_path / ".claude-code-transcripts" / "themes"
        themes_dir.mkdir(parents=True)

        import claude_code_transcripts.theme as theme_module

        monkeypatch.setattr(theme_module, "THEMES_DIR", themes_dir)

        with pytest.raises(FileNotFoundError) as exc_info:
            load_theme("nonexistent")

        assert "Theme not found" in str(exc_info.value)
        assert "nonexistent" in str(exc_info.value)

    def test_load_theme_merges_with_defaults(self, tmp_path):
        """Test that partial themes are merged with defaults."""
        theme_file = tmp_path / "partial.json"
        # Only override one value
        partial_theme = {"bg_color": "#ff0000"}
        theme_file.write_text(json.dumps(partial_theme))

        theme = load_theme(str(theme_file))

        # Check the override was applied
        assert theme["bg_color"] == "#ff0000"
        # Check all other defaults are present
        for key, value in DEFAULT_THEME.items():
            if key != "bg_color":
                assert theme[key] == value, f"Missing default for {key}"


class TestListThemes:
    """Tests for list_themes function."""

    def test_list_themes_empty_when_no_dir(self, tmp_path, monkeypatch):
        """Test that list_themes returns empty list when themes dir doesn't exist."""
        nonexistent_dir = tmp_path / "nonexistent" / "themes"

        import claude_code_transcripts.theme as theme_module

        monkeypatch.setattr(theme_module, "THEMES_DIR", nonexistent_dir)

        themes = list_themes()
        assert themes == []

    def test_list_themes_returns_theme_names(self, tmp_path, monkeypatch):
        """Test that list_themes returns names of available themes."""
        themes_dir = tmp_path / ".claude-code-transcripts" / "themes"
        themes_dir.mkdir(parents=True)

        # Create some theme files
        (themes_dir / "dark.json").write_text("{}")
        (themes_dir / "light.json").write_text("{}")
        (themes_dir / "solarized.json").write_text("{}")

        import claude_code_transcripts.theme as theme_module

        monkeypatch.setattr(theme_module, "THEMES_DIR", themes_dir)

        themes = list_themes()

        assert set(themes) == {"dark", "light", "solarized"}

    def test_list_themes_ignores_non_json_files(self, tmp_path, monkeypatch):
        """Test that list_themes ignores non-JSON files."""
        themes_dir = tmp_path / ".claude-code-transcripts" / "themes"
        themes_dir.mkdir(parents=True)

        # Create a theme file and some other files
        (themes_dir / "dark.json").write_text("{}")
        (themes_dir / "readme.txt").write_text("Not a theme")
        (themes_dir / "backup.json.bak").write_text("{}")

        import claude_code_transcripts.theme as theme_module

        monkeypatch.setattr(theme_module, "THEMES_DIR", themes_dir)

        themes = list_themes()

        assert themes == ["dark"]
