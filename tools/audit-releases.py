"""Read-only public TMApps distribution audit; Python standard library only.

Checks metadata and checksum sidecars, not downloaded executable bytes or runtime
behaviour. Exit 1 means findings; exit 2 means the audit could not complete.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import re
import sys
import time
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

API = "https://api.github.com/repos/DaddyTylerXO/TMApps/"
DOWNLOAD = "https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/"


def read(url):
    if not (url.startswith(API) or url.startswith(DOWNLOAD)):
        raise ValueError("Refusing a URL outside the audited repository")
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "TMApps-maintenance-audit"})
            with urlopen(request, timeout=40) as response:
                return response.read().decode("utf-8-sig")
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def get_json(url):
    return json.loads(read(url))


def collection(path):
    result = []
    page = 1
    while True:
        batch = get_json(f"{API}{path}?per_page=100&page={page}")
        result.extend(batch)
        if len(batch) < 100:
            return result
        page += 1


def audit():
    branches = collection("branches")
    branch_names = {branch["name"] for branch in branches}
    release = get_json(API + "releases/tags/tma-apps")
    assets = collection(f"releases/{release['id']}/assets")
    by_name = {asset["name"]: asset for asset in assets}
    findings = []
    if release["draft"] or release["prerelease"]:
        findings.append("Shared release is marked draft or prerelease")
    catalog = get_json(DOWNLOAD + "catalog.json")
    launcher_update = get_json(DOWNLOAD + "launcher-update.json")
    launcher_platforms = get_json(DOWNLOAD + "launcher-platforms.json")
    packages = []
    for app in catalog["apps"]:
        if app["branch"] not in branch_names:
            findings.append(f"{app['id']}: catalog branch does not exist: {app['branch']}")
        if app.get("downloadUrl"):
            packages.append({"app": app["id"], "platform": "windows-x64",
                             "url": app["downloadUrl"], "sha256": app.get("sha256", "")})
        for platform, package in app.get("packages", {}).items():
            packages.append({"app": app["id"], "platform": platform, **package})
    packages.append({"app": "launcher", "platform": "windows-x64",
                     "url": launcher_update["downloadUrl"], "sha256": launcher_update["sha256"]})
    if launcher_update["version"] != launcher_platforms["version"]:
        findings.append("Launcher Windows and native update-feed versions differ")
    for package in launcher_platforms["releases"]:
        packages.append({"app": "launcher", **package,
                         "url": package.get("downloadUrl") or package.get("url") or DOWNLOAD + package["filename"]})

    def verify(package):
        url = package["url"]
        if not url.startswith(DOWNLOAD):
            return {**package, "errors": ["Package URL is outside the shared release"]}
        name = unquote(urlparse(url).path.rsplit("/", 1)[-1])
        errors = []
        asset = by_name.get(name)
        expected = package["sha256"].lower()
        if not re.fullmatch(r"[a-f0-9]{64}", expected):
            errors.append("Invalid manifest SHA-256")
        if not asset or asset["state"] != "uploaded" or asset["size"] <= 0:
            errors.append("Missing, empty or incomplete release asset")
        elif asset.get("digest") != "sha256:" + expected:
            errors.append("GitHub asset digest differs from manifest SHA-256")
        sidecar = name + ".sha256"
        # Windows update feed uses a versioned filename; the workflow publishes
        # its identical bytes and checksum under the stable Setup.exe alias.
        if sidecar not in by_name and package["app"] == "launcher" and name.endswith(".exe"):
            alias = by_name.get("TMApps-Launcher-Setup.exe", {})
            if alias.get("digest") == "sha256:" + expected:
                sidecar = "TMApps-Launcher-Setup.exe.sha256"
        if sidecar not in by_name:
            errors.append("Missing checksum sidecar")
        else:
            checksum = read(DOWNLOAD + sidecar).strip().split()[0].lower()
            if checksum != expected:
                errors.append("Checksum sidecar differs from manifest SHA-256")
        return {**package, "filename": name, "checksum": sidecar,
                "asset_updated_at": asset.get("updated_at") if asset else None, "errors": errors}

    with ThreadPoolExecutor(max_workers=6) as pool:
        checked = list(pool.map(verify, packages))
    for package in checked:
        findings.extend(f"{package['filename']}: {error}" for error in package["errors"])
    return {"checked_at": datetime.now(timezone.utc).isoformat(),
            "scope": "Public branch inventory, published manifests, asset digests and checksum sidecars; binaries not downloaded or executed",
            "branches": [{"name": b["name"], "sha": b["commit"]["sha"], "protected": b["protected"]} for b in branches],
            "release_asset_count": len(assets), "launcher_version": launcher_update["version"],
            "apps": [{"id": a["id"], "version": a["version"], "branch": a["branch"],
                      "platforms": a.get("platforms", [])} for a in catalog["apps"]],
            "packages_checked": checked, "findings": findings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="Optional JSON report path; default prints to stdout")
    args = parser.parse_args()
    try:
        result = audit()
    except Exception as error:
        print(f"Audit incomplete: {type(error).__name__}: {error}", file=sys.stderr)
        return 2
    report = json.dumps(result, indent=2) + "\n"
    if args.output:
        with open(args.output, "w", encoding="utf-8") as output:
            output.write(report)
        print(f"Checked {len(result['branches'])} branches, {result['release_asset_count']} assets, "
              f"{len(result['packages_checked'])} manifest packages; {len(result['findings'])} finding(s).")
        for finding in result["findings"]:
            print(finding)
    else:
        print(report, end="")
    return 1 if result["findings"] else 0


if __name__ == "__main__":
    sys.exit(main())
