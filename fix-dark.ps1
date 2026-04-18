$base = "d:\usuario\Desktop\EmprestimoRai\src"
$allFiles = Get-ChildItem -LiteralPath $base -Recurse -Filter "*.tsx"

$replacements = @{
  'bg-emerald-950/10' = 'bg-emerald-50'
  'bg-emerald-950/15' = 'bg-emerald-50'
  'bg-emerald-950/20' = 'bg-emerald-50'
  'bg-emerald-950/30' = 'bg-emerald-100'
  'bg-emerald-950/40' = 'bg-emerald-50'
  'bg-emerald-950/50' = 'bg-emerald-50'
  'border-emerald-900/40' = 'border-emerald-200'
  'border-emerald-900/30' = 'border-emerald-200'
  'border-emerald-700/40' = 'border-emerald-200'
  'border-emerald-700/50' = 'border-emerald-200'
  'bg-emerald-900/20' = 'bg-emerald-50'
  'border-emerald-500/20' = 'border-emerald-200'
  'border-emerald-500/35' = 'border-emerald-200'
  'bg-orange-950/15' = 'bg-orange-50'
  'border-orange-900/40' = 'border-orange-200'
  'bg-red-950/20' = 'bg-red-50'
  'bg-red-950/15' = 'bg-red-50'
  'border-red-900/40' = 'border-red-200'
  '#18181b' = '#ffffff'
  '#27272a' = '#e5e7eb'
  'hover:bg-emerald-950/20' = 'hover:bg-emerald-50'
  'hover:bg-emerald-950/30' = 'hover:bg-emerald-100'
  'to-emerald-950/20' = 'to-emerald-50'
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
    Write-Host "Updated: $($file.FullName.Replace($base, ''))"
  }
}
Write-Host "`nTotal updated: $count"
