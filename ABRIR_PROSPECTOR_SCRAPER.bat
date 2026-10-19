@echo off
setlocal
set "SELF=%~f0"
for /f %%I in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "TMP_PS1=%TEMP%\ABRIR_PROSPECTOR_%%I.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$lines = Get-Content -LiteralPath $env:SELF; $marker = [Array]::IndexOf($lines, '#<POWERSHELL>'); if ($marker -lt 0) { exit 1 }; [System.IO.File]::WriteAllLines($env:TMP_PS1, $lines[($marker + 1)..($lines.Length - 1)], (New-Object System.Text.UTF8Encoding($false)))"

if errorlevel 1 (
  echo No pude preparar el launcher.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TMP_PS1%" %*
del /q "%TMP_PS1%" >nul 2>&1
exit /b

#<POWERSHELL>
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'Prospector Scraper - Launcher'

# ==============================
# CONFIGURACION DEL PROYECTO
# ==============================
$ProjectRoot      = Split-Path -Parent $env:SELF
$ReactDir        = Join-Path $ProjectRoot 'web'
$PocketBaseDir   = ''
$EnvFile         = Join-Path $ReactDir '.env'
$CloudflaredExe  = ''
$DockerDesktop   = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'

$ReactPort       = 5173
$PocketBasePort  = 8091
$N8nPort         = 5678
$WahaPort        = 3001
$N8nContainer    = 'n8n'
$WahaContainer   = 'waha-test-waha-1'
$LocalConfig     = Join-Path $ProjectRoot 'launcher.local.ps1'
if (Test-Path -LiteralPath $LocalConfig) { . $LocalConfig }

# Archivos temporales, no se crean logs dentro del proyecto.
$RuntimeDir      = Join-Path $env:TEMP 'ProspectorScraperLauncher'
$ReactUrlFile    = Join-Path $RuntimeDir 'react_url.txt'
$PocketBaseUrlFile = Join-Path $RuntimeDir 'pb_url.txt'
$ReactPidFile    = Join-Path $RuntimeDir 'react_window_pid.txt'
$CfHelperFile    = Join-Path $RuntimeDir 'cloudflare_helper.ps1'
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Write-Title {
  Clear-Host
  Write-Host '========================================' -ForegroundColor Cyan
  Write-Host '        PROSPECTOR SCRAPER' -ForegroundColor Cyan
  Write-Host '========================================' -ForegroundColor Cyan
  Write-Host ''
}

function Test-Port([int]$Port) {
  try {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1)
  } catch {
    return $false
  }
}

function Test-LocalHttp([int]$Port, [string]$Path) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$Path" -Method Get -TimeoutSec 5 -UseBasicParsing
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Test-ReactService {
  try {
    $page = Invoke-WebRequest -Uri "http://127.0.0.1:$ReactPort/" -Method Get -TimeoutSec 5 -UseBasicParsing
    return ($page.StatusCode -eq 200 -and $page.Content -match '<title>bot-scraper-web</title>' -and (Test-LocalHttp $ReactPort '/@vite/client'))
  } catch {
    return $false
  }
}

function Wait-Port([int]$Port, [int]$Seconds = 40) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-Port $Port) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Test-DockerReady {
  docker info *> $null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-Docker {
  if (Test-DockerReady) {
    Write-Host '[OK] Docker Desktop ya esta listo.' -ForegroundColor Green
    return $true
  }

  Write-Host '[...] Docker Desktop no esta listo. Intentando abrirlo...' -ForegroundColor Yellow
  if (!(Test-Path $DockerDesktop)) {
    Write-Host "[ERROR] No encontre Docker Desktop en: $DockerDesktop" -ForegroundColor Red
    return $false
  }

  Start-Process $DockerDesktop | Out-Null
  Write-Host '[...] Esperando a que Docker responda...' -ForegroundColor Yellow
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-DockerReady) {
      Write-Host '[OK] Docker Desktop esta listo.' -ForegroundColor Green
      return $true
    }
    Start-Sleep -Seconds 2
  }

  Write-Host '[ERROR] Docker no respondio a tiempo.' -ForegroundColor Red
  return $false
}

function Get-ContainerState([string]$Name) {
  try {
    return (docker inspect -f '{{.State.Status}}' $Name 2>$null).Trim()
  } catch {
    return ''
  }
}

function Ensure-Container([string]$Name, [string]$Label) {
  $state = Get-ContainerState $Name
  if ($state -eq 'running') {
    Write-Host "[OK] $Label ya esta activo." -ForegroundColor Green
    return $true
  }

  if ([string]::IsNullOrWhiteSpace($state)) {
    Write-Host "[ERROR] No existe el contenedor '$Name' para $Label." -ForegroundColor Red
    return $false
  }

  Write-Host "[...] Iniciando $Label..." -ForegroundColor Yellow
  docker start $Name | Out-Null
  Start-Sleep -Seconds 2
  if ((Get-ContainerState $Name) -eq 'running') {
    Write-Host "[OK] $Label iniciado." -ForegroundColor Green
    return $true
  }

  Write-Host "[ERROR] No pude iniciar $Label." -ForegroundColor Red
  return $false
}

function Open-PowerShellWindow([string]$Title, [string]$Command) {
  $safeTitle = $Title.Replace("'", "''")
  $full = "`$Host.UI.RawUI.WindowTitle='$safeTitle'; `$ErrorActionPreference='Continue'; $Command"
  return Start-Process powershell.exe -PassThru -WindowStyle Hidden -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $full
}

function Ensure-PocketBase {
  if (Test-LocalHttp $PocketBasePort '/api/health') {
    Write-Host '[OK] PocketBase ya esta activo en 8091.' -ForegroundColor Green
    return $true
  }

  if (Test-Port $PocketBasePort) {
    Write-Host '[ERROR] El puerto 8091 responde, pero PocketBase no pasa /api/health.' -ForegroundColor Red
    return $false
  }

  $exe = Join-Path $PocketBaseDir 'pocketbase.exe'
  if (!(Test-Path $exe)) {
    Write-Host "[ERROR] No encontre PocketBase en: $exe" -ForegroundColor Red
    return $false
  }

  Write-Host '[...] Iniciando PocketBase en 8091...' -ForegroundColor Yellow
  Open-PowerShellWindow 'POCKETBASE - SCRAPER 8091' "Set-Location '$PocketBaseDir'; .\pocketbase.exe serve --http=127.0.0.1:8091" | Out-Null

  if ((Wait-Port $PocketBasePort 35) -and (Test-LocalHttp $PocketBasePort '/api/health')) {
    Write-Host '[OK] PocketBase listo.' -ForegroundColor Green
    return $true
  }

  Write-Host '[ERROR] PocketBase no abrio el puerto 8091.' -ForegroundColor Red
  return $false
}

function Stop-ReactProcess {
  $connections = Get-NetTCPConnection -State Listen -LocalPort $ReactPort -ErrorAction SilentlyContinue
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pidValue in $pids) {
    if ($pidValue -and $pidValue -ne $PID) {
      taskkill /PID $pidValue /T /F *> $null
    }
  }
  Start-Sleep -Seconds 2
}

function Start-React {
  if (!(Test-Path (Join-Path $ReactDir 'package.json'))) {
    Write-Host "[ERROR] No encontre package.json en: $ReactDir" -ForegroundColor Red
    return $false
  }

  if (Test-Port $ReactPort) {
    if (Test-ReactService) {
      Write-Host '[OK] React ya esta activo en 5173.' -ForegroundColor Green
      return $true
    }
    Write-Host '[ERROR] El puerto 5173 esta ocupado por un servicio que no responde como Vite.' -ForegroundColor Red
    return $false
  }

  Write-Host '[...] Iniciando React en 5173...' -ForegroundColor Yellow
  $proc = Open-PowerShellWindow 'REACT - SCRAPER 5173' "Set-Location '$ReactDir'; npm run dev -- --host 0.0.0.0 --port 5173"
  Set-Content -Path $ReactPidFile -Value $proc.Id -Encoding ASCII

  if ((Wait-Port $ReactPort 50) -and (Test-ReactService)) {
    Write-Host '[OK] React listo.' -ForegroundColor Green
    return $true
  }

  Write-Host '[ERROR] React no abrio el puerto 5173.' -ForegroundColor Red
  return $false
}

function Restart-React {
  Write-Host '[...] Reiniciando React para que Vite lea las URLs nuevas...' -ForegroundColor Yellow
  Stop-ReactProcess
  return Start-React
}

function New-CloudflareHelper {
  $helper = @'
param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][int]$Port,
  [Parameter(Mandatory=$true)][string]$CloudflaredExe,
  [Parameter(Mandatory=$true)][string]$UrlFile
)
$Host.UI.RawUI.WindowTitle = "CLOUDFLARE - $Name"
Clear-Host
Write-Host '========================================' -ForegroundColor Cyan
Write-Host " CLOUDFLARE $Name" -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host "Servicio local: http://localhost:$Port" -ForegroundColor Yellow
Write-Host ''
if (!(Test-Path $CloudflaredExe)) {
  Write-Host "No encontre cloudflared.exe en: $CloudflaredExe" -ForegroundColor Red
  exit 1
}
& $CloudflaredExe tunnel --url "http://localhost:$Port" 2>&1 | ForEach-Object {
  $line = $_.ToString()
  Write-Host $line
  $match = [regex]::Match($line, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if ($match.Success) {
    [System.IO.File]::WriteAllText($UrlFile, $match.Value, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ''
    Write-Host "URL PUBLICA: $($match.Value)" -ForegroundColor Green
    Write-Host ''
  }
}
'@
  [System.IO.File]::WriteAllText($CfHelperFile, $helper, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-ProcessCommandLines {
  try {
    return Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction Stop | Select-Object ProcessId, CommandLine
  } catch {
    return @()
  }
}

function Test-CloudflareForPort([int]$Port) {
  $needle1 = "localhost:$Port"
  $needle2 = "127.0.0.1:$Port"
  return [bool](Get-ProcessCommandLines | Where-Object { $_.CommandLine -like "*$needle1*" -or $_.CommandLine -like "*$needle2*" } | Select-Object -First 1)
}

function Read-TextFile([string]$Path) {
  if (Test-Path $Path) { return (Get-Content -LiteralPath $Path -Raw -ErrorAction SilentlyContinue).Trim() }
  return ''
}

function Test-PublicUrl([string]$Url, [int]$Port) {
  if ([string]::IsNullOrWhiteSpace($Url)) { return $false }
  try {
    $checkUrl = $Url.TrimEnd('/')
    if ($Port -eq $PocketBasePort) { $checkUrl += '/api/health' }
    $response = Invoke-WebRequest -Uri $checkUrl -Method Head -TimeoutSec 6 -MaximumRedirection 2 -UseBasicParsing
    return ($response.StatusCode -eq 200)
  } catch {
    return $false
  }
}

function Get-ActiveTunnelUrl([int]$Port, [string]$UrlFile) {
  $url = Read-TextFile $UrlFile
  if ((Test-CloudflareForPort $Port) -and $url -and (Test-PublicUrl $url $Port)) {
    return $url
  }
  return ''
}

function Ensure-Cloudflare([string]$Name, [int]$Port, [string]$UrlFile) {
  $saved = Read-TextFile $UrlFile
  $running = Get-ProcessCommandLines | Where-Object { $_.CommandLine -like "*localhost:$Port*" -or $_.CommandLine -like "*127.0.0.1:$Port*" }
  if ($running -and $saved -and (Test-PublicUrl $saved $Port)) {
    Write-Host "[OK] Cloudflared $Name ya esta activo: $saved" -ForegroundColor Green
    return $saved
  }

  foreach ($process in $running) { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue }

  if (!(Test-Path $CloudflaredExe)) {
    Write-Host "[ERROR] No encontre cloudflared en: $CloudflaredExe" -ForegroundColor Red
    return ''
  }

  Remove-Item $UrlFile -Force -ErrorAction SilentlyContinue
  New-CloudflareHelper
  Write-Host "[...] Iniciando Cloudflared para $Name..." -ForegroundColor Yellow
  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $CfHelperFile, '-Name', $Name, '-Port', $Port, '-CloudflaredExe', $CloudflaredExe, '-UrlFile', $UrlFile | Out-Null

  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    $saved = Read-TextFile $UrlFile
    if ($saved -and (Test-PublicUrl $saved $Port)) {
      Write-Host "[OK] Cloudflared $Name listo: $saved" -ForegroundColor Green
      return $saved
    }
  }

  Write-Host "[ERROR] No pude detectar la URL de Cloudflared para $Name." -ForegroundColor Red
  return ''
}

function Read-EnvValue([string]$Key) {
  if (!(Test-Path $EnvFile)) { return '' }
  foreach ($line in Get-Content -LiteralPath $EnvFile -ErrorAction SilentlyContinue) {
    if ($line -match "^$([regex]::Escape($Key))=(.*)$") { return $Matches[1].Trim() }
  }
  return ''
}

function Set-EnvValue([string]$Content, [string]$Key, [string]$Value) {
  $line = "$Key=$Value"
  if ($Content -match "(?m)^$([regex]::Escape($Key))=") {
    return ($Content -replace "(?m)^$([regex]::Escape($Key))=.*$", $line)
  }
  if ($Content.Length -gt 0 -and !$Content.EndsWith("`n")) { $Content += "`r`n" }
  return $Content + $line + "`r`n"
}

function Update-Env([string]$PocketBaseUrl) {
  if (!$PocketBaseUrl) {
    Write-Host '[ERROR] Faltan URLs. No modificare el .env.' -ForegroundColor Red
    return $false
  }

  if (!(Test-Path $EnvFile)) {
    Write-Host "[ERROR] No encontre el .env en: $EnvFile" -ForegroundColor Red
    return $false
  }

  $content = Get-Content -LiteralPath $EnvFile -Raw -ErrorAction SilentlyContinue
  $content = Set-EnvValue $content 'VITE_PB_URL' $PocketBaseUrl
  $content = Set-EnvValue $content 'VITE_N8N_SEND_WEBHOOK' '/webhook/enviar-lead-manual'
  $content = Set-EnvValue $content 'VITE_N8N_SCRAPER_WEBHOOK' '/webhook/iniciar-scraper'
  if ($content -eq (Get-Content -LiteralPath $EnvFile -Raw)) {
    Write-Host '[OK] web\.env ya contiene las URLs actuales.' -ForegroundColor Green
    return $false
  }
  [System.IO.File]::WriteAllText($EnvFile, $content, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host '[OK] web\.env actualizado en UTF-8 sin BOM.' -ForegroundColor Green
  return $true
}

function Show-Urls {
  Write-Title
  $reactUrl = Get-ActiveTunnelUrl $ReactPort $ReactUrlFile
  $pbUrl = Get-ActiveTunnelUrl $PocketBasePort $PocketBaseUrlFile

  Write-Host 'URLS PARA PROBAR DESDE EL CELULAR' -ForegroundColor Yellow
  Write-Host '========================================' -ForegroundColor Yellow
  Write-Host ''
  Write-Host 'React / Scraper:' -ForegroundColor Cyan
  if ($reactUrl) { Write-Host $reactUrl } else { Write-Host 'NO DISPONIBLE: inicia el proyecto con la opcion 1.' -ForegroundColor Red }
  Write-Host ''
  Write-Host 'PocketBase publico:' -ForegroundColor Cyan
  if ($pbUrl) { Write-Host $pbUrl } else { Write-Host 'NO DISPONIBLE: inicia el proyecto con la opcion 1.' -ForegroundColor Red }
  Write-Host ''
  Write-Host 'Webhooks de n8n: dentro de la URL de React, sin editor publico.' -ForegroundColor Cyan
  Write-Host ''
  Write-Host '========================================' -ForegroundColor DarkGray
  Write-Host 'React local:      http://localhost:5173'
  Write-Host 'PocketBase local: http://127.0.0.1:8091/_/'
  Write-Host 'n8n local:        http://localhost:5678'
  Write-Host "WAHA local:       http://localhost:$WahaPort"
  Write-Host ''
}

function Show-Status {
  Write-Title
  $docker = Test-DockerReady
  $n8nState = Get-ContainerState $N8nContainer
  $wahaState = Get-ContainerState $WahaContainer
  $reactUrl = Get-ActiveTunnelUrl $ReactPort $ReactUrlFile
  $pbUrl = Get-ActiveTunnelUrl $PocketBasePort $PocketBaseUrlFile

  function Status-Line([string]$Name, [bool]$Ok, [string]$Detail = '') {
    $text = if ($Ok) { 'ACTIVO' } else { 'APAGADO' }
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host ($Name.PadRight(24) + $text) -ForegroundColor $color
    if ($Detail) { Write-Host (' '.PadRight(24) + $Detail) -ForegroundColor DarkGray }
  }

  Status-Line 'Docker Desktop:' $docker
  Status-Line 'n8n:' (($n8nState -eq 'running') -and (Test-LocalHttp $N8nPort '/healthz')) $n8nState
  Status-Line 'WAHA:' (($wahaState -eq 'running') -and (Test-Port $WahaPort)) "$wahaState; API protegida"
  Status-Line 'PocketBase 8091:' (Test-LocalHttp $PocketBasePort '/api/health')
  Status-Line 'React 5173:' (Test-ReactService)
  Status-Line 'Cloudflare React:' ([bool]$reactUrl) $reactUrl
  Status-Line 'Cloudflare PB:' ([bool]$pbUrl) $pbUrl
  Write-Host ''
}

function Start-All {
  Write-Title
  Write-Host 'Levantando y verificando todos los servicios...' -ForegroundColor Yellow
  Write-Host ''

  if (!(Ensure-Docker)) { return }
  $n8nOk = Ensure-Container $N8nContainer 'n8n'
  if (!$n8nOk) { Write-Host '[ERROR] n8n no esta activo.' -ForegroundColor Red; return $false }
  $wahaOk = Ensure-Container $WahaContainer 'WAHA'
  if (!$wahaOk) { Write-Host '[ERROR] WAHA no esta activo.' -ForegroundColor Red; return $false }
  if (!(Test-LocalHttp $N8nPort '/healthz')) {
    Write-Host '[ERROR] n8n no responde en /healthz.' -ForegroundColor Red
    return $false
  }
  if (!(Test-Port $WahaPort)) {
    Write-Host '[ERROR] WAHA no tiene abierto el puerto 3001.' -ForegroundColor Red
    return $false
  }

  $pbOk = Ensure-PocketBase
  $reactOk = Start-React

  if (!$pbOk -or !$reactOk) {
    Write-Host '[ERROR] No continuare con los tuneles hasta que PocketBase y React esten activos.' -ForegroundColor Red
    return $false
  }

  $reactUrl = Ensure-Cloudflare 'REACT' $ReactPort $ReactUrlFile
  $pbUrl = Ensure-Cloudflare 'POCKETBASE' $PocketBasePort $PocketBaseUrlFile
  if (!$reactUrl -or !$pbUrl) {
    Write-Host '[ERROR] No se pudo verificar uno de los tuneles publicos.' -ForegroundColor Red
    return $false
  }

  $envChanged = Update-Env $pbUrl
  if ((Read-EnvValue 'VITE_PB_URL') -ne $pbUrl -or (Read-EnvValue 'VITE_N8N_SEND_WEBHOOK') -ne '/webhook/enviar-lead-manual' -or (Read-EnvValue 'VITE_N8N_SCRAPER_WEBHOOK') -ne '/webhook/iniciar-scraper') {
    Write-Host '[ERROR] web\.env no contiene las rutas publicas requeridas.' -ForegroundColor Red
    return $false
  }
  if ($envChanged) {
    if (!(Restart-React)) { return $false }
  }
  if (!(Test-ReactService) -or !(Test-PublicUrl $reactUrl $ReactPort) -or !(Test-PublicUrl $pbUrl $PocketBasePort)) {
    Write-Host '[ERROR] Los servicios o tuneles dejaron de responder durante el arranque.' -ForegroundColor Red
    return $false
  }

  Write-Host ''
  Write-Host '========================================' -ForegroundColor Green
  Write-Host 'PROYECTO LISTO' -ForegroundColor Green
  Write-Host '========================================' -ForegroundColor Green
  Write-Host ''
  Write-Host 'React local:' -ForegroundColor Cyan
  Write-Host 'http://localhost:5173'
  Write-Host ''
  Write-Host 'React celular:' -ForegroundColor Cyan
  Write-Host $reactUrl
  Write-Host ''
  Write-Host 'PocketBase local:' -ForegroundColor Cyan
  Write-Host 'http://127.0.0.1:8091/_/'
  Write-Host ''
  Write-Host 'PocketBase publico:' -ForegroundColor Cyan
  Write-Host $pbUrl
  Write-Host ''
  Write-Host 'n8n local:' -ForegroundColor Cyan
  Write-Host 'http://localhost:5678'
  Write-Host ''
  Write-Host 'Webhooks de n8n: dentro de la URL de React, sin editor publico.' -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'WAHA:' -ForegroundColor Cyan
  Write-Host "http://localhost:$WahaPort"
  Write-Host ''
  Write-Host 'Usa la URL de React celular para abrir la web desde el telefono.' -ForegroundColor Yellow
  Write-Host ''
  return $true
}

function Start-AllOnce {
  $mutex = New-Object System.Threading.Mutex($false, 'Local\ProspectorScraperLauncherStart')
  $acquired = $false
  try {
    try { $acquired = $mutex.WaitOne(120000) }
    catch [System.Threading.AbandonedMutexException] { $acquired = $true }
    if (!$acquired) {
      Write-Host '[ERROR] Otro arranque sigue en curso; vuelve a intentarlo.' -ForegroundColor Red
      return $false
    }
    return Start-All
  } finally {
    if ($acquired) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
  }
}

if ($args.Count -gt 0) {
  switch ($args[0]) {
    '--status' { Show-Status; exit 0 }
    '--urls' { Show-Urls; exit 0 }
    '--start' { if (Start-AllOnce) { exit 0 } else { exit 1 } }
    default { Write-Host 'Uso: --status, --urls o --start'; exit 2 }
  }
}

while ($true) {
  Write-Title
  Write-Host '1. Levantar proyecto'
  Write-Host '2. Ver estado'
  Write-Host '3. Ver URLs para celular'
  Write-Host ''
  $option = Read-Host 'Elige una opcion'

  switch ($option) {
    '1' { Start-AllOnce | Out-Null; Pause }
    '2' { Show-Status; Pause }
    '3' { Show-Urls; Pause }
    default {
      Write-Host 'Opcion no valida.' -ForegroundColor Red
      Start-Sleep -Seconds 1
    }
  }
}
