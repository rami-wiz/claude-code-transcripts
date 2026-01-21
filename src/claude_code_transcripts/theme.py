"""Theme management for Claude Code transcripts.

This module provides:
- DEFAULT_THEME: The built-in default color scheme
- load_theme(): Load a theme by name or file path
- list_themes(): List available named themes
"""

import json
from pathlib import Path

# Default themes directory in user's home
THEMES_DIR = Path.home() / ".claude-code-transcripts" / "themes"

# Default theme with all customizable colors
DEFAULT_THEME = {
    "bg_color": "#f5f5f5",
    "card_bg": "#ffffff",
    "user_bg": "#e3f2fd",
    "user_border": "#1976d2",
    "assistant_bg": "#f5f5f5",
    "assistant_border": "#9e9e9e",
    "thinking_bg": "#fff8e1",
    "thinking_border": "#ffc107",
    "tool_bg": "#f3e5f5",
    "tool_border": "#9c27b0",
    "tool_result_bg": "#e8f5e9",
    "tool_error_bg": "#ffebee",
    "text_color": "#212121",
    "text_muted": "#757575",
    "code_bg": "#263238",
    "code_text": "#aed581",
    "commit_bg": "#fff3e0",
    "commit_border": "#ff9800",
    "commit_text": "#e65100",
    "link_color": "#1976d2",
}


def load_theme(name_or_path: str | Path | None = None) -> dict:
    """Load theme from JSON file, validate, and merge with defaults.

    Args:
        name_or_path: Theme name (e.g., "dark") or path to theme.json file.
                      If None, returns DEFAULT_THEME (built-in).

    Theme lookup order:
    1. If None: return built-in default
    2. If path exists: load that file
    3. If name provided: look for ~/.claude-code-transcripts/themes/{name}.json

    Returns:
        A complete theme dict with all keys from DEFAULT_THEME.

    Raises:
        FileNotFoundError: If the theme file cannot be found.
    """
    if name_or_path is None:
        return DEFAULT_THEME.copy()

    # Check if it's a path to an existing file
    path = Path(name_or_path)
    if path.exists():
        theme_file = path
    else:
        # Try as a named theme in themes directory
        theme_file = THEMES_DIR / f"{name_or_path}.json"
        if not theme_file.exists():
            raise FileNotFoundError(
                f"Theme not found: '{name_or_path}'. "
                f"Checked: {path} and {theme_file}"
            )

    with open(theme_file) as f:
        user_theme = json.load(f)

    # Merge with defaults to ensure all keys present
    return {**DEFAULT_THEME, **user_theme}


def list_themes() -> list[str]:
    """List available named themes in ~/.claude-code-transcripts/themes/.

    Returns:
        List of theme names (without .json extension).
    """
    if not THEMES_DIR.exists():
        return []
    return [p.stem for p in THEMES_DIR.glob("*.json")]
