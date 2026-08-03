# ZRH AI — Cloudflare brand cache purge (URL list)
# Requires env:
#   CLOUDFLARE_API_TOKEN  (Zone.Cache Purge permission)
#   CLOUDFLARE_ZONE_ID
# Usage:
#   $env:CLOUDFLARE_API_TOKEN='...'
#   $env:CLOUDFLARE_ZONE_ID='...'
#   powershell -File scripts/purge-cf-brand-cache.ps1

$ErrorActionPreference = 'Stop'
$token = $env:CLOUDFLARE_API_TOKEN
$zone = $env:CLOUDFLARE_ZONE_ID
if (-not $token -or -not $zone) {
  Write-Error 'Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID'
}

$base = 'https://ai.zrhtech.com'
$files = @(
  "$base/favicon.ico",
  "$base/favicon-16x16.png",
  "$base/favicon-32x32.png",
  "$base/manifest.json",
  "$base/sw.js",
  "$base/sw.js?v=1.2.1",
  "$base/sw.js?v=1.2.1-logo-official",
  "$base/apple-touch-icon.png",
  "$base/og-image.png",
  "$base/branding/zrh-logo-blue-white-master.png",
  "$base/branding/zrh-logo.png",
  "$base/branding/zrh-logo.svg",
  "$base/branding/zrh-logo-32.png",
  "$base/branding/zrh-logo-48.png",
  "$base/branding/zrh-logo-64.png",
  "$base/branding/zrh-logo-96.png",
  "$base/branding/zrh-logo-128.png",
  "$base/branding/zrh-logo-180.png",
  "$base/branding/zrh-logo-192.png",
  "$base/branding/zrh-logo-256.png",
  "$base/branding/zrh-logo-512.png",
  "$base/branding/zrh-logo-1024.png",
  "$base/branding/manifest-icon-192.png",
  "$base/branding/manifest-icon-512.png",
  "$base/branding/apple-touch-icon.png",
  "$base/branding/og-share-1200x630.png",
  "$base/branding/splash-1280x720.png",
  "$base/branding/splash-1080x1920.png",
  "$base/branding/splash-2048.png",
  "$base/brand/zrh-ai-icon-32.png",
  "$base/brand/zrh-ai-icon-48.png",
  "$base/brand/zrh-ai-icon-64.png",
  "$base/brand/zrh-ai-icon-96.png",
  "$base/brand/zrh-ai-icon-128.png",
  "$base/brand/zrh-ai-icon-180.png",
  "$base/brand/zrh-ai-icon-192.png",
  "$base/brand/zrh-ai-icon-256.png",
  "$base/brand/zrh-ai-icon-512.png",
  "$base/brand/zrh-ai-icon-1024.png",
  "$base/brand/zrh-ai-icon.svg",
  "$base/brand/pwa-192.png",
  "$base/brand/pwa-512.png",
  "$base/brand/apple-touch-icon.png",
  "$base/brand/og-share-1200x630.png",
  "$base/brand/splash-1280x720.png",
  "$base/brand/splash-1080x1920.png",
  "$base/brand/favicon-32.png"
)

# Cloudflare allows up to 30 URLs per request on many plans — batch
$url = "https://api.cloudflare.com/client/v4/zones/$zone/purge_cache"
$batchSize = 30
for ($i = 0; $i -lt $files.Count; $i += $batchSize) {
  $batch = $files[$i..([Math]::Min($i + $batchSize - 1, $files.Count - 1))]
  $body = @{ files = @($batch) } | ConvertTo-Json -Compress
  Write-Host "Purging batch $($i / $batchSize + 1) count=$($batch.Count)"
  $resp = curl.exe -sS -X POST $url `
    -H "Authorization: Bearer $token" `
    -H 'Content-Type: application/json' `
    --data-binary $body
  Write-Host $resp
  if ($resp -notmatch '"success"\s*:\s*true') {
    throw "Purge batch failed: $resp"
  }
}

Write-Host 'DONE purge-cf-brand-cache'
