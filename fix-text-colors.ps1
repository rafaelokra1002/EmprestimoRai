$base = "d:\usuario\Desktop\EmprestimoRai\src"
$allFiles = Get-ChildItem -LiteralPath $base -Recurse -Filter "*.tsx"

$replacements = @{
  'text-emerald-400' = 'text-emerald-600'
  'text-amber-400' = 'text-amber-600'
  'text-orange-400' = 'text-orange-600'
  'text-red-400' = 'text-red-600'
  'text-purple-400' = 'text-purple-600'
  'text-blue-400' = 'text-blue-600'
  'text-yellow-400' = 'text-yellow-600'
  'text-pink-400' = 'text-pink-600'
  'text-cyan-400' = 'text-cyan-600'
  'bg-emerald-400' = 'bg-emerald-500'
  'stroke="#71717a"' = 'stroke="#9ca3af"'
  'color: "#f4f4f5"' = 'color: "#1f2937"'
}

$count = 0
foreach ($file in $allFiles) {
  $content = [System.IO.File]::ReadAllText($file.FullName)
  $original = $content
  foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
  }
  if ($content -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $content)
    $count++
    Write-Host "Updated: $($file.Name)"
  }
}
Write-Host "`nTotal updated: $count"
