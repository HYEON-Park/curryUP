$ErrorActionPreference = "Stop"

function Pause-And-Exit($code) {
    Write-Host ""
    Read-Host "계속하려면 Enter를 누르세요"
    exit $code
}

Write-Host "============================================"
Write-Host "  curryUP 설치를 시작합니다."
Write-Host "============================================"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[필요] Node.js가 설치되어 있지 않습니다."
    Write-Host "잠시 후 열리는 다운로드 페이지에서 설치한 뒤, 이 파일을 다시 더블클릭해주세요."
    Start-Process "https://nodejs.org/"
    Pause-And-Exit 1
}

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "[필요] Ollama가 설치되어 있지 않습니다."
    Write-Host "잠시 후 열리는 다운로드 페이지에서 설치한 뒤, 이 파일을 다시 더블클릭해주세요."
    Start-Process "https://ollama.com/download"
    Pause-And-Exit 1
}

Write-Host "[1/5] AI 모델(qwen2.5:14b)을 준비합니다. 이미 받아둔 경우 바로 넘어갑니다."
Write-Host "      (처음 받는 경우 용량이 커서 시간이 걸릴 수 있습니다.)"
& ollama pull qwen2.5:14b
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ollama 앱이 켜져 있는지 확인한 뒤 이 파일을 다시 실행해주세요."
    Pause-And-Exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "[2/5] 백엔드 패키지를 설치합니다."
& npm install --prefix backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "설치 중 문제가 생겼습니다. 위에 표시된 메시지를 확인해주세요."
    Pause-And-Exit 1
}

Write-Host "[3/5] 프론트엔드 패키지를 설치합니다."
& npm install --prefix frontend
if ($LASTEXITCODE -ne 0) {
    Write-Host "설치 중 문제가 생겼습니다. 위에 표시된 메시지를 확인해주세요."
    Pause-And-Exit 1
}

Write-Host "[4/5] 빌드합니다."
& npm run build --prefix backend
if ($LASTEXITCODE -ne 0) {
    Write-Host "설치 중 문제가 생겼습니다. 위에 표시된 메시지를 확인해주세요."
    Pause-And-Exit 1
}

Write-Host "[5/5] 컴퓨터를 켤 때 자동으로 실행되도록 등록하고, 바탕화면에 바로가기를 만듭니다."
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "register-startup-task.ps1")

$shortcutPath = Join-Path $env:USERPROFILE "Desktop\curryUP.url"
Set-Content -Path $shortcutPath -Value "[InternetShortcut]`r`nURL=http://localhost:4000" -Encoding ASCII

Write-Host ""
Write-Host "설치가 끝났습니다. 지금 바로 서버를 켜고 화면을 열어드릴게요."
Start-Process (Join-Path $PSScriptRoot "start-server.cmd")
Start-Sleep -Seconds 5
Start-Process "http://localhost:4000"

Write-Host ""
Write-Host "다음부터는 컴퓨터를 켜면 자동으로 실행되고,"
Write-Host "바탕화면의 'curryUP' 아이콘으로 접속하면 됩니다."
Pause-And-Exit 0