FORBIDDEN_COMMANDS = {
    "sudo",
    "rm -rf /",
    "mkfs",
    "shutdown",
    "reboot",
}


def is_command_allowed(command: str) -> bool:
    normalized = command.strip().lower()

    for forbidden in FORBIDDEN_COMMANDS:
        if normalized == forbidden or normalized.startswith(forbidden + " "):
            return False

    return True
