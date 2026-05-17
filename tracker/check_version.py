import json
import os
import re
import urllib.request


def get_local_version():
    try:
        version_file = os.path.join(os.path.dirname(__file__), "version.py")
        with open(version_file) as f:
            content = f.read()
            match = re.search(r'APP_VERSION = "([^"]+)"', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return None

def get_latest_version():
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/Boblebol/pokevault/releases/latest",
            headers={"User-Agent": "Pokevault-Version-Checker"}
        )
        with urllib.request.urlopen(req, timeout=2) as response:
            data = json.loads(response.read().decode())
            return data.get("tag_name")
    except Exception:
        return None

def main():
    local = get_local_version()
    latest = get_latest_version()
    if not local or not latest:
        return

    norm_local = local.strip().lstrip('v')
    norm_latest = latest.strip().lstrip('v')

    if norm_local != norm_latest:
        print(
            f"\033[33mUne nouvelle version est disponible : {latest} "
            f"(actuelle : v{local})\033[0m"
        )
        print(
            "\033[33mConsultez https://github.com/Boblebol/pokevault/releases "
            "pour mettre à jour.\033[0m"
        )
        print("")

if __name__ == "__main__":
    main()
