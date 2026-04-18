$base = "d:\usuario\Desktop\EmprestimoRai\src"
$allFiles = Get-ChildItem -LiteralPath $base -Recurse -Filter "*.tsx"

$replacements = [ordered]@{
  # Backgrounds
  'bg-gray-50/50' = 'bg-gray-50/50 dark:bg-zinc-800/50'
  'bg-gray-50' = 'bg-gray-50 dark:bg-zinc-800'
  'bg-gray-100/50' = 'bg-gray-100/50 dark:bg-zinc-800/50'
  'bg-gray-100' = 'bg-gray-100 dark:bg-zinc-800'
  'bg-gray-200' = 'bg-gray-200 dark:bg-zinc-700'
  'bg-white' = 'bg-white dark:bg-zinc-900'

  # Borders
  'border-gray-200' = 'border-gray-200 dark:border-zinc-800'
  'border-gray-300' = 'border-gray-300 dark:border-zinc-700'

  # Text colors
  'text-gray-900' = 'text-gray-900 dark:text-zinc-100'
  'text-gray-800' = 'text-gray-800 dark:text-zinc-200'
  'text-gray-700' = 'text-gray-700 dark:text-zinc-300'
  'text-gray-600' = 'text-gray-600 dark:text-zinc-400'
  'text-gray-500' = 'text-gray-500 dark:text-zinc-400'
  'text-gray-400' = 'text-gray-400 dark:text-zinc-500'

  # Hover
  'hover:bg-gray-100' = 'hover:bg-gray-100 dark:hover:bg-zinc-800'
  'hover:bg-gray-200' = 'hover:bg-gray-200 dark:hover:bg-zinc-700'
  'hover:text-gray-900' = 'hover:text-gray-900 dark:hover:text-zinc-100'
  'hover:text-gray-800' = 'hover:text-gray-800 dark:hover:text-zinc-200'

  # Emerald light backgrounds  -> dark equivalents
  'bg-emerald-50' = 'bg-emerald-50 dark:bg-emerald-950/30'
  'bg-emerald-100' = 'bg-emerald-100 dark:bg-emerald-900/30'
  'border-emerald-200' = 'border-emerald-200 dark:border-emerald-800'

  # Other color light backgrounds
  'bg-blue-50' = 'bg-blue-50 dark:bg-blue-950/30'
  'bg-orange-50' = 'bg-orange-50 dark:bg-orange-950/30'
  'bg-violet-50' = 'bg-violet-50 dark:bg-violet-950/30'
  'bg-red-50' = 'bg-red-50 dark:bg-red-950/30'
  'bg-amber-100' = 'bg-amber-100 dark:bg-amber-900/30'
  'bg-amber-50' = 'bg-amber-50 dark:bg-amber-950/30'
  'bg-yellow-50' = 'bg-yellow-50 dark:bg-yellow-950/30'
  'bg-purple-50' = 'bg-purple-50 dark:bg-purple-950/30'

  'border-orange-200' = 'border-orange-200 dark:border-orange-800'
  'border-red-200' = 'border-red-200 dark:border-red-800'
  'border-blue-200' = 'border-blue-200 dark:border-blue-800'
  'border-amber-200' = 'border-amber-200 dark:border-amber-800'
  'border-violet-200' = 'border-violet-200 dark:border-violet-800'

  # Chart colors
  'stroke="#9ca3af"' = 'stroke="#9ca3af"'
  'stroke="#6b7280"' = 'stroke="#6b7280"'
}

# Skip files that already have dark: classes heavily applied (UI components we already updated)
$skipFiles = @('card.tsx', 'button.tsx', 'input.tsx', 'dialog.tsx', 'table.tsx', 'select.tsx', 'textarea.tsx', 'badge.tsx', 'sidebar.tsx', 'theme-provider.tsx')

$count = 0
foreach ($file in $allFiles) {
  if ($skipFiles -contains $file.Name -and $file.FullName -match 'components') {
    continue
  }
  $content = [System.IO.File]::ReadAllText($file.FullName)
  $original = $content
  
  # Don't double-apply dark: classes
  foreach ($key in $replacements.Keys) {
    $val = $replacements[$key]
    if ($key -eq $val) { continue } # skip no-ops
    # Only replace if dark: version not already there
    $content = $content.Replace($key, $val)
  }
  
  # Remove any doubled dark: classes (from re-running)
  # e.g. "dark:bg-zinc-800 dark:bg-zinc-800" -> "dark:bg-zinc-800"
  $content = [regex]::Replace($content, '(dark:[a-z:/-]+[\w-]+(?:/\d+)?)\s+\1', '$1')

  if ($content -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $content)
    $count++
    Write-Host "Updated: $($file.Name)"
  }
}
Write-Host "`nTotal updated: $count"
