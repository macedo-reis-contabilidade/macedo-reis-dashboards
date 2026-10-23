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

  Com -Receita, a ponte da Receita (Integra Contador do Serpro) em vez da do Domínio: os passos 1 a 3 iguais; se a
  seção [integra] do config.ini ainda não tem as chaves, a senha e o certificado, pergunta aqui mesmo (as chaves e a
  senha sem aparecer na tela, o caminho do .pfx em texto) e grava direto no config.ini — nada passa por chat, tela ou
  log; e registra a tarefa "Ponte Receita": de segunda a sexta às 08:30, "py -3 -m ponte receita rodar".

  Rode num PowerShell aberto como administrador (registrar a tarefa pede).

.PARAMETER Hora
  O horário da rodada, HH:mm (padrão 07:00; com -Receita, 08:30). O do Domínio depende da hora em que a cópia da
  Domínio atualiza.

.PARAMETER Remover
  Tira a tarefa (com -Receita, só a "Ponte Receita"). Não apaga C:\ponte-dominio: a configuração, os logs e os
  pendentes ficam.

.PARAMETER Receita
  A ponte da Receita (o LEIA-ME explica): pergunta o que falta na [integra] e registra a tarefa "Ponte Receita".

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:30

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Remover

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Receita

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Remover -Receita
#>
param(
  [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')]
  [string]$Hora = '07:00',
  [switch]$Remover,
  [switch]$Receita
)

$ErrorActionPreference = 'Stop'
$Base = 'C:\ponte-dominio'
$App = Join-Path $Base 'app'
$NomeTarefa = if ($Receita) { 'Ponte Receita' } else { 'Ponte Domínio' }
if ($Receita -and -not $PSBoundParameters.ContainsKey('Hora')) { $Hora = '08:30' }
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

if ($Receita) {
  # 3b. a [integra]: o que falta (ou ainda é o do exemplo) é perguntado aqui e gravado direto no config.ini. As chaves
  # e a senha vêm com -AsSecureString (não aparecem na tela) e só viram texto na hora de gravar; nada vai pra log.
  function Ler-Ini([string[]]$linhas, [string]$secao, [string]$campo) {
    $dentro = $false
    foreach ($l in $linhas) {
      if ($l -match '^\s*\[(.+?)\]\s*$') { $dentro = ($Matches[1].Trim() -ieq $secao); continue }
      if ($dentro -and $l -match '^\s*([^=;#\s][^=]*?)\s*=\s*(.*)$' -and $Matches[1] -ieq $campo) { return $Matches[2].Trim() }
    }
    return ''
  }
  function Por-Ini([System.Collections.Generic.List[string]]$linhas, [string]$secao, [string]$campo, [string]$valor) {
    $inicio = -1
    for ($i = 0; $i -lt $linhas.Count; $i++) {
      if ($linhas[$i] -match '^\s*\[(.+?)\]\s*$') {
        if ($inicio -ge 0) { break }
        if ($Matches[1].Trim() -ieq $secao) { $inicio = $i }
        continue
      }
      if ($inicio -ge 0 -and $linhas[$i] -match '^\s*([^=;#\s][^=]*?)\s*=' -and $Matches[1] -ieq $campo) {
        $linhas[$i] = "$campo = $valor"
        return
      }
    }
    if ($inicio -lt 0) {
      $linhas.Add('')
      $linhas.Add("[$secao]")
      $linhas.Add("$campo = $valor")
      return
    }
    $linhas.Insert($inicio + 1, "$campo = $valor")
  }
  function Texto-Do-Seguro([Security.SecureString]$s) {
    $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
  }

  $exemplo = @(Get-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'config.exemplo.ini'))
  $linhas = New-Object 'System.Collections.Generic.List[string]'
  foreach ($l in @(Get-Content -Encoding UTF8 $config)) { $linhas.Add([string]$l) }
  $perguntas = @(
    @{ campo = 'consumer_key'; texto = 'A consumer_key do Integra Contador (Área do Cliente do Serpro)'; seguro = $true },
    @{ campo = 'consumer_secret'; texto = 'A consumer_secret do Integra Contador'; seguro = $true },
    @{ campo = 'certificado'; texto = 'O caminho do certificado A1 do escritório (.pfx)'; seguro = $false },
    @{ campo = 'senha_certificado'; texto = 'A senha do certificado'; seguro = $true },
    @{ campo = 'cnpj_escritorio'; texto = 'O CNPJ do escritório (só números)'; seguro = $false }
  )
  $mudou = $false
  foreach ($q in $perguntas) {
    $atual = Ler-Ini $linhas.ToArray() 'integra' $q.campo
    if ($atual -and $atual -ne (Ler-Ini $exemplo 'integra' $q.campo)) { continue }
    do {
      if ($q.seguro) {
        $valor = (Texto-Do-Seguro (Read-Host -AsSecureString $q.texto)).Trim()
      } else {
        $valor = (Read-Host $q.texto).Trim().Trim('"')
      }
      $problema = $null
      if (-not $valor) { $problema = 'em branco' }
      elseif ($valor -match '[\r\n]') { $problema = 'tem quebra de linha' }
      elseif ($q.campo -eq 'certificado' -and -not (Test-Path -LiteralPath $valor -PathType Leaf)) { $problema = 'o arquivo não está nesse caminho' }
      elseif ($q.campo -eq 'cnpj_escritorio' -and ($valor -replace '[./\s-]', '') -notmatch '^[0-9A-Za-z]{12}[0-9]{2}$') { $problema = 'não tem os 14 caracteres do CNPJ' }
      if ($problema) { Write-Host "  não serve ($problema) — de novo:" }
    } while ($problema)
    if ($q.campo -eq 'cnpj_escritorio') { $valor = ($valor -replace '[./\s-]', '').ToUpper() }
    if ($q.campo -eq 'certificado') {
      $valor = [IO.Path]::GetFullPath($valor)
      if (-not $valor.StartsWith($Base + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "  Aviso: guarde o .pfx dentro de $Base (só você, o SISTEMA e os administradores leem essa pasta)."
      }
    }
    Por-Ini $linhas 'integra' $q.campo $valor
    $valor = $null
    $mudou = $true
  }
  if ($mudou) {
    [IO.File]::WriteAllLines($config, $linhas.ToArray(), (New-Object Text.UTF8Encoding $false))
    Write-Host "A [integra] de $config foi preenchida (os valores não aparecem aqui)."
  } else {
    Write-Host "A [integra] de $config já tinha as chaves, o certificado e o CNPJ: não perguntei nada."
  }
  $linhas = $null
  $ambiente = Ler-Ini @(Get-Content -Encoding UTF8 $config) 'integra' 'ambiente'
  # o Python escreve no stderr quando falta a biblioteca: no PowerShell 5.1, com 'Stop', isso derrubaria o script
  $ErrorActionPreference = 'Continue'
  & $py -3 -c 'import cryptography, pypdf' 2>$null | Out-Null
  $faltaBiblioteca = $LASTEXITCODE -ne 0
  $ErrorActionPreference = 'Stop'
  if ($faltaBiblioteca) {
    Write-Host 'Aviso: falta o cryptography ou o pypdf. Instale com: py -3 -m pip install cryptography pypdf'
  }
}

# 4. a tarefa
if ($Receita) {
  $acao = New-ScheduledTaskAction -Execute $py -Argument '-3 -m ponte receita rodar' -WorkingDirectory $App
  $gatilho = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $Hora
  $limite = New-TimeSpan -Hours 4
  $descricao = 'Consulta a Receita pelo Integra Contador do Serpro (só consulta) e manda pro sistema só os campos do contrato. Logs em C:\ponte-dominio\logs.'
} else {
  $acao = New-ScheduledTaskAction -Execute $py -Argument '-3 -m ponte rodar' -WorkingDirectory $App
  $gatilho = New-ScheduledTaskTrigger -Daily -At $Hora
  $limite = New-TimeSpan -Hours 2
  $descricao = 'Lê a cópia do Domínio, soma por empresa e por mês e manda só os totais pro sistema. Logs em C:\ponte-dominio\logs.'
}
$quem = New-ScheduledTaskPrincipal -UserId $Usuario -LogonType S4U -RunLevel Limited
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew -ExecutionTimeLimit $limite
Register-ScheduledTask -TaskName $NomeTarefa -Action $acao -Trigger $gatilho -Principal $quem -Settings $ajustes `
  -Description $descricao -Force | Out-Null

if ($Receita) {
  Write-Host "Tarefa '$NomeTarefa' registrada: de segunda a sexta às $Hora, como $Usuario (sem guardar senha)."
  if ($ambiente -ne 'producao') {
    Write-Host "Atenção: o [integra] ambiente ainda não é producao — a tarefa não manda nada até você trocar, depois de"
    Write-Host '  conferir as 5 primeiras empresas no e-CAC (o LEIA-ME explica).'
  }
  Write-Host "Antes de ligar, rode, em $App :"
  Write-Host '  py -3 -m ponte receita conferir'
  Write-Host '  py -3 -m ponte receita rodar --so autorizacao,pgdas,faturamento,situacao_fiscal --empresas 5 --sem-enviar --saida conferencia.json'
} else {
  Write-Host "Tarefa '$NomeTarefa' registrada: todo dia às $Hora, como $Usuario (sem guardar senha)."
  Write-Host "Antes da primeira rodada: preencha $config e rode, em $App :"
  Write-Host '  py -3 -m ponte conferir'
  Write-Host '  py -3 -m ponte rodar --sem-enviar'
}
