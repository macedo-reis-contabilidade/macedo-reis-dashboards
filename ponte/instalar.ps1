<#
.SYNOPSIS
  Instala (ou remove) a Ponte do Domínio neste PC.

.DESCRIPTION
  1. Copia esta pasta (ponte\) pra C:\ponte-dominio\app\ponte\. A tarefa roda essa cópia instalada — NUNCA a pasta
     do repositório, onde o Claude Code troca de branch. Pra atualizar a ponte, rode este script de novo.
  2. Cria C:\ponte-dominio\logs\ e C:\ponte-dominio\pendentes\.
  3. Se ainda não existe C:\ponte-dominio\config.ini, cria a partir do config.exemplo.ini (pra você preencher) e
     deixa o arquivo legível só pelo seu usuário (icacls).
  4. Registra a tarefa do Windows "Ponte Domínio": todo dia no horário de -Hora, "py -3 -m ponte rodar" com a pasta
     de trabalho C:\ponte-dominio\app. Roda sem ninguém logado e sem guardar a senha do Windows (S4U) e, se o PC
     estava desligado no horário, roda assim que puder. Quem tenta de novo quando o envio falha é a própria ponte,
     não o agendador.

  Rode num PowerShell aberto como administrador (registrar a tarefa pede).

.PARAMETER Hora
  O horário da rodada, HH:mm (padrão 07:00). O certo depende da hora em que a cópia da Domínio atualiza.

.PARAMETER Remover
  Tira a tarefa. Não apaga C:\ponte-dominio: a configuração, os logs e os pendentes ficam.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:30

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Remover
#>
param(
  [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')]
  [string]$Hora = '07:00',
  [switch]$Remover
)

$ErrorActionPreference = 'Stop'
$Base = 'C:\ponte-dominio'
$App = Join-Path $Base 'app'
$NomeTarefa = 'Ponte Domínio'
$Usuario = "$env:USERDOMAIN\$env:USERNAME"

$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$ehAdmin = ([Security.Principal.WindowsPrincipal]$identidade).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $ehAdmin) {
  throw 'Rode este script num PowerShell aberto como administrador (registrar a tarefa pede).'
}

if ($Remover) {
  if (Get-ScheduledTask -TaskName $NomeTarefa -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false
    Write-Host "Tarefa '$NomeTarefa' removida. A pasta $Base (configuração, logs e pendentes) ficou."
  } else {
    Write-Host "Não há tarefa '$NomeTarefa' pra remover."
  }
  return
}

# o instalador da cópia instalada apagaria a própria pasta antes de copiá-la (e a tarefa ficaria sem a ponte)
$origem = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$appCheio = [IO.Path]::GetFullPath($App).TrimEnd('\')
if ($origem -ieq $appCheio -or $origem.StartsWith($appCheio + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw "Rode o instalar.ps1 da pasta do repositório, não da cópia instalada em $App (ela seria apagada antes de ser copiada)."
}

$py = (Get-Command py.exe -ErrorAction SilentlyContinue).Source
if (-not $py) {
  throw 'Não achei o py.exe (o lançador do Python). Instale o Python 3.11 ou mais novo, com o lançador.'
}

# 1 e 2. as pastas — a de cima só pro usuário, o SISTEMA e os administradores: embaixo de C:\ ela herdaria
# "Usuários autenticados: Modificar", e qualquer conta do Windows poderia trocar o código que a tarefa roda (e, por
# ele, ler o config.ini) ou ler os pendentes, que têm nome e CNPJ dos clientes
New-Item -ItemType Directory -Force -Path $Base | Out-Null
& icacls $Base /inheritance:r /grant:r "${Usuario}:(OI)(CI)(M)" "*S-1-5-18:(OI)(CI)(F)" "*S-1-5-32-544:(OI)(CI)(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "O icacls não conseguiu deixar $Base só pro usuário $Usuario, o SISTEMA e os administradores." }
foreach ($p in @($App, (Join-Path $Base 'logs'), (Join-Path $Base 'pendentes'))) {
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

# 1. a ponte desta pasta, por cima da instalada
$destino = Join-Path $App 'ponte'
if (Test-Path $destino) { Remove-Item -Recurse -Force $destino }
Copy-Item -Recurse -Path $PSScriptRoot -Destination $destino
Get-ChildItem -Path $destino -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force

# 3. o config.ini: nasce do modelo se não existe; legível só por este usuário
$config = Join-Path $Base 'config.ini'
if (-not (Test-Path $config)) {
  Copy-Item (Join-Path $PSScriptRoot 'config.exemplo.ini') $config
  Write-Host "Criei $config a partir do modelo: preencha antes da primeira rodada."
}
& icacls $config /inheritance:r /grant:r "${Usuario}:(M)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "O icacls não conseguiu deixar $config só pro usuário $Usuario." }

# 4. a tarefa
$acao = New-ScheduledTaskAction -Execute $py -Argument '-3 -m ponte rodar' -WorkingDirectory $App
$gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
$quem = New-ScheduledTaskPrincipal -UserId $Usuario -LogonType S4U -RunLevel Limited
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $NomeTarefa -Action $acao -Trigger $gatilho -Principal $quem -Settings $ajustes `
  -Description 'Lê a cópia do Domínio, soma por empresa e por mês e manda só os totais pro sistema. Logs em C:\ponte-dominio\logs.' `
  -Force | Out-Null

Write-Host "Tarefa '$NomeTarefa' registrada: todo dia às $Hora, como $Usuario (sem guardar senha)."
Write-Host "Antes da primeira rodada: preencha $config e rode, em $App :"
Write-Host '  py -3 -m ponte conferir'
Write-Host '  py -3 -m ponte rodar --sem-enviar'
