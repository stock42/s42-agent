# Install S42 Agent on Windows. No administrator rights or Bun installation needed.
[CmdletBinding()]
param(
    [string]$Version = "0.1.0",
    [string]$InstallDir = "",
    [string]$FromDirectory = "",
    [switch]$NoModifyPath
)

$ErrorActionPreference = "Stop"
$tempDirectory = $null
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw "Use install.sh on Linux or macOS. This installer is for Windows."
    }
    $Version = $Version -replace '^v', ''
    if ($Version -notmatch '^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$') {
        throw "Invalid release version: $Version"
    }
    $architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
    if ($architecture -notin @("x64", "arm64")) {
        throw "Unsupported Windows architecture: $architecture"
    }
    if (-not $InstallDir) {
        $InstallDir = Join-Path $env:LOCALAPPDATA "S42Agent\bin"
    }
    $asset = "s42-agent-$Version-windows-$architecture.exe"
    $releaseBase = "https://github.com/stock42/s42-agent/releases/download/v$Version"
    if ($env:S42_AGENT_RELEASE_BASE) { $releaseBase = $env:S42_AGENT_RELEASE_BASE }
    $tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("s42-install-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDirectory | Out-Null
    $checksumFile = Join-Path $tempDirectory "SHASUMS256.txt"
    $downloadedBinary = Join-Path $tempDirectory $asset
    if ($FromDirectory) {
        Copy-Item -LiteralPath (Join-Path $FromDirectory "SHASUMS256.txt") -Destination $checksumFile
        Copy-Item -LiteralPath (Join-Path $FromDirectory $asset) -Destination $downloadedBinary
    } else {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Write-Host "Downloading S42 Agent $Version (windows/$architecture)..."
        Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/SHASUMS256.txt" -OutFile $checksumFile
        Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$asset" -OutFile $downloadedBinary
    }
    $pattern = '^([a-fA-F0-9]{64})\s+\*?' + [regex]::Escape($asset) + '$'
    $checksum = Get-Content -LiteralPath $checksumFile | Select-String -Pattern $pattern | Select-Object -First 1
    if (-not $checksum) { throw "Missing or invalid checksum for $asset" }
    $expected = $checksum.Matches[0].Groups[1].Value
    $actual = (Get-FileHash -LiteralPath $downloadedBinary -Algorithm SHA256).Hash
    if ($actual -ne $expected) { throw "SHA-256 mismatch: $asset" }
    $installedVersion = & $downloadedBinary --version
    if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $Version) {
        throw "The binary could not run or reported an unexpected version: $installedVersion"
    }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $destination = Join-Path $InstallDir "s42-agent.exe"
    $stagedBinary = Join-Path $InstallDir (".s42-agent-new-" + [guid]::NewGuid().ToString("N") + ".exe")
    Copy-Item -LiteralPath $downloadedBinary -Destination $stagedBinary
    Move-Item -LiteralPath $stagedBinary -Destination $destination -Force
    if (-not $NoModifyPath) {
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if (($userPath -split ';') -notcontains $InstallDir) {
            $newPath = (@($userPath, $InstallDir) | Where-Object { $_ }) -join ';'
            [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        }
        if (($env:Path -split ';') -notcontains $InstallDir) { $env:Path += ";$InstallDir" }
        Write-Host "Run: s42-agent (restart other terminals to refresh PATH)"
    } else {
        Write-Host "Run: $destination"
    }
    Write-Host "Installed S42 Agent $Version at $destination"
} catch {
    Write-Error "Installation failed: $($_.Exception.Message). Use -FromDirectory .\dist for local release files."
    exit 1
} finally {
    if ($tempDirectory -and (Test-Path -LiteralPath $tempDirectory)) {
        Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
}
