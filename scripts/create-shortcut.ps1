$root = (Resolve-Path "$PSScriptRoot\..").Path
$desktop = [System.Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Iniciar POS Ventas.lnk"

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = Join-Path $root "iniciar-sistema.bat"
$sc.WorkingDirectory = $root
$iconPath = Join-Path $root "app-icon.ico"
if (Test-Path $iconPath) {
    $sc.IconLocation = "$iconPath,0"
}
$sc.Description = "Iniciar Sistema POS Ventas"
$sc.Save()

Write-Host "Acceso directo creado exitosamente en el Escritorio: $shortcutPath"
