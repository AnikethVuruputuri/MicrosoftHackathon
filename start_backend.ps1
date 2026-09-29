$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$env:PYTHONPATH = $backend
Set-Location $backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
