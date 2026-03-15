$files = @("d:\HEHEHEHEHEHE\Flash\index.html", "d:\HEHEHEHEHEHE\Flash\quiz.html", "d:\HEHEHEHEHEHE\Flash\sw.js", "d:\HEHEHEHEHEHE\Flash\styles.css", "d:\HEHEHEHEHEHE\Flash\quiz.css", "d:\HEHEHEHEHEHE\Flash\app.js")
foreach ($f in $files) {
    if (Test-Path $f) {
        $c = [System.IO.File]::ReadAllText($f)
        $c = $c -replace 'family=Outfit:wght@300;400;500;600;700;800', 'family=Inter:wght@400;500;600;700'
        $c = $c -replace '''Outfit'',\s*sans-serif', '''Inter'', system-ui, -apple-system, sans-serif'
        [System.IO.File]::WriteAllText($f, $c, [System.Text.Encoding]::UTF8)
    }
}
