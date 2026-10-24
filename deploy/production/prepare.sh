#!/usr/bin/env bash
# Prepare production configuration only. Run on the Ubuntu Docker host as root:
#   sudo bash deploy/production/prepare.sh --init
#   sudo bash deploy/production/prepare.sh --check
# Optional: --config-dir /absolute/path (default /etc/hams).
# Requires Python >= 3.10, OpenSSL, iproute2, Docker Engine and Compose >= 2.30.
# Does not install packages, build/start containers, migrate/seed/bootstrap,
# contact SMTP, change DNS/firewall, or generate a certificate/test CA.
# --init creates missing configuration for a NEW installation. Existing secrets
# are validated and retained. --check never creates or changes configuration.
# Exit codes: 0 = initialization completed / checks passed, 1 = error,
# 2 = --check found settings or certificate files that still need preparation.
set -euo pipefail
umask 077

usage() {
    printf '%s\n' \
        'Usage: sudo bash deploy/production/prepare.sh --init|--check [--config-dir /etc/hams]' \
        '--init   Prepare files and independent secrets; preserve existing values.' \
        '--check  Read-only configuration/certificate checks; exit 2 when incomplete.'
}

mode=''
config_dir='/etc/hams'
while (($#)); do
    case "$1" in
        --init|--check)
            if [[ -n "$mode" ]]; then usage >&2; exit 1; fi
            mode="$1"
            shift
            ;;
        --config-dir)
            if (($# < 2)); then usage >&2; exit 1; fi
            config_dir="$2"
            shift 2
            ;;
        --help|-h) usage; exit 0 ;;
        *) usage >&2; exit 1 ;;
    esac
done
if [[ -z "$mode" ]]; then usage >&2; exit 1; fi
if [[ "$(uname -s)" != Linux || "$EUID" -ne 0 ]]; then
    printf '%s\n' 'Run this script with sudo on the Linux Docker host.' >&2
    exit 1
fi
command -v python3 >/dev/null || {
    printf '%s\n' 'Python 3.10 or newer is required.' >&2; exit 1;
}
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

PYTHONDONTWRITEBYTECODE=1 python3 - "$script_dir" "$mode" "$config_dir" <<'PY'
import contextlib
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
from urllib.parse import unquote, urlsplit

SOURCE = Path(sys.argv[1])
MODE = sys.argv[2]
ROOT = Path(sys.argv[3])
REPO = SOURCE.parent.parent.resolve()
ORIGIN = 'https://med.hss05.com:20443'
PROJECT = 'hams'
VOLUME = PROJECT + '_postgres-data'
FILES = ('compose.env', 'backend.env', 'smtp.env', 'postgres-password')


class PreparationError(Exception):
    pass


def fail(message):
    raise PreparationError(message)


def run(args, label, check=True):
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        fail(label + ' could not complete. No credentials are printed.')
    if check and result.returncode:
        # Command output may contain credentials or certificate material.
        fail(label + ' failed. Inspect that configuration locally.')
    return result


def metadata(path, directory=False, secret=False):
    try:
        info = path.lstat()
    except FileNotFoundError:
        return None
    expected = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not expected or stat.S_ISLNK(info.st_mode) or info.st_uid != 0:
        fail(path.name + ' must be a real, root-owned ' + ('directory.' if directory else 'file.'))
    if not directory and info.st_nlink != 1:
        fail(path.name + ' must not be a hard link.')
    if secret and stat.S_IMODE(info.st_mode) != 0o600:
        fail(path.name + ' must have mode 0600; existing permissions were not changed.')
    return info


def read_env(path, allowed=None):
    metadata(path, secret=True)
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except (OSError, UnicodeError):
        fail(path.name + ' could not be read as UTF-8.')
    values = {}
    for number, line in enumerate(lines, 1):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'([A-Z][A-Z0-9_]*)=(.*)', line)
        if not match or '\x00' in line:
            fail(path.name + ': invalid raw env entry at line ' + str(number) + '.')
        key, value = match.groups()
        if key in values or (allowed is not None and key not in allowed):
            fail(path.name + ': duplicate or unexpected key ' + key + '.')
        if value and (value[0] in '\"\'' or value[-1] in '\"\''):
            fail(path.name + ': remove surrounding quotes from ' + key + '.')
        values[key] = value
    if allowed is not None and set(values) != allowed:
        fail(path.name + ' is missing keys from its reviewed template.')
    return values


def template(name):
    file = SOURCE / (name + '.example')
    if not file.is_file() or file.is_symlink():
        fail('Missing or linked template: ' + file.name)
    return file.read_text(encoding='utf-8')


def template_keys(name):
    return set(re.findall(r'^([A-Z][A-Z0-9_]*)=', template(name), re.MULTILINE))


def write_new(path, content):
    # Never truncate, follow a link, or replace an existing configuration file.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as file:
        file.write(content)
        file.flush()
        os.fsync(file.fileno())


def deployment_data_exists():
    volumes = run(['docker', 'volume', 'ls', '--format', '{{.Name}}'], 'Docker volume inspection').stdout.splitlines()
    containers = run(['docker', 'ps', '-a', '--filter', 'label=com.docker.compose.project=' + PROJECT, '--format', '{{.ID}}'], 'Deployment container inspection').stdout.strip()
    return VOLUME in volumes or bool(containers)


def validate_secrets():
    backend = read_env(ROOT / 'backend.env', template_keys('backend.env'))
    metadata(ROOT / 'postgres-password', secret=True)
    password = (ROOT / 'postgres-password').read_text(encoding='utf-8').removesuffix('\n')
    if not password or any(char in password for char in '\r\n\x00'):
        fail('postgres-password must contain one nonempty password line.')
    try:
        url = urlsplit(backend.get('DATABASE_URL', ''))
        encoded = url.password or ''
        correct = (url.scheme in ('postgres', 'postgresql') and
                   url.username == 'hams_prod' and url.hostname == 'postgres' and
                   url.port == 5432 and url.path == '/hams_prod' and not url.fragment and
                   url.query in ('', 'schema=public') and
                   not re.search(r'%(?![0-9A-Fa-f]{2})', encoded) and
                   unquote(encoded, errors='strict') == password)
    except (ValueError, UnicodeError):
        correct = False
    if not correct:
        fail('DATABASE_URL must match the production database and postgres-password. Restore the matching configuration; no password was rotated.')
    if len(backend.get('BETTER_AUTH_SECRET', '').strip()) < 32:
        fail('BETTER_AUTH_SECRET is missing or invalid. Existing files were retained.')
    if not re.fullmatch(r'[a-fA-F0-9]{64}', backend.get('TWO_FACTOR_ENCRYPTION_KEY', '')):
        fail('TWO_FACTOR_ENCRYPTION_KEY is missing or invalid. Restore the original key if data exists.')
    pool = backend.get('DATABASE_POOL_MAX', '')
    if not pool.isdigit() or not 1 <= int(pool) <= 1000:
        fail('DATABASE_POOL_MAX must be an integer from 1 to 1000.')
    return backend


def initialize():
    for name in FILES:
        metadata(ROOT / name, secret=True)
    metadata(ROOT / 'tls', directory=True)
    present = {name: (ROOT / name).exists() for name in FILES}
    if present['backend.env'] != present['postgres-password']:
        fail('Incomplete database/auth secret pair. Restore both matching files; automatic repair/rotation is disabled.')
    if deployment_data_exists() and not all(present.values()):
        fail('Deployment data/containers already exist but configuration is incomplete. Restore configuration from its backup; no new secrets were generated.')
    if present['backend.env']:
        validate_secrets()
    # Check all existing files before creating anything else.
    for name in ('compose.env', 'smtp.env'):
        if present[name]:
            read_env(ROOT / name, template_keys(name))
    if not present['backend.env']:
        password = secrets.token_hex(32)
        replacements = {
            'DATABASE_URL': 'postgresql://hams_prod:' + password + '@postgres:5432/hams_prod?schema=public',
            'BETTER_AUTH_SECRET': secrets.token_hex(48),
            'TWO_FACTOR_ENCRYPTION_KEY': secrets.token_hex(32),
        }
        backend = template('backend.env')
        for key, value in replacements.items():
            backend, count = re.subn(r'^' + key + r'=$', key + '=' + value, backend, flags=re.MULTILINE)
            if count != 1:
                fail('The reviewed backend template no longer has one empty ' + key + ' entry.')
        # A partial write is never silently repaired on a later run. The
        # application is not started here, so this cannot initialize a database.
        write_new(ROOT / 'postgres-password', password + '\n')
        write_new(ROOT / 'backend.env', backend)
        print('CREATED: matching database credentials and independent auth/2FA keys.')
    else:
        print('RETAINED: existing database credentials and auth/2FA keys.')
    for name in ('compose.env', 'smtp.env'):
        if not present[name]:
            content = template(name)
            if name == 'compose.env':
                content = content.replace('HAMS_CONFIG_DIR=/etc/hams', 'HAMS_CONFIG_DIR=' + str(ROOT))
            write_new(ROOT / name, content)
            print('CREATED: ' + name + ' template; fill the deployment values locally.')
    tls = ROOT / 'tls'
    if not tls.exists():
        tls.mkdir(mode=0o750)
        os.chown(tls, 0, 101)  # nginx user/group in the reviewed frontend image.
        os.chmod(tls, 0o750)


def inspect_configuration():
    pending = []
    missing = [name for name in FILES if not (ROOT / name).exists()]
    if missing:
        return ['Missing configuration files: ' + ', '.join(missing)]
    backend = validate_secrets()
    compose = read_env(ROOT / 'compose.env', template_keys('compose.env'))
    smtp = read_env(ROOT / 'smtp.env', template_keys('smtp.env'))
    if compose.get('HAMS_CONFIG_DIR') != str(ROOT):
        fail('HAMS_CONFIG_DIR must match the directory passed to prepare.sh.')
    release = compose.get('HAMS_RELEASE', '')
    if not re.fullmatch(r'[0-9a-fA-F]{7,40}', release):
        pending.append('Fill HAMS_RELEASE with the checked-out release commit.')
    try:
        address = ipaddress.IPv4Address(compose.get('HAMS_BIND_IP', ''))
        if address.is_unspecified or address.is_loopback or address.is_multicast or address.is_link_local:
            raise ValueError()
        interfaces = json.loads(run(['ip', '-j', '-4', 'address', 'show', 'scope', 'global'], 'Local IPv4 inspection').stdout)
        local = {entry['local'] for interface in interfaces
                 if not interface.get('ifname', '').startswith(('docker', 'br-', 'veth', 'lo'))
                 for entry in interface.get('addr_info', []) if entry.get('family') == 'inet'}
        if str(address) not in local:
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        pending.append('Set HAMS_BIND_IP to an assigned, non-Docker IPv4 address on this server.')
    for index in (1, 2):
        prefix = 'BOOTSTRAP_ADMIN_' + str(index) + '_'
        for field, limit in (('EMAIL', 100), ('USERNAME', 50), ('FIRSTNAME', 100), ('LASTNAME', 100)):
            value = backend.get(prefix + field, '').strip()
            if not value or len(value) > limit or (field == 'EMAIL' and not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value)):
                pending.append('Fill a valid ' + prefix + field + '.')
    for field in ('EMAIL', 'USERNAME'):
        first, second = (backend.get('BOOTSTRAP_ADMIN_' + str(i) + '_' + field, '').strip().lower() for i in (1, 2))
        if first and first == second:
            pending.append('The two ADMIN ' + field.lower() + ' values must differ.')
    for key in ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'):
        if not smtp.get(key, '').strip():
            pending.append('Fill ' + key + ' in smtp.env.')
    port = smtp.get('SMTP_PORT', '')
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        pending.append('SMTP_PORT must be a valid TCP port.')
    if smtp.get('SMTP_SECURE') not in ('true', 'false') or smtp.get('SMTP_REQUIRE_TLS') not in ('true', 'false'):
        pending.append('SMTP_SECURE and SMTP_REQUIRE_TLS must be true or false.')
    elif smtp['SMTP_SECURE'] != 'true' and smtp['SMTP_REQUIRE_TLS'] != 'true':
        pending.append('SMTP must use implicit TLS or require STARTTLS.')
    if port == '465' and smtp.get('SMTP_SECURE') != 'true':
        pending.append('Use SMTP_SECURE=true for implicit TLS on port 465.')
    if port in ('587', '2525') and (smtp.get('SMTP_SECURE') != 'false' or smtp.get('SMTP_REQUIRE_TLS') != 'true'):
        pending.append('Use SMTP_SECURE=false and SMTP_REQUIRE_TLS=true on port 587/2525.')
    inspect_tls(pending)
    if not pending:
        # Do not inherit shell overrides that could silently select other files,
        # release tags, or listening addresses instead of the reviewed env file.
        environment = os.environ.copy()
        for key in ('HAMS_RELEASE', 'HAMS_CONFIG_DIR', 'HAMS_BIND_IP', 'COMPOSE_FILE', 'COMPOSE_PROFILES', 'COMPOSE_PROJECT_NAME'):
            environment.pop(key, None)
        try:
            result = subprocess.run(['docker', 'compose', '--env-file', str(ROOT / 'compose.env'), '-f', str(SOURCE / 'compose.yaml'), '--profile', 'tools', 'config', '--quiet'], env=environment, capture_output=True, timeout=20)
        except (OSError, subprocess.TimeoutExpired):
            fail('Compose configuration validation could not complete.')
        if result.returncode:
            fail('Compose rejected the configuration. Inspect it locally without publishing secrets.')
    return pending


def inspect_tls(pending):
    directory = ROOT / 'tls'
    info = metadata(directory, directory=True)
    cert, key = directory / 'fullchain.pem', directory / 'privkey.pem'
    if info is None or not cert.exists() or not key.exists():
        pending.append('Install the real med.hss05.com fullchain.pem and privkey.pem in tls/; no certificate is generated.')
        return
    if info.st_gid != 101 or stat.S_IMODE(info.st_mode) != 0o750:
        pending.append('tls/ must be root:101 with mode 0750 for the frontend nginx user.')
    for file in (cert, key):
        details = metadata(file)
        mode = stat.S_IMODE(details.st_mode)
        if details.st_gid != 101 or mode not in ((0o640, 0o644) if file == cert else (0o640,)):
            pending.append(file.name + ' must be root:101; use 0640 (0644 also allowed for the public certificate).')
    cert_public = run(['openssl', 'x509', '-in', str(cert), '-pubkey', '-noout'], 'TLS certificate parsing')
    key_public = run(['openssl', 'pkey', '-in', str(key), '-pubout', '-passin', 'pass:'], 'Unencrypted TLS key parsing')
    if cert_public.stdout.strip() != key_public.stdout.strip():
        fail('TLS certificate and private key do not match.')
    checks = [
        (['openssl', 'x509', '-in', str(cert), '-noout', '-checkend', '604800'], 'TLS certificate must remain valid for at least seven days.'),
        (['openssl', 'verify', '-purpose', 'sslserver', '-verify_hostname', 'med.hss05.com', '-untrusted', str(cert), str(cert)], 'TLS chain/hostname must verify against the host trust store.'),
    ]
    for arguments, message in checks:
        if run(arguments, 'TLS validation', check=False).returncode:
            pending.append(message)


def main():
    if sys.version_info < (3, 10):
        fail('Python 3.10 or newer is required.')
    if not ROOT.is_absolute() or not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(ROOT)) or '..' in ROOT.parts:
        fail('Use an absolute Linux configuration path with letters, digits, /, ., _ or -.')
    if ROOT != Path(os.path.normpath(ROOT)) or ROOT == Path('/') or len(ROOT.parts) < 3:
        fail('Use a dedicated configuration directory, for example /etc/hams.')
    if ROOT == REPO or ROOT in REPO.parents or REPO in ROOT.parents:
        fail('Deployment credentials must be outside the source checkout.')
    for parent in (*reversed(ROOT.parents), ROOT):
        if parent.is_symlink():
            fail('The configuration path must not pass through symbolic links.')
    for tool in ('docker', 'openssl', 'ip'):
        if shutil.which(tool) is None:
            fail('Install the prerequisite first: ' + tool + '. This script installs nothing.')
    endpoint = (os.environ.get('DOCKER_HOST') if not os.environ.get('DOCKER_CONTEXT') else None)
    endpoint = endpoint or run(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], 'Docker context inspection').stdout.strip()
    if not endpoint.startswith('unix://'):
        fail('Use the local Linux Docker Engine, not a remote Docker context.')
    if run(['docker', 'info', '--format', '{{.OSType}}'], 'Docker Engine inspection').stdout.strip() != 'linux':
        fail('A running Linux Docker Engine is required.')
    version = run(['docker', 'compose', 'version', '--short'], 'Compose version inspection').stdout.strip()
    match = re.match(r'v?(\d+)\.(\d+)\.(\d+)', version)
    if not match or tuple(map(int, match.groups())) < (2, 30, 0):
        fail('Docker Compose 2.30 or newer is required.')
    for name in ('compose.env', 'backend.env', 'smtp.env'):
        template(name)
    info = metadata(ROOT, directory=True)
    if info is None and MODE == '--check':
        print('NOT_READY: configuration directory is missing. Run --init for a new installation.')
        return 2
    if info is None:
        # Inspect state before creating even an empty configuration directory.
        if deployment_data_exists():
            fail('Deployment data exists but its configuration directory is missing. Restore the original configuration.')
        ROOT.mkdir(mode=0o700, parents=False)
    elif stat.S_IMODE(info.st_mode) != 0o700:
        fail('The configuration directory must have mode 0700. Existing permissions were not changed.')
    with contextlib.ExitStack() as stack:
        lock = ROOT / '.prepare.lock'
        if MODE == '--init' or lock.exists():
            if lock.exists():
                metadata(lock, secret=True)
            flags = (os.O_RDWR | os.O_CREAT) if MODE == '--init' else os.O_RDONLY
            descriptor = os.open(lock, flags | os.O_NOFOLLOW, 0o600)
            stack.callback(os.close, descriptor)
            try:
                fcntl.flock(descriptor, (fcntl.LOCK_EX if MODE == '--init' else fcntl.LOCK_SH) | fcntl.LOCK_NB)
            except BlockingIOError:
                fail('Another preparation is running. Retry after it completes.')
        if MODE == '--init':
            initialize()
        pending = inspect_configuration()
        for message in pending:
            print('PENDING: ' + message)
        if pending:
            print('PREPARED_NOT_DEPLOY_READY: fill the settings/install the certificate, then run --check.')
            return 0 if MODE == '--init' else 2
        print('CONFIG_CHECKS_PASS: public origin ' + ORIGIN + '; existing secrets retained.')
        print('Next: separately verify port forwarding, browser certificate trust, SMTP delivery, migration and handover.')
        return 0


try:
    sys.exit(main())
except PreparationError as error:
    print('PREPARATION_STOPPED: ' + str(error), file=sys.stderr)
    sys.exit(1)
except (OSError, UnicodeError, ValueError):
    print('PREPARATION_STOPPED: filesystem or configuration error. Inspect paths/permissions locally; no credential values are printed.', file=sys.stderr)
    sys.exit(1)
PY
