#!/usr/bin/env pwsh
# =============================================================================
# Tauri WebDriver Launcher Script
#
# Launches the built Tauri application with tauri-plugin-webdriver enabled.
# The plugin serves a W3C WebDriver HTTP server on port 9222.
#
# Usage:
#   pwsh -ExecutionPolicy Bypass -File launch-tauri.ps1
#
# Output:
#   On success: writes the WebDriver HTTP URL to a file and outputs "READY".
#   Then keeps running until killed.
# =============================================================================

$ErrorActionPreference = "Stop"
$appProcess = $null
$port = 9222
$startTimeout = 30000  # 30 seconds

# Find the Tauri executable
$exePath = Join-Path $PSScriptRoot "..\..\src-tauri\target\release\pm-app.exe"
if (-not (Test-Path $exePath)) {
    $exePath = Join-Path $PSScriptRoot "..\..\src-tauri\target\release\pm_app.exe"
}

if (-not (Test-Path $exePath)) {
    Write-Error "Tauri executable not found at: $exePath"
    Write-Error "Please run 'pnpm tauri build' first."
    exit 1
}

Write-Host "[tauri-launcher] Executable: $exePath" -ForegroundColor Cyan

try {
    # Launch the Tauri app with WebDriver port via environment variable
    # Note: --webdriver-port flag is NOT used; the port is set via TAURI_WEBDRIVER_PORT env var
    $env:TAURI_WEBDRIVER_PORT = $port
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $exePath
    $startInfo.Arguments = "--disable-gpu --no-sandbox"
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.CreateNoWindow = $false
    $startInfo.WorkingDirectory = Split-Path $exePath
    $startInfo.EnvironmentVariables["TAURI_WEBDRIVER_PORT"] = $port.ToString()
    $startInfo.EnvironmentVariables["TAURI_DEV_TOOLS"] = "true"

    $appProcess = [System.Diagnostics.Process]::Start($startInfo)

    $stdoutTask = $appProcess.StandardOutput.ReadLineAsync()
    $stderrTask = $appProcess.StandardError.ReadLineAsync()

    $startTime = Get-Date
    $ready = $false

    Write-Host "[tauri-launcher] Waiting for WebDriver server on port ${port} (timeout: ${startTimeout}ms)..." -ForegroundColor Cyan

    $ready = $false
    $startTime = Get-Date

    while (-not $appProcess.HasExited) {
        $elapsed = ((Get-Date) - $startTime).TotalMilliseconds
        if ($elapsed -gt $startTimeout) {
            throw "Timeout waiting for Tauri app to start"
        }

        # Check stdout
        if ($stdoutTask.Wait(100) -and $stdoutTask.Result) {
            $line = $stdoutTask.Result
            Write-Host "[tauri-stdout] $line"
        }

        # Check stderr
        if ($stderrTask.Wait(100) -and $stderrTask.Result) {
            $line = $stderrTask.Result
            if ($line -and $line.Trim()) {
                Write-Host "[tauri-stderr] $line" -ForegroundColor Yellow
            }
        }

        # Poll the WebDriver HTTP status endpoint
        try {
            $statusResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$port/status" -TimeoutSec 1 -UseBasicParsing 2>$null
            if ($statusResponse.StatusCode -eq 200) {
                $status = $statusResponse.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($status.value.ready -eq $true) {
                    Write-Host "[tauri-launcher] WebDriver server ready on port $port" -ForegroundColor Green
                    $ready = $true
                    break
                }
            }
        } catch {
            # Server not ready yet
        }

        Start-Sleep -Milliseconds 200
    }

    # Check stderr for any remaining output
    while (-not $appProcess.StandardError.EndOfStream) {
        try {
            $line = $appProcess.StandardError.ReadLine()
            if ($line -and $line.Trim()) {
                Write-Host "[tauri-stderr] $line" -ForegroundColor Yellow
            }
        } catch {
            break
        }
    }

    if ($appProcess.HasExited) {
        Write-Error "Tauri app exited unexpectedly with code: $($appProcess.ExitCode)"
        exit 1
    }

    # Write WebDriver URL to a file for reference
    $webDriverUrl = "http://127.0.0.1:$port"
    $webDriverFile = Join-Path $PSScriptRoot "..\.webdriver-url"
    $webDriverUrl | Out-File -FilePath $webDriverFile -Encoding UTF8
    Write-Host "[tauri-launcher] WebDriver URL saved to: $webDriverFile" -ForegroundColor Green

    # Output for Playwright
    Write-Host "TAURI_WEBDRIVER_URL=$webDriverUrl"
    Write-Host "READY"

    # Wait for the app process to exit (blocks until killed)
    $appProcess.WaitForExit()

} finally {
    if ($appProcess -and -not $appProcess.HasExited) {
        Write-Host "[tauri-launcher] Shutting down Tauri app..."
        try {
            $appProcess.Kill()
        } catch {
            # Ignore
        }
    }
}
