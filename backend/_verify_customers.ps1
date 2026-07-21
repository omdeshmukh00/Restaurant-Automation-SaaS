$login = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"adminpanel16@gmail.com","password":"Happy@100"}' -SessionVariable s
$body = ($login.Content | ConvertFrom-Json)
$token = $body.data.token
Write-Host ('LOGIN_OK=' + $body.ok)
$resp = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/admin/customers?perPage=1000' -WebSession $s -Headers @{ Authorization = 'Bearer ' + $token }
$d = ($resp.Content | ConvertFrom-Json).data
Write-Host ('TOTAL=' + $d.total + ' RETURNED=' + $d.customers.Count + ' PAGES=' + $d.pages)
Write-Host ('STATS=' + ($d.stats | ConvertTo-Json -Compress))
Write-Host 'FIRST3:'
$d.customers[0..2] | ForEach-Object { Write-Host ($_.name + ' | ' + $_.mobile + ' | ' + $_.loyaltyTier + ' | ' + $_.status) }
