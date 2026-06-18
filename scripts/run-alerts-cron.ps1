# =====================================================================
#  scripts/run-alerts-cron.ps1
#  Llama al disparador de alertas. Pensado para el Programador de tareas
#  de Windows (cada ~15 min). Envía solo las alertas cuya hora ya llegó.
#
#  Uso manual:
#    powershell -ExecutionPolicy Bypass -File scripts\run-alerts-cron.ps1 -Key TU_SECRETO
#  Opcionales:
#    -BaseUrl http://localhost:3010   (donde corre la app)
#    -Force                            (envía TODAS, ignora la hora)
# =====================================================================
param(
    [Parameter(Mandatory = $true)][string]$Key,
    [string]$BaseUrl = "http://localhost:3010",
    [switch]$Force
)

$uri = "$BaseUrl/api/cron/run-alerts?key=$Key"
if ($Force) { $uri += "&force=1" }

$logDir = Join-Path $PSScriptRoot "..\logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir "alerts-cron.log"
$stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    $res = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 290
    $line = "[$stamp] ok due=$($res.due) sent=$($res.sent) failed=$($res.failed) projects=$($res.projects)"
} catch {
    $line = "[$stamp] ERROR: $($_.Exception.Message)"
}

Add-Content -Path $logFile -Value $line -Encoding utf8
Write-Output $line
