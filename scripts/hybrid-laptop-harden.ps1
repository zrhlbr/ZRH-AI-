#Requires -RunAsAdministrator
<#
.SYNOPSIS
  ZRHLBR Hybrid Inference — Laptop GPU node hardening (run as Administrator).

.DESCRIPTION
  1) Restrict TCP 11434 inbound to ZRH Server Tailscale IP only
  2) Disable broad ollama.exe Any inbound rules
  3) Install/enable OpenSSH Server for Termius over Tailscale
#>
param(
  [string]$ServerTailscaleIp = '100.83.172.96',
  [string]$LaptopTailscaleIp = '100.105.217.7'
)

$ErrorActionPreference = 'Stop'
Write-Host "SERVER_TAILSCALE_IP=$ServerTailscaleIp"
Write-Host "LAPTOP_TAILSCALE_IP=$LaptopTailscaleIp"

Get-NetFirewallRule -DisplayName 'ollama.exe' -ErrorAction SilentlyContinue | ForEach-Object {
  Disable-NetFirewallRule -Name $_.Name
  Write-Host "Disabled $($_.DisplayName)"
}

Disable-NetFirewallRule -DisplayName 'ZRH-Ollama-LAN-11434' -ErrorAction SilentlyContinue

$ruleName = 'ZRH-Ollama-Tailscale-11434'
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
  Set-NetFirewallRule -DisplayName $ruleName -Enabled True -Action Allow -Direction Inbound
  Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallAddressFilter |
    Set-NetFirewallAddressFilter -RemoteAddress $ServerTailscaleIp
  Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallPortFilter |
    Set-NetFirewallPortFilter -Protocol TCP -LocalPort 11434
  Write-Host "Updated $ruleName"
} else {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort 11434 -RemoteAddress $ServerTailscaleIp -Profile Any | Out-Null
  Write-Host "Created $ruleName"
}

# OpenSSH Server
$cap = Get-WindowsCapability -Online | Where-Object Name -eq 'OpenSSH.Server~~~~0.0.1.0'
if ($cap.State -ne 'Installed') {
  Write-Host 'Installing OpenSSH.Server...'
  Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
}
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
Write-Host "sshd status: $((Get-Service sshd).Status)"

Write-Host ''
Write-Host 'Verify from ZRH Server:'
Write-Host "  curl http://${LaptopTailscaleIp}:11434/api/tags"
Write-Host "  ssh <windows-user>@${LaptopTailscaleIp}"
Write-Host 'Done.'
