#Requires -Version 5.1
<#
.SYNOPSIS
  ZRHLBR Hybrid — Laptop Ollama control (management only; NOT for inference).

.PARAMETER Action
  status | stop | start | restart | tags | models | gpu | ping11434
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('status', 'stop', 'start', 'restart', 'tags', 'models', 'gpu', 'ping11434')]
  [string]$Action
)

$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:11434'

function Get-OllamaProcess {
  Get-Process -Name 'ollama*' -ErrorAction SilentlyContinue
}

function Test-Port11434 {
  try {
    $r = Invoke-WebRequest -Uri "$base/api/tags" -UseBasicParsing -TimeoutSec 3
    return @{ ok = ($r.StatusCode -eq 200); code = $r.StatusCode }
  } catch {
    return @{ ok = $false; error = $_.Exception.Message }
  }
}

switch ($Action) {
  'ping11434' {
    $p = Test-Port11434
    $p | ConvertTo-Json -Compress
  }
  'status' {
    $svc = Get-Service -Name 'Ollama' -ErrorAction SilentlyContinue
    $procs = @(Get-OllamaProcess | Select-Object Name, Id, CPU)
    $port = Test-Port11434
    [PSCustomObject]@{
      service = if ($svc) { @{ Name = $svc.Name; Status = "$($svc.Status)"; StartType = "$($svc.StartType)" } } else { $null }
      processes = $procs
      port11434 = $port
      localhostOk = [bool]$port.ok
    } | ConvertTo-Json -Depth 5
  }
  'stop' {
    # Prefer service stop; fallback to process
    $svc = Get-Service -Name 'Ollama' -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') {
      Stop-Service -Name 'Ollama' -Force -ErrorAction SilentlyContinue
    }
    Get-OllamaProcess | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $port = Test-Port11434
    [PSCustomObject]@{ action = 'stop'; port11434 = $port } | ConvertTo-Json -Compress
  }
  'start' {
    $svc = Get-Service -Name 'Ollama' -ErrorAction SilentlyContinue
    if ($svc) {
      Start-Service -Name 'Ollama' -ErrorAction SilentlyContinue
    } else {
      $exe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
      if (Test-Path $exe) { Start-Process -FilePath $exe -WindowStyle Hidden }
    }
    # wait up to 30s
    $ok = $false
    for ($i = 0; $i -lt 15; $i++) {
      Start-Sleep -Seconds 2
      $port = Test-Port11434
      if ($port.ok) { $ok = $true; break }
    }
    [PSCustomObject]@{ action = 'start'; ready = $ok; port11434 = (Test-Port11434) } | ConvertTo-Json -Compress
  }
  'restart' {
    & $PSCommandPath -Action stop | Out-Null
    & $PSCommandPath -Action start
  }
  'tags' {
    (Invoke-WebRequest -Uri "$base/api/tags" -UseBasicParsing -TimeoutSec 10).Content
  }
  'models' {
    $j = (Invoke-WebRequest -Uri "$base/api/tags" -UseBasicParsing -TimeoutSec 10).Content | ConvertFrom-Json
    $names = @($j.models | ForEach-Object { $_.name })
    [PSCustomObject]@{
      hasCoder = ($names -contains 'qwen2.5-coder:7b')
      hasChat = ($names -contains 'qwen3:8b')
      names = $names
    } | ConvertTo-Json -Depth 4
  }
  'gpu' {
    $ps = & ollama ps 2>&1 | Out-String
    $smi = & nvidia-smi --query-gpu=name,utilization.gpu,memory.used --format=csv 2>&1 | Out-String
    [PSCustomObject]@{ ollamaPs = $ps.Trim(); nvidiaSmi = $smi.Trim() } | ConvertTo-Json
  }
}
