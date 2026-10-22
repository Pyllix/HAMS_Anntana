#Requires -Version 7.2
<#
.SYNOPSIS
Prepare secrets and TLS for the local Docker deployment lab only.
.DESCRIPTION
Run from any directory: pwsh -File ./deploy/docker-local/prepare.ps1
Use -WhatIf for read-only prerequisite/configuration checks.

Writes only .runtime next to this script and the project-scoped tls volume.
Uses Linux containers; installs nothing on the host and imports no certificates.
Does not start the app, connect to a database, migrate, seed, or bootstrap users.
Existing secrets/certificates are validated and reused, never rotated implicitly.
After reviewing this file, run it before explicit build/migrate/seed/start commands.
#>
[CmdletBinding(SupportsShouldProcess)]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-LabDocker {
    param([Parameter(Mandatory)][string[]] $DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker operation '$($DockerArguments[0])' failed (exit $LASTEXITCODE)."
    }
}

function Read-LabDocker {
    param([Parameter(Mandatory)][string[]] $DockerArguments)
    $labOutput = Invoke-LabDocker -DockerArguments $DockerArguments
    return ($labOutput -join "`n")
}

Get-Command docker, git -ErrorAction Stop | Out-Null
$labProject = 'hams-deploy-lab'
$labRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$labRepo = [IO.Path]::GetFullPath((Join-Path $labRoot '../..'))
$labRuntime = Join-Path $labRoot '.runtime'
$labCompose = Join-Path $labRoot 'compose.yaml'
$labSetupImage = 'hams-backend-setup:docker-local'
$labHostUid = ''
$labHostGid = ''
if (-not $IsWindows) {
    $labHostUid = (& id -u | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine the host user ID.' }
    $labHostGid = (& id -g | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine the host group ID.' }
}

if ($labRuntime.Contains(',')) {
    throw 'The lab path cannot contain a comma because Docker uses --mount syntax.'
}
if ((Test-Path -LiteralPath $labRuntime) -and
    ((Get-Item -LiteralPath $labRuntime -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw '.runtime must be a real directory, not a symbolic link or junction.'
}
$labComposeVersion = (Read-LabDocker @('compose', 'version', '--short')).Trim().TrimStart('v')
if ([version]($labComposeVersion.Split('-')[0]) -lt [version]'2.30.0') {
    throw 'Docker Compose >= 2.30 is required for raw env_file support.'
}
if ((Read-LabDocker @('info', '--format', '{{.OSType}}')).Trim() -ne 'linux') {
    throw 'Switch Docker Desktop to Linux containers first.'
}

$labModel = (Read-LabDocker @(
    'compose', '--project-name', $labProject, '-f', $labCompose,
    '--profile', 'tools', 'config', '--no-env-resolution', '--format', 'json'
)) | ConvertFrom-Json
$labTlsVolume = $labModel.volumes.tls.name
$labDataVolume = $labModel.volumes.'postgres-data'.name
if ($labTlsVolume -ne "${labProject}_tls" -or
    $labDataVolume -ne "${labProject}_postgres-data") {
    throw 'Unexpected volume names. This script only prepares its own local lab.'
}
$labTrackedRuntime = & git -C $labRepo ls-files -- 'deploy/docker-local/.runtime/'
if ($LASTEXITCODE -ne 0 -or $labTrackedRuntime) {
    throw 'Cannot prepare secrets: Git must work and .runtime must contain no tracked files.'
}
$labVolumes = @((Read-LabDocker @('volume', 'ls', '--format', '{{.Name}}')) -split "`n")
$labDataExists = $labVolumes -contains $labDataVolume
$labTlsExists = $labVolumes -contains $labTlsVolume
if ($labTlsExists) {
    $labVolumeInfo = (Read-LabDocker @('volume', 'inspect', $labTlsVolume) | ConvertFrom-Json)[0]
    if ($null -eq $labVolumeInfo.Labels -or
        $labVolumeInfo.Labels.'com.docker.compose.project' -ne $labProject -or
        $labVolumeInfo.Labels.'com.docker.compose.volume' -ne 'tls') {
        throw 'The TLS volume already exists without matching lab ownership labels.'
    }
}

if (-not $PSCmdlet.ShouldProcess(
    "$labRuntime and Docker volume $labTlsVolume",
    'Prepare local-only secrets and TLS; retain existing credentials'
)) { return }

[IO.Directory]::CreateDirectory($labRuntime) | Out-Null
# Protect the generated directory before putting any secrets in it.
if ($IsWindows) {
    $labIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $labAcl = [Security.AccessControl.DirectorySecurity]::new()
    $labAcl.SetOwner($labIdentity)
    $labAcl.SetAccessRuleProtection($true, $false)
    foreach ($labSid in @($labIdentity, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $labRule = [Security.AccessControl.FileSystemAccessRule]::new(
            $labSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
        )
        $labAcl.AddAccessRule($labRule)
    }
    Set-Acl -LiteralPath $labRuntime -AclObject $labAcl
} else {
    & chmod 700 -- $labRuntime
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict .runtime permissions.' }
}

# Serialize preparation. Keep the lock file; closing the handle releases it.
$labLock = [IO.File]::Open(
    (Join-Path $labRuntime '.prepare.lock'), 'OpenOrCreate', 'ReadWrite', 'None'
)
try {
    # The ignore file is generated BEFORE secrets, including on a fresh checkout.
    $labIgnore = Join-Path $labRuntime '.gitignore'
    if (Test-Path -LiteralPath $labIgnore) {
        $labIgnoreItem = Get-Item -LiteralPath $labIgnore -Force
        if (($labIgnoreItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            [IO.File]::ReadAllText($labIgnore).Trim() -ne '*') {
            throw 'Unexpected .runtime/.gitignore; no secrets have been generated.'
        }
    } else {
        [IO.File]::WriteAllText($labIgnore, "*`n", [Text.UTF8Encoding]::new($false))
    }
    & git -C $labRepo check-ignore --quiet --no-index -- 'deploy/docker-local/.runtime/backend.env'
    if ($LASTEXITCODE -ne 0) { throw 'Git is not ignoring generated secrets.' }

    $labImages = @((Read-LabDocker @('image', 'ls', '--format', '{{.Repository}}:{{.Tag}}')) -split "`n")
    if ($labImages -notcontains $labSetupImage) {
        Invoke-LabDocker @(
            'build', '-f', (Join-Path $labRepo 'Dockerfile.backend'),
            '--target', 'setup', '-t', $labSetupImage, $labRepo
        )
    }
    if (-not $labTlsExists) {
        Invoke-LabDocker @(
            'volume', 'create', '--label', "com.docker.compose.project=$labProject",
            '--label', 'com.docker.compose.volume=tls', $labTlsVolume
        ) | Out-Null
    }

    # Secret generation and OpenSSL run inside Docker, not the host checkout.
    # The only writable host mount is this lab's restricted .runtime directory.
    $labPrepareSource = @'
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const envPath = '/lab/backend.env';
const passwordPath = '/lab/postgres-password';
const hex = bytes => crypto.randomBytes(bytes).toString('hex');
function regularFile(file) {
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) {
    throw new Error(`Expected a regular file: ${file}`);
  }
  // lstat also catches a dangling symbolic link which existsSync misses.
  try { if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Symbolic link refused: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function writeNew(file, content, mode) {
  regularFile(file);
  fs.writeFileSync(file, content, { flag: 'wx', mode });
  hostOwnership(file);
}
function hostOwnership(file) {
  // Linux bind mounts retain numeric ownership. Compose must be able to read
  // backend.env as the host user; Windows uses the directory ACL set above.
  if (process.env.HAMS_LAB_HOST_UID) {
    const uid = Number(process.env.HAMS_LAB_HOST_UID);
    const gid = Number(process.env.HAMS_LAB_HOST_GID);
    if (!Number.isSafeInteger(uid) || uid < 0 || !Number.isSafeInteger(gid) || gid < 0) {
      throw new Error('Invalid host file ownership settings.');
    }
    fs.chownSync(file, uid, gid);
  }
}
function openssl(args) {
  try { return execFileSync('openssl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error(`OpenSSL ${args[0]} failed. Existing secrets/certificates were retained.`); }
}

try {
  regularFile(envPath);
  regularFile(passwordPath);
  const haveEnv = fs.existsSync(envPath);
  const havePassword = fs.existsSync(passwordPath);
  if (haveEnv !== havePassword) throw new Error('Incomplete secret pair. Restore both files; do not rotate credentials for an existing database.');
  if (!haveEnv) {
    if (process.env.HAMS_LAB_DATA_EXISTS === 'true') throw new Error('Database volume exists but secrets are missing. Restore the matching secrets first.');
    const password = hex(32);
    const lines = [
      '# Local Docker deployment lab only. Do not use customer credentials here.',
      `DATABASE_URL=postgresql://hams_lab:${password}@postgres:5432/hams_lab?schema=public`,
      `BETTER_AUTH_SECRET=${hex(48)}`,
      `TWO_FACTOR_ENCRYPTION_KEY=${hex(32)}`,
    ];
    for (const i of [1, 2]) {
      lines.push(`BOOTSTRAP_ADMIN_${i}_EMAIL=admin${i}@hams.test`,
        `BOOTSTRAP_ADMIN_${i}_USERNAME=lab_admin_${i}`,
        `BOOTSTRAP_ADMIN_${i}_FIRSTNAME=Lab`,
        `BOOTSTRAP_ADMIN_${i}_LASTNAME=Admin${i}`);
    }
    writeNew(passwordPath, `${password}\n`, 0o600);
    writeNew(envPath, `${lines.join('\n')}\n`, 0o600);
    console.log('Generated lab secrets and two test ADMIN identities (accounts not created yet).');
  }
  const password = fs.readFileSync(passwordPath, 'utf8').trim();
  const values = Object.create(null);
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) throw new Error('Invalid raw backend.env entry.');
    const key = line.slice(0, separator);
    if (Object.hasOwn(values, key)) throw new Error('Duplicate backend.env key.');
    values[key] = line.slice(separator + 1);
  }
  if (!/^[a-f0-9]{64}$/.test(password) ||
      values.DATABASE_URL !== `postgresql://hams_lab:${password}@postgres:5432/hams_lab?schema=public` ||
      !/^[a-f0-9]{96}$/.test(values.BETTER_AUTH_SECRET || '') ||
      !/^[a-f0-9]{64}$/.test(values.TWO_FACTOR_ENCRYPTION_KEY || '')) {
    throw new Error('Existing lab secrets do not match the expected local database/configuration. No secrets were overwritten.');
  }

  const tlsFiles = ['ca.crt', 'fullchain.pem', 'privkey.pem'];
  tlsFiles.forEach(name => regularFile(`/tls/${name}`));
  const present = tlsFiles.filter(name => fs.existsSync(`/tls/${name}`)).length;
  if (present !== 0 && present !== tlsFiles.length) throw new Error('Incomplete TLS files. Restore the existing certificate set; automatic rotation is disabled.');
  if (present === 0) {
    const staging = fs.mkdtempSync('/tls/.prepare-');
    fs.chmodSync(staging, 0o700);
    try {
      const at = name => path.join(staging, name);
      openssl(['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '30',
        '-subj', '/CN=HAMS Local Deployment Test CA', '-keyout', at('ca.key'), '-out', at('ca.crt'),
        '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
      openssl(['req', '-new', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-subj', '/CN=localhost',
        '-keyout', at('privkey.pem'), '-out', at('server.csr')]);
      fs.writeFileSync(at('extensions.cnf'), [
        'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth', 'subjectAltName=DNS:localhost,DNS:smtp,IP:127.0.0.1', '',
      ].join('\n'));
      openssl(['x509', '-req', '-in', at('server.csr'), '-CA', at('ca.crt'), '-CAkey', at('ca.key'),
        '-set_serial', `0x${hex(16)}`, '-days', '30', '-sha256', '-extfile', at('extensions.cnf'), '-out', at('server.crt')]);
      fs.writeFileSync(at('fullchain.pem'), fs.readFileSync(at('server.crt'), 'utf8') + fs.readFileSync(at('ca.crt'), 'utf8'));
      for (const name of tlsFiles) fs.renameSync(at(name), `/tls/${name}`);
    } finally {
      // Only this newly-created staging folder is removed, including the CA key.
      fs.rmSync(staging, { recursive: true, force: true });
    }
    console.log('Generated 30-day local HTTPS/SMTP certificates. CA private key discarded.');
  }
  const ca = new crypto.X509Certificate(fs.readFileSync('/tls/ca.crt'));
  const server = new crypto.X509Certificate(fs.readFileSync('/tls/fullchain.pem'));
  if (!ca.ca || !ca.verify(ca.publicKey) || !server.verify(ca.publicKey) ||
      !server.checkHost('localhost') || !server.checkHost('smtp') || !server.checkIP('127.0.0.1') ||
      !server.checkPrivateKey(crypto.createPrivateKey(fs.readFileSync('/tls/privkey.pem')))) {
    throw new Error('Existing TLS chain, hostnames, or key do not match. No certificates were rotated.');
  }
  for (const name of ['ca.crt', 'fullchain.pem']) {
    openssl(['x509', '-in', `/tls/${name}`, '-checkend', '86400', '-noout']);
  }
  for (const hostname of ['localhost', 'smtp']) {
    openssl(['verify', '-CAfile', '/tls/ca.crt', '-purpose', 'sslserver', '-verify_hostname', hostname, '/tls/fullchain.pem']);
  }
  fs.chmodSync('/tls', 0o755);
  for (const name of tlsFiles) {
    fs.chownSync(`/tls/${name}`, 0, 101);
    fs.chmodSync(`/tls/${name}`, name === 'privkey.pem' ? 0o640 : 0o644);
  }
  regularFile('/lab/ca.crt');
  fs.writeFileSync('/lab/ca.crt', fs.readFileSync('/tls/ca.crt'), { mode: 0o644 });
  hostOwnership('/lab/ca.crt');
  console.log('PASS: retained matching secrets; verified CA, hostnames, expiry, key and TLS chain.');
} catch (error) {
  console.error(`Lab preparation stopped: ${error.message}`);
  process.exitCode = 1;
}
'@

    $labDockerArguments = @(
        'run', '--rm', '-i', '--init', '--network', 'none', '--user', '0:0',
        '--security-opt', 'no-new-privileges:true',
        '--mount', "type=bind,source=$labRuntime,target=/lab",
        '--mount', "type=volume,source=$labTlsVolume,target=/tls,volume-nocopy",
        '--env', "HAMS_LAB_DATA_EXISTS=$($labDataExists.ToString().ToLowerInvariant())",
        '--env', "HAMS_LAB_HOST_UID=$labHostUid",
        '--env', "HAMS_LAB_HOST_GID=$labHostGid",
        $labSetupImage, 'node', '-'
    )
    $labPrepareSource | & docker @labDockerArguments
    if ($LASTEXITCODE -ne 0) { throw 'Local preparation failed. No app was started.' }
    Invoke-LabDocker @(
        'compose', '--project-name', $labProject, '-f', $labCompose,
        '--profile', 'tools', 'config', '--quiet'
    )
    Write-Host 'Prepared: lab secrets, TLS volume, and .runtime/ca.crt (public certificate only).'
    Write-Host 'No certificate was imported into Windows and no database/app was started.'
    Write-Host 'Next: explicitly build images, migrate, seed reference data, bootstrap test ADMINs, and start the app.'
} finally {
    $labLock.Dispose()
}
