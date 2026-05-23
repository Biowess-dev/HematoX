import os

_corpus_cache: dict[str, tuple[float, str]] = {}

CORPUS_MAP = {
    "cbc":   "corpus/cbc_guidelines.md",
    "coag":  "corpus/coag_guidelines.md",
    "rotem": "corpus/rotem_guidelines.md",
}

def load_corpus(module_type: str) -> str:
    """
    Attempts to load and return the corpus file content for the specified module type.
    
    If the module_type is not in CORPUS_MAP, raises ValueError.
    If the file does not exist or a PermissionError occurs, returns "[CORPUS UNAVAILABLE: {filename}]".
    """
    if module_type not in CORPUS_MAP:
        raise ValueError(f"Unknown module type: {module_type}")
    
    filename = CORPUS_MAP[module_type]
    abs_path = os.path.abspath(filename)
    
    try:
        mtime = os.path.getmtime(abs_path)
        if abs_path in _corpus_cache and _corpus_cache[abs_path][0] == mtime:
            return _corpus_cache[abs_path][1]
        
        with open(abs_path, "r", encoding="utf-8") as f:
            content = f.read()
        _corpus_cache[abs_path] = (mtime, content)
        return content
    except (FileNotFoundError, PermissionError, OSError):
        return f"[CORPUS UNAVAILABLE: {filename}]"

def create_corpus_stubs() -> None:
    """
    Creates the corpus/ directory if it does not exist, and initializes stub files
    for each corpus mapping if they do not already exist.
    """
    os.makedirs("corpus", exist_ok=True)
    
    stubs = {
        "corpus/cbc_guidelines.md": "# CBC Guidelines\n\n*Populate this file with CBC interpretation rules.*",
        "corpus/coag_guidelines.md": "# Coagulation Guidelines\n\n*Populate this file with coagulation interpretation rules.*",
        "corpus/rotem_guidelines.md": "# ROTEM Guidelines\n\n*Populate this file with ROTEM interpretation rules.*",
    }
    
    for filepath, content in stubs.items():
        if not os.path.exists(filepath):
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

# Call create_corpus_stubs() at module import time
create_corpus_stubs()
