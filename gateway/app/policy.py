import os
import re

# Default high-risk forbidden commands
DEFAULT_FORBIDDEN_COMMANDS = [
    "sudo",
    "su",
    "rm -rf /",
    "rm -rf /*",
    "rm -rf",
    "rm -r /",
    "rm -r /*",
    "rm -r",
    "mkfs",
    "shutdown",
    "reboot",
    "poweroff",
    "init 0",
    ":(){ :|:& };:",
    "dd if=",
]


def get_forbidden_commands() -> list[str]:
    """
    Returns list of blocked command patterns.
    Allows administrators to define custom risky commands via FORBIDDEN_COMMANDS in .env
    (comma-separated list, e.g. FORBIDDEN_COMMANDS="sudo,nmap,wireshark,rm -rf").
    """
    custom_env = os.getenv("FORBIDDEN_COMMANDS", "")
    if custom_env.strip():
        custom_list = [c.strip().lower() for c in custom_env.split(",") if c.strip()]
        # Merge custom rules with defaults without duplicates
        combined = list(dict.fromkeys(custom_list + [c.lower() for c in DEFAULT_FORBIDDEN_COMMANDS]))
        return combined
    return [c.lower() for c in DEFAULT_FORBIDDEN_COMMANDS]


def is_command_allowed(command: str) -> bool:
    """
    Evaluates whether an entered shell command violates gateway security policy.
    Returns True if allowed, False if dangerous/forbidden.
    """
    if not command:
        return True

    # Normalize multiple whitespace into single space and lowercase
    normalized = " ".join(command.strip().lower().split())

    forbidden_list = get_forbidden_commands()

    for forbidden in forbidden_list:
        if normalized == forbidden or normalized.startswith(forbidden + " "):
            return False

    # Regex protection against destructive recursive root or wildcards
    if re.search(r"\brm\s+-(?:r|rf|fr|rfi)\s+(?:/|\./|\*|~|/\*)", normalized):
        return False

    return True
