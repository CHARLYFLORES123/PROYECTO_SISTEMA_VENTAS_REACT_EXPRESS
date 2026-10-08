$ports = @(5000, 5173)
$stopped = 0

foreach ($port in $ports) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -and $pidToKill -ne 0) {
                    $proc = Get-Process -Id $pidToKill -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "Deteniendo proceso '$($proc.ProcessName)' (PID: $pidToKill) en puerto $port..." -ForegroundColor Yellow
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                        $stopped++
                    }
                }
            }
        }
    } catch {
        # Ignorar errores menores
    }
}

if ($stopped -gt 0) {
    Write-Host "Se detuvieron $stopped proceso(s) de servidores POS." -ForegroundColor Green
} else {
    Write-Host "No habia servidores POS en ejecucion (puertos 5000 y 5173 libres)." -ForegroundColor Cyan
}
