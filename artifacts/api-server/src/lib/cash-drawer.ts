import { spawn } from "node:child_process";
import { logger } from "./logger";

/**
 * Cash drawer (cajón de dinero) integration for Epson thermal printers.
 *
 * El cajón está conectado físicamente a la impresora térmica Epson mediante el
 * cable RJ11/RJ12. Para abrirlo hay que enviar el pulso ESC/POS estándar de
 * apertura de cajón a la impresora:
 *
 *     ESC p m t1 t2   ->  0x1B 0x70 0x00 0x19 0xFA
 *
 *   - m  = 0  (pin de cajón 2 — el estándar en Epson)
 *   - t1 = 25 (0x19)  tiempo ON  (~50ms * 2)
 *   - t2 = 250 (0xFA) tiempo OFF (~500ms * 2)
 *
 * El comando se envía a la impresora como datos RAW a través del spooler de
 * Windows (WritePrinter). No usamos ninguna dependencia nativa: invocamos un
 * pequeño script de PowerShell con la API de impresión Win32.
 */

// ESC p 0 25 250 — pulso de apertura de cajón (pin 2), el estándar ESC/POS.
const OPEN_DRAWER_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]);

/**
 * Script PowerShell que abre el cajón enviando bytes RAW a la impresora.
 * Recibe los bytes como cadena hex separada por espacios y el nombre (o el
 * predeterminado) de la impresora como primer argumento.
 */
function buildPowerShellScript(printerName: string, hexBytes: string): string {
  return `
$PrinterName = ${JSON.stringify(printerName)};
$HexBytes = ${JSON.stringify(hexBytes)};

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOW di);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytes(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        try {
            DOCINFOW di = new DOCINFOW();
            di.pDocName = "Cash Drawer Pulse";
            di.pDataType = "RAW";
            if (!StartDocPrinter(hPrinter, 1, ref di)) return false;
            try {
                if (!StartPagePrinter(hPrinter)) return false;
                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                int dwWritten;
                bool ok = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                Marshal.FreeCoTaskMem(pUnmanagedBytes);
                EndPagePrinter(hPrinter);
                return ok;
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    $PrinterName = (Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" | Select-Object -First 1).Name
}
if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    Write-Error "No se encontró ninguna impresora predeterminada instalada en Windows."
    exit 2
}

$bytes = $HexBytes.Split(' ') | ForEach-Object { [byte][Convert]::ToInt32($_, 16) }
$ok = [RawPrinterHelper]::SendBytes($PrinterName, $bytes)
if ($ok) {
    Write-Output "OK"
} else {
    Write-Error "No se pudo enviar el pulso a la impresora '$PrinterName'. Verifica que esté encendida y conectada."
    exit 3
}
`;
}

function runPowerShellScript(script: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => resolve({ code: -1, stdout, stderr: stderr + err.message }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export interface OpenDrawerResult {
  success: boolean;
  message: string;
}

/**
 * Abre el cajón de dinero enviando el comando ESC/POS a la impresora Epson.
 *
 * @param printerName Nombre exacto de la impresora en Windows. Si se omite,
 *                    se usa la impresora predeterminada del sistema.
 */
export async function openCashDrawer(printerName?: string | null): Promise<OpenDrawerResult> {
  if (process.platform !== "win32") {
    return {
      success: false,
      message: "La apertura directa del cajón solo está disponible en Windows.",
    };
  }

  const hex = Array.from(OPEN_DRAWER_CMD).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const cleanPrinterName = (printerName ?? "").trim();
  const script = buildPowerShellScript(cleanPrinterName, hex);

  try {
    const { code, stdout, stderr } = await runPowerShellScript(script);
    if (code === 0 && stdout.includes("OK")) {
      logger.info({ printerName: cleanPrinterName || "(default)" }, "Cash drawer opened successfully");
      return { success: true, message: "Cajón abierto exitosamente" };
    }

    // Limpiar mensaje de error para mostrarlo al usuario
    let cleanError = stderr.trim();
    if (cleanError.includes("Write-Error")) {
      const match = cleanError.match(/:\s*(.+)$/m);
      if (match) cleanError = match[1];
    } else if (cleanError.includes("#< CLIXML")) {
      const match = cleanError.match(/<S S="Error">([^<]+)<\/S>/);
      if (match) cleanError = match[1];
    }

    logger.warn({ code, stderr: cleanError }, "Failed to open cash drawer");
    return {
      success: false,
      message: cleanError || `No se pudo abrir el cajón (código de salida ${code})`,
    };
  } catch (err: any) {
    logger.error({ err }, "Cash drawer error");
    return { success: false, message: err?.message ?? "Error al abrir el cajón" };
  }
}

/** Devuelve el pulso ESC/POS crudo (por si se necesita reutilizar). */
export function getOpenDrawerBytes(): Buffer {
  return Buffer.from(OPEN_DRAWER_CMD);
}
