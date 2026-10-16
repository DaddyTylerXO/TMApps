$ErrorActionPreference = 'Stop'
$soundDirectory = Join-Path $PSScriptRoot 'assets\Sounds'
New-Item -ItemType Directory -Force $soundDirectory | Out-Null
Add-Type -TypeDefinition @'
using System;
using System.IO;
public static class CozySoundMaker {
    public static void Write(string path, int variant, bool send) {
        int rate = 44100, samples = (int)(rate * (0.85 + variant * 0.045));
        double[] baseNotes = { 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88 };
        double root = baseNotes[variant]; double[] notes = send ? new[] { root * 0.75, root, root * 1.25 } : new[] { root * 1.25, root, root * 0.75 };
        using (var writer = new BinaryWriter(File.Create(path))) {
            writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF")); writer.Write(36 + samples * 2); writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt ")); writer.Write(16); writer.Write((short)1); writer.Write((short)1); writer.Write(rate); writer.Write(rate * 2); writer.Write((short)2); writer.Write((short)16); writer.Write(System.Text.Encoding.ASCII.GetBytes("data")); writer.Write(samples * 2);
            for (int i = 0; i < samples; i++) {
                double t = (double)i / rate, value = 0;
                for (int note = 0; note < notes.Length; note++) { double time = t - note * (0.13 + variant * 0.006); if (time < 0) continue; double envelope = Math.Min(1, time / 0.018) * Math.Exp(-time * (5.2 + variant * 0.18)); double tone = Math.Sin(2 * Math.PI * notes[note] * time) + 0.17 * Math.Sin(2 * Math.PI * notes[note] * 2 * time) + 0.05 * Math.Sin(2 * Math.PI * notes[note] * 3 * time); value += 0.105 * tone * envelope; }
                double fade = Math.Min(1, (samples - i) / (rate * 0.08)); writer.Write((short)(Math.Max(-0.7, Math.Min(0.7, value * fade)) * short.MaxValue));
            }
        }
    }
}
'@
$names = @('cozy','woodland','raindrop','soft-bell','warm-keys','moonlight','firefly')
for ($i = 0; $i -lt $names.Count; $i++) { foreach ($direction in @('receive','send')) { [CozySoundMaker]::Write((Join-Path $soundDirectory ($direction + '-' + $names[$i] + '.wav')), $i, $direction -eq 'send') } }
Write-Host 'Generated 14 original soft mail sounds.'
