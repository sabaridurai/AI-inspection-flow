$ErrorActionPreference = 'Stop'

$configPath = Join-Path $PSScriptRoot 'application-local.properties'
if (-not (Test-Path $configPath)) {
    throw 'backend/application-local.properties is missing.'
}

if ((Get-Content $configPath) -match '^spring\.datasource\.password=CHANGE_ME\s*$') {
    throw 'Set spring.datasource.password in backend/application-local.properties before starting the backend.'
}

Push-Location $PSScriptRoot
try {
    & mvn spring-boot:run
    if ($LASTEXITCODE -ne 0) {
        throw "Spring Boot exited with code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
