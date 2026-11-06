param(
  [ValidateSet('setup', 'start', 'stop', 'status')][string]$Action = 'start',
  [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin'
)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $backendRoot '.local-postgres'
$dataRoot = Join-Path $localRoot 'data'
$logPath = Join-Path $localRoot 'postgres.log'
$pgctl = Join-Path $PostgresBin 'pg_ctl.exe'
$psql = Join-Path $PostgresBin 'psql.exe'
if (-not (Test-Path -LiteralPath $pgctl)) { throw 'PostgreSQL não encontrado. Informe -PostgresBin com a pasta bin da instalação.' }
function Run-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Falha na execução de $(Split-Path -Leaf $Program)." }
}
function New-Password {
  $buffer = New-Object byte[] 32
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer); return [BitConverter]::ToString($buffer).Replace('-', '') } finally { $generator.Dispose() }
}
if ($Action -eq 'status') { Run-Checked $pgctl @('status', '-D', $dataRoot); exit }
if ($Action -eq 'stop') { Run-Checked $pgctl @('stop', '-D', $dataRoot, '-m', 'fast', '-w'); exit }
if ($Action -eq 'setup' -and -not (Test-Path -LiteralPath (Join-Path $dataRoot 'PG_VERSION'))) {
  New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
  $adminPassword = New-Password
  Set-Content -LiteralPath (Join-Path $localRoot 'admin-password') -Value $adminPassword -NoNewline
  Run-Checked (Join-Path $PostgresBin 'initdb.exe') @('-D', $dataRoot, '-U', 'finantrack_admin', '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C', '--pwfile', (Join-Path $localRoot 'admin-password'))
}
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot 'PG_VERSION'))) { throw 'Execute primeiro: npm run db:local:setup' }
& $pgctl status -D $dataRoot *> $null
if ($LASTEXITCODE -ne 0) { Run-Checked $pgctl @('start', '-D', $dataRoot, '-l', $logPath, '-o', '-h 127.0.0.1 -p 55432', '-w') }
if ($Action -eq 'setup') {
  $passwordPath = Join-Path $localRoot 'app-password'
  if (-not (Test-Path -LiteralPath $passwordPath)) { Set-Content -LiteralPath $passwordPath -Value (New-Password) -NoNewline }
  $appPassword = (Get-Content -LiteralPath $passwordPath -Raw).Trim()
  $previousPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = (Get-Content -LiteralPath (Join-Path $localRoot 'admin-password') -Raw).Trim()
    # As credenciais são transmitidas ao psql por stdin, nunca por argumentos ou logs.
    $roleExists = (& $psql -h 127.0.0.1 -p 55432 -U finantrack_admin -d postgres -At -c "SELECT 1 FROM pg_roles WHERE rolname = 'finantrack_app'")
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar a instância isolada.' }
    if ($roleExists -ne '1') { "CREATE ROLE finantrack_app LOGIN PASSWORD '$appPassword';" | & $psql -h 127.0.0.1 -p 55432 -U finantrack_admin -d postgres -v ON_ERROR_STOP=1; if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar o usuário local.' } }
    foreach ($databaseName in @('finantrack', 'finantrack_test', 'finantrack_shadow')) {
      $databaseExists = (& $psql -h 127.0.0.1 -p 55432 -U finantrack_admin -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '$databaseName'")
      if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar os bancos locais.' }
      if ($databaseExists -ne '1') { Run-Checked (Join-Path $PostgresBin 'createdb.exe') @('-h', '127.0.0.1', '-p', '55432', '-U', 'finantrack_admin', '-O', 'finantrack_app', $databaseName) }
    }
  } finally { $env:PGPASSWORD = $previousPassword }
  $envPath = Join-Path $backendRoot '.env'
  $envText = if (Test-Path -LiteralPath $envPath) { Get-Content -LiteralPath $envPath -Raw } else { "PORT=3001`nHOST=127.0.0.1`nFRONTEND_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`n" }
  foreach ($setting in @(@('DATABASE_URL', 'finantrack'), @('TEST_DATABASE_URL', 'finantrack_test'), @('SHADOW_DATABASE_URL', 'finantrack_shadow'))) {
    if ($envText -notmatch "(?m)^$($setting[0])=") { $envText += "`n$($setting[0])=postgresql://finantrack_app:${appPassword}@127.0.0.1:55432/$($setting[1])?schema=public`n" }
  }
  Set-Content -LiteralPath $envPath -Value $envText -NoNewline
}
Write-Host 'PostgreSQL isolado do FinanTrack disponível em 127.0.0.1:55432.'
