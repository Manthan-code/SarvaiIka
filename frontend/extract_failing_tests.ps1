# Read the test results file
$content = Get-Content "all_test_results.txt"

# Extract failing test suites
$failingSuites = @()

foreach ($line in $content) {
    if ($line -match "FAIL (tests/[^\s]+\.test\.[jt]sx?)") {
        $suite = $matches[1]
        if ($failingSuites -notcontains $suite) {
            $failingSuites += $suite
        }
    }
}

Write-Host "=== FAILING TEST SUITES ===" -ForegroundColor Red
Write-Host "Total failing suites: $($failingSuites.Count)" -ForegroundColor Yellow

$counter = 1
foreach ($suite in $failingSuites | Sort-Object) {
    Write-Host "$counter. $suite" -ForegroundColor White
    $counter++
}

# Save the list to a file for further analysis
$failingSuites | Sort-Object | Out-File "failing_test_suites.txt" -Encoding UTF8

Write-Host "`nFailing test suites saved to failing_test_suites.txt" -ForegroundColor Green